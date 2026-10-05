"""RESOLVE prototype API: SEN2SR-Lite RGBN x4 super-resolution of Sentinel-2 10 m tiles."""
import io
import json
import re
import shutil
import tempfile
import time
import uuid
from pathlib import Path

import numpy as np
import rasterio
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from PIL import Image
from rasterio.errors import RasterioIOError
from rasterio.io import MemoryFile
from rasterio.warp import transform_bounds

from .model import MODEL_NAME, SCALE, STRIDE, TILE, get_model, padded_size, super_resolve

SAMPLES_DIR = Path(__file__).resolve().parents[1] / "samples"
RESULTS_DIR = Path(tempfile.gettempdir()) / "resolve_results"
MAX_RESULTS = 50
MAX_SIDE = 512
MIN_SIDE = 8
CANONICAL = ["B4", "B3", "B2", "B8"]

app = FastAPI(title="RESOLVE prototype")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


def load_samples() -> list[dict]:
    path = SAMPLES_DIR / "samples.json"
    return json.loads(path.read_text()) if path.exists() else []


@app.get("/api/health")
def health():
    return {"status": "ok", "model": MODEL_NAME, "device": "cpu"}


@app.get("/api/samples")
def samples():
    keys = ("id", "name", "location", "date", "width", "height")
    return [{k: s[k] for k in keys} for s in load_samples()]


def find_sample(sample_id: str) -> dict:
    for s in load_samples():
        if s["id"] == sample_id:
            return s
    raise HTTPException(404, "Unknown sample")


def parse_band_order(text: str) -> list[int]:
    """For each canonical band (B4,B3,B2,B8), return its index in the file."""
    names = [re.sub(r"^B0?", "B", t.strip().upper()) for t in text.split(",")]
    if sorted(names) != sorted(CANONICAL):
        raise HTTPException(400, "band_order must list B4,B3,B2,B8 each once, e.g. 'B4,B3,B2,B8'")
    return [names.index(b) for b in CANONICAL]


def processing_baseline(src) -> float | None:
    tags = dict(src.tags())
    for i in range(1, src.count + 1):
        tags.update(src.tags(i))
    for k, v in tags.items():
        if "baseline" in k.lower():
            try:
                return float(str(v).strip())
            except ValueError:
                pass
    return None


def read_input(data: bytes, band_order: str):
    """Returns (reflectance (4,H,W) float32 in canonical order, metadata dict, notes)."""
    order = parse_band_order(band_order)
    try:
        with MemoryFile(data) as mem, mem.open() as src:
            if src.driver != "GTiff":
                raise HTTPException(400, "File is not a GeoTIFF")
            if src.count != 4:
                raise HTTPException(400, f"Expected 4 bands (B4,B3,B2,B8), got {src.count}")
            if src.width > MAX_SIDE or src.height > MAX_SIDE:
                raise HTTPException(413, f"Input is {src.width}x{src.height}px; maximum is {MAX_SIDE}x{MAX_SIDE}")
            if src.width < MIN_SIDE or src.height < MIN_SIDE:
                raise HTTPException(400, f"Input is too small; minimum is {MIN_SIDE}x{MIN_SIDE}px")
            arr = src.read().astype("float32")
            meta = dict(crs=src.crs, transform=src.transform, baseline=processing_baseline(src),
                        source_item=src.tags().get("source_item"))
    except RasterioIOError:
        raise HTTPException(400, "File is not a readable GeoTIFF")

    notes = []
    arr = np.nan_to_num(arr, nan=0.0, posinf=0.0, neginf=0.0)[order]
    if arr.max() > 1 and np.all(arr == np.round(arr)):
        if meta["baseline"] is not None and meta["baseline"] >= 4.0:
            arr = arr - 1000
            notes.append(f"Processing baseline {meta['baseline']:.2f}: subtracted L2A offset of 1000 DN.")
        else:
            notes.append("Processing baseline not given or below 04.00: no L2A offset applied.")
        arr = arr / 10000.0
        notes.append("Integer values above 1 read as L2A digital numbers; divided by 10 000.")
    else:
        notes.append("Values read as 0-1 surface reflectance; no scaling applied.")
    if meta["crs"] is None:
        notes.append("File has no CRS; output GeoTIFF is not georeferenced.")
    return np.clip(arr, 0, None).astype("float32"), meta, notes


def to_png(rgb: np.ndarray, lo: float, hi: float) -> bytes:
    img = np.clip((rgb - lo) / max(hi - lo, 1e-6), 0, 1)
    img = (img.transpose(1, 2, 0) * 255).round().astype("uint8")
    buf = io.BytesIO()
    Image.fromarray(img, "RGB").save(buf, "PNG")
    return buf.getvalue()


def prune_results():
    dirs = sorted((d for d in RESULTS_DIR.iterdir() if d.is_dir()), key=lambda d: d.stat().st_mtime)
    for d in dirs[:-MAX_RESULTS]:
        shutil.rmtree(d, ignore_errors=True)


_thumb_cache: dict[str, bytes] = {}
ITEM_RE = re.compile(r"^S2([ABC])_MSI\w+?_(\d{4})(\d{2})(\d{2})T\d{6}_R\d+_(T\w{5})_")


def parse_source_item(item: str | None) -> dict:
    m = ITEM_RE.match(item or "")
    if not m:
        return {"date": None, "satellite": None, "tile_id": None}
    return {"date": f"{m[2]}-{m[3]}-{m[4]}", "satellite": f"Sentinel-2{m[1]}", "tile_id": m[5]}


