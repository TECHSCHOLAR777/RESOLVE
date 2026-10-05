import io
import re

import numpy as np
import pytest
import rasterio
from fastapi.testclient import TestClient
from PIL import Image
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


@pytest.mark.parametrize("sample_id", SAMPLE_IDS)
def test_sample_thumbnail(sample_id):
    r = client.get(f"/api/samples/{sample_id}/input.png")
    assert r.status_code == 200 and r.headers["content-type"] == "image/png"
    img = Image.open(io.BytesIO(r.content))
    assert img.format == "PNG" and img.size == (256, 256) and img.mode == "RGB"


def test_thumbnail_unknown_sample():
    assert client.get("/api/samples/nope/input.png").status_code == 404


def check_scene_patches(body: dict, w: int, h: int):
    sc = body["scene"]
    west, south, east, north = sc["bounds"]
    assert west < east and south < north
    assert 5 < sc["center"]["lat"] < 38 and 65 < sc["center"]["lon"] < 100
    assert west < sc["center"]["lon"] < east and south < sc["center"]["lat"] < north
    assert sc["crs"].startswith("EPSG:") and sc["pixel_size_m"] == pytest.approx(10)
    assert (sc["width"], sc["height"]) == (w, h)
    p = body["patches"]
    assert p["tile"] == 128 and p["overlap"] == 32
    assert p["count"] == p["cols"] * p["rows"] >= 1


@pytest.mark.parametrize("sample_id", SAMPLE_IDS)
def test_sample_scene_and_patches(sample_id):
    body = client.post(f"/api/samples/{sample_id}/superres").json()
    check_scene_patches(body, 256, 256)
    sc = body["scene"]
    assert re.fullmatch(r"\d{4}-\d{2}-\d{2}", sc["date"]) and re.fullmatch(r"T\d{2}[A-Z]{3}", sc["tile_id"])
    assert sc["satellite"].startswith("Sentinel-2")
    assert body["patches"] == {"tile": 128, "overlap": 32, "cols": 3, "rows": 3, "count": 9}


def test_scene_from_source_item_tag_and_single_pass():
    item = "S2A_MSIL2A_20250101T054231_R005_T42QZG_20250101T085751"
    data = tif_bytes(np.full((4, 64, 64), 0.2, "float32"), source_item=item)
    body = client.post("/api/superres", files={"file": ("a.tif", data, "image/tiff")}).json()
    sc = body["scene"]
    assert (sc["date"], sc["satellite"], sc["tile_id"], sc["source_item"]) == ("2025-01-01", "Sentinel-2A", "T42QZG", item)
    assert body["patches"]["cols"] == body["patches"]["rows"] == 1


# ---- analysis layers, stages, lock, AlphaEarth ------------------------------------------------

BASE_LAYERS = ["rgb", "nir_false", "ndvi", "ndwi", "water", "landcover", "builtup", "fields", "wavelet",
               "features", "uncertainty", "inferred", "confidence"]
STAGES = ["ingest", "normalise", "alphaearth", "patching", "backbone", "wavelet", "lock", "uncertainty", "products"]


def layer_pixels(body: dict, layer_id: str) -> np.ndarray:
    r = client.get(f"/api/results/{body['id']}/layers/{layer_id}.png")
    assert r.status_code == 200
    return np.array(Image.open(io.BytesIO(r.content)).convert("RGBA"))


def check_layers(body: dict, expect_ae: bool = False):
    ids = [l["id"] for l in body["layers"]]
    assert ids[:len(BASE_LAYERS)] == BASE_LAYERS
    assert set(ids) - set(BASE_LAYERS) == ({"alphaearth", "gate"} if expect_ae else set())
    size = (body["output"]["width"], body["output"]["height"])
    for l in body["layers"]:
        assert l["url"] == f"/api/results/{body['id']}/layers/{l['id']}.png" and l["name"] and l["group"]
        lg = l["legend"]
        if lg["type"] == "ramp":
            assert lg["min"] < lg["max"] or l["id"] == "rgb"
            assert lg["min_label"] and lg["max_label"] and lg["colormap"]
        else:
            assert lg["type"] == "classes" and lg["classes"]
            assert all(re.fullmatch(r"#[0-9A-Fa-f]{6}", c["color"]) and c["label"] for c in lg["classes"])
        r = client.get(l["url"])
        expected = "image/png" if lg["type"] == "classes" or l["id"] == "rgb" else "image/webp"
        assert r.status_code == 200 and r.headers["content-type"] == expected
        assert Image.open(io.BytesIO(r.content)).size == size
        assert client.get(l["url"]).content == r.content  # cached render is stable


