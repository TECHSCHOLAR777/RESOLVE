
import numpy as np
import pytest
import rasterio
from fastapi.testclient import TestClient
from rasterio.io import MemoryFile
from rasterio.transform import from_origin

from app.main import SAMPLES_DIR, app, load_samples

client = TestClient(app)
SAMPLE_IDS = [s["id"] for s in load_samples()]


def tif_bytes(arr: np.ndarray, **tags) -> bytes:
    with MemoryFile() as mem:
        with mem.open(driver="GTiff", count=arr.shape[0], height=arr.shape[1], width=arr.shape[2],
                      dtype=arr.dtype, crs="EPSG:32643", transform=from_origin(500000, 3000000, 10, 10)) as dst:
            dst.write(arr)
            dst.update_tags(**tags)
        return mem.read()


def read_output(result_id: str):
    r = client.get(f"/api/results/{result_id}/output.tif")
    assert r.status_code == 200
    with MemoryFile(r.content) as mem, mem.open() as src:
        return src.read(), src.transform, src.crs, src.dtypes


def check_result(body: dict, w: int, h: int, input_refl: np.ndarray):
    assert body["input"]["width"] == body["output"]["width"] == w * 4
    assert body["input"]["height"] == body["output"]["height"] == h * 4
    for key in ("input", "output"):
        png = client.get(body[key]["png"])
        assert png.status_code == 200 and png.headers["content-type"] == "image/png"
    out, transform, crs, dtypes = read_output(body["id"])
    assert out.shape == (4, h * 4, w * 4) and set(dtypes) == {"float32"}
    assert np.isfinite(out).all()
    pooled = out.reshape(4, h, 4, w, 4).mean(axis=(2, 4))
    assert np.abs(pooled - input_refl).mean() < 0.02
    return transform, crs


def test_health():
    r = client.get("/api/health")
    assert r.json() == {"status": "ok", "model": "SEN2SR-Lite RGBN x4", "device": "cpu"}


def test_samples_list():
    r = client.get("/api/samples")
    assert r.status_code == 200
    items = r.json()
    assert len(items) >= 3
    assert set(items[0]) == {"id", "name", "location", "date", "width", "height"}


@pytest.mark.parametrize("sample_id", SAMPLE_IDS)
def test_sample_superres(sample_id):
    r = client.post(f"/api/samples/{sample_id}/superres")
    assert r.status_code == 200
    body = r.json()
    assert body["runtime_ms"] > 0 and body["crs"].startswith("EPSG:") and body["notes"]
    with rasterio.open(SAMPLES_DIR / f"{sample_id}.tif") as src:
        refl, w, h, t = src.read(), src.width, src.height, src.transform
    transform, crs = check_result(body, w, h, refl)
    assert transform.a == pytest.approx(t.a / 4) and transform.e == pytest.approx(t.e / 4)
    assert (transform.c, transform.f) == (t.c, t.f)


def test_upload_matches_sample_endpoint():
    sample = SAMPLE_IDS[0]
    data = (SAMPLES_DIR / f"{sample}.tif").read_bytes()
    r = client.post("/api/superres", files={"file": ("a.tif", data, "image/tiff")})
    assert r.status_code == 200
    with rasterio.open(SAMPLES_DIR / f"{sample}.tif") as src:
        check_result(r.json(), src.width, src.height, src.read())


def test_non_square_upload_and_band_order():
    yy, xx = np.mgrid[0:100, 0:150]
    base = 0.15 + 0.1 * np.sin(xx / 9.0) * np.cos(yy / 7.0)
    refl = np.stack([base * k for k in (1.0, 0.9, 0.7, 1.5)]).astype("float32")
    shuffled = refl[[3, 2, 1, 0]]  # file order B8,B2,B3,B4
    r = client.post("/api/superres", files={"file": ("a.tif", tif_bytes(shuffled), "image/tiff")},
                    data={"band_order": "B8,B2,B3,B4"})
    assert r.status_code == 200
    check_result(r.json(), 150, 100, refl)


def test_integer_dn_scaling_depends_on_baseline():
    dn = (np.full((4, 64, 64), 3000)).astype("uint16")
    old = client.post("/api/superres", files={"file": ("a.tif", tif_bytes(dn), "image/tiff")}).json()
    new = client.post("/api/superres", files={"file": ("a.tif", tif_bytes(dn, processing_baseline="05.11"), "image/tiff")}).json()
    assert read_output(old["id"])[0].mean() == pytest.approx(0.3, abs=0.02)
    assert read_output(new["id"])[0].mean() == pytest.approx(0.2, abs=0.02)
    assert any("offset" in n for n in new["notes"])


def test_error_three_bands():
    r = client.post("/api/superres", files={"file": ("a.tif", tif_bytes(np.zeros((3, 64, 64), "float32")), "image/tiff")})
    assert r.status_code == 400 and "4 bands" in r.json()["detail"]


def test_error_not_a_tif():
    r = client.post("/api/superres", files={"file": ("a.txt", b"hello", "text/plain")})
    assert r.status_code == 400 and "detail" in r.json()


def test_error_oversize():
    big = tif_bytes(np.zeros((4, 513, 100), "float32"))
    r = client.post("/api/superres", files={"file": ("a.tif", big, "image/tiff")})
    assert r.status_code == 413


def test_error_bad_band_order():
    data = (SAMPLES_DIR / f"{SAMPLE_IDS[0]}.tif").read_bytes()
    r = client.post("/api/superres", files={"file": ("a.tif", data, "image/tiff")}, data={"band_order": "B4,B3"})
    assert r.status_code == 400


def test_unknown_sample_and_result():
    assert client.post("/api/samples/nope/superres").status_code == 404
    assert client.get("/api/results/" + "0" * 32 + "/output.tif").status_code == 404
    assert client.get("/api/results/../output.tif").status_code in (404, 422)