def build_scene(meta: dict, w: int, h: int, fallback: dict | None = None) -> dict:
    fallback = fallback or {}
    item = meta.get("source_item") or fallback.get("source_item")
    info = parse_source_item(item)
    info["date"] = info["date"] or fallback.get("date")
    scene = {"center": None, "bounds": None, "crs": None, "pixel_size_m": None, "width": w, "height": h,
             "date": info["date"], "satellite": info["satellite"], "source_item": item,
             "tile_id": info["tile_id"]}
    crs, t = meta["crs"], meta["transform"]
    if crs is None:
        return scene
    scene["crs"] = crs.to_string()
    try:
        bounds = (t.c, t.f + t.e * h, t.c + t.a * w, t.f)
        west, south, east, north = transform_bounds(crs, "EPSG:4326", *bounds)
        scene["bounds"] = [round(v, 5) for v in (west, south, east, north)]
        scene["center"] = {"lat": round((south + north) / 2, 5), "lon": round((west + east) / 2, 5)}
        if crs.is_projected:
            scene["pixel_size_m"] = round(abs(t.a) * (crs.linear_units_factor[1]), 3)
    except Exception:
        pass
    return scene


def build_patches(h: int, w: int) -> dict:
    rows = (padded_size(h) - TILE) // STRIDE + 1
    cols = (padded_size(w) - TILE) // STRIDE + 1
    return {"tile": TILE, "overlap": TILE - STRIDE, "cols": cols, "rows": rows, "count": cols * rows}


def sample_thumbnail(sample_id: str) -> bytes:
    if sample_id not in _thumb_cache:
        refl, _, _ = read_input((SAMPLES_DIR / f"{sample_id}.tif").read_bytes(), "B4,B3,B2,B8")
        lo, hi = np.percentile(refl[:3], [2, 98])
        _thumb_cache[sample_id] = to_png(refl[:3], lo, hi)
    return _thumb_cache[sample_id]


def run_pipeline(data: bytes, band_order: str, fallback: dict | None = None) -> dict:
    refl, meta, notes = read_input(data, band_order)
    get_model()  # load before timing
    t0 = time.perf_counter()
    out = super_resolve(refl)
    runtime_ms = round((time.perf_counter() - t0) * 1000)

    _, h, w = refl.shape
    lo, hi = np.percentile(refl[:3], [2, 98])
    input_png = to_png(refl[:3].repeat(SCALE, axis=1).repeat(SCALE, axis=2), lo, hi)
    output_png = to_png(out[:3], lo, hi)

    rid = uuid.uuid4().hex
    RESULTS_DIR.mkdir(exist_ok=True)
    d = RESULTS_DIR / rid
    d.mkdir()
    (d / "input.png").write_bytes(input_png)
    (d / "output.png").write_bytes(output_png)
    transform = meta["transform"] @ rasterio.Affine.scale(1 / SCALE)
    with rasterio.open(d / "output.tif", "w", driver="GTiff", count=4, width=w * SCALE, height=h * SCALE,
                       dtype="float32", crs=meta["crs"], transform=transform, compress="deflate",
                       predictor=3) as dst:
        dst.write(out.astype("float32"))
        dst.update_tags(band_order="B4,B3,B2,B8", model=MODEL_NAME, units="surface reflectance 0-1")
    prune_results()

    notes += [
        "Previews use one 2-98 percentile stretch computed from the input RGB (B4,B3,B2), applied to both.",
        f"The input preview is enlarged {SCALE}x with nearest-neighbour so both previews have the same pixel size.",
    ]
    return {
        "id": rid,
        "input": {"width": w * SCALE, "height": h * SCALE, "png": f"/api/results/{rid}/input.png"},
        "output": {"width": w * SCALE, "height": h * SCALE, "png": f"/api/results/{rid}/output.png"},
        "runtime_ms": runtime_ms,
        "model": MODEL_NAME,
        "crs": meta["crs"].to_string() if meta["crs"] else None,
        "notes": notes,
        "scene": build_scene(meta, w, h, fallback),
        "patches": build_patches(h, w),
    }


@app.post("/api/superres")
def superres(file: UploadFile = File(...), band_order: str = Form("B4,B3,B2,B8")):
    return run_pipeline(file.file.read(), band_order)


@app.post("/api/samples/{sample_id}/superres")
def sample_superres(sample_id: str):
    sample = find_sample(sample_id)
    return run_pipeline((SAMPLES_DIR / f"{sample_id}.tif").read_bytes(), "B4,B3,B2,B8", sample)


@app.get("/api/samples/{sample_id}/input.png")
def sample_input_png(sample_id: str):
    find_sample(sample_id)
    return Response(sample_thumbnail(sample_id), media_type="image/png")


@app.get("/api/results/{result_id}/{name}")
def result_file(result_id: str, name: str):
    media = {"output.tif": "image/tiff", "input.png": "image/png", "output.png": "image/png"}
    if not re.fullmatch(r"[0-9a-f]{32}", result_id) or name not in media:
        raise HTTPException(404, "Not found")
    path = RESULTS_DIR / result_id / name
    if not path.exists():
        raise HTTPException(404, "Result not found (results are kept only for the most recent runs)")
    return FileResponse(path, media_type=media[name], filename=name if name == "output.tif" else None)