@pytest.mark.parametrize("sample_id", SAMPLE_IDS)
def test_sample_layers_stages_confidence_lock(sample_id):
    body = client.post(f"/api/samples/{sample_id}/superres").json()
    check_layers(body)
    assert [s["id"] for s in body["stages"]] == STAGES
    assert all(isinstance(s["ms"], int) and s["ms"] >= 0 for s in body["stages"])
    assert body["stages"][STAGES.index("backbone")]["ms"] > 0
    c = body["confidence"]
    assert 0 <= c["mean"] <= 1 and 0 <= c["high_fraction"] <= 1
    lock = body["lock"]
    assert 0 < lock["consistency_after"] < lock["consistency_before"] < 1 and lock["applied"] is True
    assert body["alphaearth"] == {"available": False, "year": None, "source": None,
                                  "note": "AlphaEarth lookup is switched off on this server."}


def test_layer_semantics_on_vegetation_and_water():
    # left half vegetation (high NIR), right half water (low NIR, green above NIR)
    refl = np.zeros((4, 64, 64), "float32")
    refl[:, :, :32] = np.array([0.05, 0.08, 0.04, 0.45], "float32")[:, None, None]
    refl[:, :, 32:] = np.array([0.03, 0.06, 0.05, 0.02], "float32")[:, None, None]
    body = client.post("/api/superres", files={"file": ("a.tif", tif_bytes(refl), "image/tiff")}).json()
    out = read_output(body["id"])[0]
    assert out[3, :, :100].mean() > 0.3 and out[3, :, 160:].mean() < 0.1
    water = layer_pixels(body, "water")
    assert water[:, 200:, 3].mean() > 250 and water[:, :60, 3].mean() < 5  # water opaque, other transparent
    lc = layer_pixels(body, "landcover")
    assert tuple(lc[128, 20, :3]) == (0x15, 0x80, 0x3D)  # dense vegetation
    assert tuple(lc[128, 230, :3]) == (0x25, 0x63, 0xEB)  # water


def test_uncertainty_uses_eight_passes_when_asked(monkeypatch):
    monkeypatch.setenv("RESOLVE_TTA", "8")
    data = tif_bytes(np.random.default_rng(0).uniform(0.05, 0.3, (4, 40, 40)).astype("float32"))
    body = client.post("/api/superres", files={"file": ("a.tif", data, "image/tiff")}).json()
    unc = next(l for l in body["layers"] if l["id"] == "uncertainty")
    assert "8 test-time" in unc["legend"]["note"] and unc["legend"]["max"] > 0


def test_layer_endpoint_errors():
    body = client.post(f"/api/samples/{SAMPLE_IDS[0]}/superres").json()
    assert client.get(f"/api/results/{body['id']}/layers/nope.png").status_code == 404
    assert client.get(f"/api/results/{body['id']}/layers/gate.png").status_code == 404  # no AlphaEarth, no gate
    assert client.get("/api/results/" + "0" * 32 + "/layers/ndvi.png").status_code == 404
    assert client.get(f"/api/results/{body['id']}/layers/NDVI.png").status_code == 404


def test_lock_reduces_inconsistency():
    from app.lock import lock
    rng = np.random.default_rng(1)
    z = rng.uniform(0.05, 0.3, (4, 128, 128)).astype("float32")
    y = z.reshape(4, 32, 4, 32, 4).mean((2, 4)) * 1.1
    x, before, after = lock(z, y)
    assert after < before and np.isfinite(x).all() and x.min() >= 0


def test_haar_energy_and_dihedral():
    from app.layers import haar_energy
    from app.model import DIHEDRAL, d_apply, d_invert
    flat = np.full((4, 32, 32), 0.2, "float32")
    assert haar_energy(flat).max() == pytest.approx(0, abs=1e-6)
    stripes = flat.copy()
    stripes[:, :, ::2] += 0.1
    assert haar_energy(stripes).mean() > 0.05
    x = np.random.default_rng(2).random((4, 6, 9))
    for k, f in DIHEDRAL:
        assert np.array_equal(d_invert(d_apply(x, k, f), k, f), x)


def test_alphaearth_unit_helpers():
    from app import alphaearth as ae
    assert ae.target_year("2025-03-22") == 2024 and ae.target_year("2017-01-01") == 2017
    assert ae.target_year("2030-01-01") == 2025 and ae.target_year(None) == 2024
    out = ae._dequantise(np.array([[-128, 127, -127, 0]], "int8"))
    assert np.isnan(out[0, 0]) and out[0, 1] == pytest.approx((127 / 127.5) ** 2) and out[0, 2] < 0 and out[0, 3] == 0
    idx = ae._index()
    assert idx["files"]["2024/43N"] and idx["grid"] == {"west0": 8480, "size": 81920}


def test_alphaearth_network_failure_does_not_break_request(monkeypatch, tmp_path):
    from app import alphaearth as ae
    monkeypatch.setenv("RESOLVE_ALPHAEARTH", "1")
    monkeypatch.setattr(ae, "CACHE_DIR", tmp_path)
    monkeypatch.setattr(ae, "_failures", {})

    def boom(*a, **k):
        raise OSError("network down")

    monkeypatch.setattr(ae, "_read_cell_band", boom)
    body = client.post(f"/api/samples/{SAMPLE_IDS[0]}/superres").json()
    a = body["alphaearth"]
    assert a["available"] is False and a["year"] is None and a["source"] is None and a["note"]
    check_layers(body, expect_ae=False)


def test_alphaearth_present_adds_layers(monkeypatch):
    from app import alphaearth as ae
    emb = np.random.default_rng(3).normal(size=(6, 256, 256)).astype("float32")

    def fake(crs, transform, w, h, date, budget=None):
        return ae._result(True, 2024, "Read 6 of 64 dimensions.", emb, ae.SOURCE)

    monkeypatch.setattr(ae, "fetch", fake)
    body = client.post(f"/api/samples/{SAMPLE_IDS[0]}/superres").json()
    assert body["alphaearth"]["available"] and body["alphaearth"]["year"] == 2024 and body["alphaearth"]["source"]
    check_layers(body, expect_ae=True)


def _online() -> bool:
    import socket
    try:
        socket.create_connection(("s3.us-west-2.amazonaws.com", 443), timeout=3).close()
        return True
    except OSError:
        return False


@pytest.mark.skipif(not _online(), reason="needs network access to the AlphaEarth bucket")
def test_alphaearth_live_window_read(monkeypatch, tmp_path):
    from app import alphaearth as ae
    monkeypatch.setenv("RESOLVE_ALPHAEARTH", "1")
    monkeypatch.setenv("AEF_BANDS", "3")
    monkeypatch.setenv("AEF_TIMEOUT_S", "30")
    monkeypatch.setattr(ae, "CACHE_DIR", tmp_path)
    monkeypatch.setattr(ae, "_failures", {})
    with rasterio.open(SAMPLES_DIR / "delhi-city.tif") as src:
        res = ae.fetch(src.crs, src.transform, src.width, src.height, "2025-03-24")
    if not res["available"]:
        pytest.skip(f"AlphaEarth not reachable right now: {res['note']}")
    emb = res["emb"]
    assert res["year"] == 2024 and emb.shape == (3, 256, 256)
    assert np.nanmax(np.nansum(emb ** 2, 0)) <= 1.01  # 3 dims of a unit-length 64-d vector
    assert np.isnan(emb).mean() < 0.01 and emb.std() > 0.01
