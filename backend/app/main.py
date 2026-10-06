"""RESOLVE prototype API: SEN2SR-Lite RGBN x4 super-resolution of Sentinel-2 10 m tiles."""
import io
import json
import os
import re
import shutil
import tempfile
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np
import rasterio
from datetime import datetime, timezone

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.exception_handlers import request_validation_exception_handler
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response
from pydantic import BaseModel
from PIL import Image
from rasterio.errors import RasterioIOError
from rasterio.io import MemoryFile
from rasterio.warp import transform_bounds

from . import alphaearth, area, layers as L
from .lock import lock as measurement_lock
from .model import MODEL_NAME, SCALE, STRIDE, TILE, get_model, padded_size, super_resolve_features, super_resolve_tta

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
    prewarm_alphaearth()
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
    Image.fromarray(img, "RGB").save(buf, "PNG", compress_level=1)
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


def tta_passes(n_tiles: int) -> int:
    """8 dihedral passes; large inputs (more than 16 tiles) use only 4 to bound the run time."""
    n = int(os.environ.get("RESOLVE_TTA", "8"))
    return n if n_tiles <= 16 else min(n, 4)


def _timed_aef(crs, transform, w, h, date):
    t = time.perf_counter()
    res = alphaearth.fetch(crs, transform, w, h, date)
    return res, round((time.perf_counter() - t) * 1000)


def _fallback_features(refl: np.ndarray) -> np.ndarray:
    gy, gx = np.gradient(refl, axis=(1, 2))
    return np.concatenate([refl, np.hypot(gx, gy)])


def write_outputs(d: Path, input_png: bytes, out: np.ndarray, refl: np.ndarray, meta: dict):
    H, W = out.shape[1:]
    lo, hi = np.percentile(refl[:3], [2, 98])
    (d / "input.png").write_bytes(input_png)
    (d / "output.png").write_bytes(to_png(out[:3], lo, hi))
    transform = meta["transform"] @ rasterio.Affine.scale(1 / SCALE)
    with rasterio.open(d / "output.tif", "w", driver="GTiff", count=4, width=W, height=H, dtype="float32",
                       crs=meta["crs"], transform=transform, compress="deflate", zlevel=1, predictor=3) as dst:
        dst.write(out.astype("float32"))
        dst.update_tags(band_order="B4,B3,B2,B8", model=MODEL_NAME, units="surface reflectance 0-1")


_prewarmed = False


def prewarm_alphaearth():
    """Fill the AlphaEarth cache for the bundled samples in the background, so demo clicks are fast.
    Started once, by the first health check (the front end pings it on load)."""
    global _prewarmed
    if _prewarmed or not alphaearth.enabled() or os.environ.get("RESOLVE_AEF_PREWARM", "1") == "0":
        return
    _prewarmed = True

    def work():
        for s in load_samples():
            try:
                with rasterio.open(SAMPLES_DIR / f"{s['id']}.tif") as src:
                    alphaearth.fetch(src.crs, src.transform, src.width, src.height, s.get("date"), budget=120)
            except Exception:
                pass

    threading.Thread(target=work, daemon=True).start()


def run_pipeline(data: bytes, band_order: str, fallback: dict | None = None, input_tif: bytes | None = None) -> dict:
    stages: dict[str, int] = {}
    clock = time.perf_counter

    def tick(name, t0):
        stages[name] = round((clock() - t0) * 1000)

    get_model()  # load before timing
    t0 = clock()
    refl, meta, notes = read_input(data, band_order)
    tick("ingest", t0)
    _, h, w = refl.shape
    H, W = h * SCALE, w * SCALE
    scene = build_scene(meta, w, h, fallback)
    pool = ThreadPoolExecutor(max_workers=2)  # AlphaEarth is fetched, and files written, while the model runs
    aef_future = pool.submit(_timed_aef, meta["crs"], meta["transform"], w, h, scene["date"])
    aef_started = clock()

    t0 = clock()
    lo, hi = np.percentile(refl[:3], [2, 98])
    input_png = to_png(refl[:3].repeat(SCALE, axis=1).repeat(SCALE, axis=2), lo, hi)
    tick("normalise", t0)

    raw, fmap, stages["patching"], stages["backbone"] = super_resolve_features(refl)
    runtime_ms = stages["patching"] + stages["backbone"]

    t0 = clock()
    out, c_before, c_after = measurement_lock(raw, refl)
    tick("lock", t0)

    rid = uuid.uuid4().hex
    RESULTS_DIR.mkdir(exist_ok=True)
    d = RESULTS_DIR / rid
    d.mkdir()
    ld = d / "layers"
    ld.mkdir()
    if input_tif is not None:
        (d / "input.tif").write_bytes(input_tif)
    (ld / "size.json").write_text(json.dumps([H, W]))
    writer = pool.submit(write_outputs, d, input_png, out, refl, meta)  # file output overlaps the TTA passes

    t0 = clock()
    wav = L.haar_energy(out)
    tick("wavelet", t0)

    t0 = clock()
    patches = build_patches(h, w)
    n_tta = tta_passes(patches["count"])
    unc = super_resolve_tta(refl, raw, n_tta).std(0).mean(0)
    tick("uncertainty", t0)

    t0 = clock()
    ndvi, ndwi = L.indices(out)
    lc = L.landcover(out, ndvi, ndwi)
    inf = L.inferred_magnitude(out)
    conf = L.confidence_map(unc, inf)
    conf_stats = {"mean": round(float(conf.mean()), 4), "high_fraction": round(float((conf >= L.CONF_HIGH).mean()), 4)}

    try:
        aef, stages["alphaearth"] = aef_future.result(timeout=max(0.1, alphaearth.budget_s() + 1 - (clock() - aef_started)))
    except Exception:
        aef = alphaearth._result(False, None, "AlphaEarth lookup timed out.")
        stages["alphaearth"] = round(alphaearth.budget_s() * 1000)
    pool.shutdown(wait=False)

    lay: list[dict] = []

    def add(lid, name, group, legend, arr=None, style=None):
        if arr is not None:
            L.save_layer(ld, lid, arr, style)
        lay.append({"id": lid, "name": name, "group": group, "url": f"/api/results/{rid}/layers/{lid}.png", "legend": legend})

    def ramp_style(cm):
        return {"kind": "ramp", "colormap": cm}

    add("rgb", "True colour", "Imagery",
        L.ramp(0, 1, "dark", "bright", "rgb", "Output reflectance B4, B3, B2 with the same stretch as the output preview."))
    add("nir_false", "False colour (NIR, R, G)", "Imagery",
        L.ramp(0, 1, "low", "high", "rgb", "NIR as red, red as green, green as blue; vegetation shows red."),
        L.false_colour(out), {"kind": "rgb"})
    add("ndvi", "NDVI", "Indices",
        L.ramp(-0.2, 0.9, "bare / water", "dense vegetation", "rdylgn", "(NIR - red) / (NIR + red) on the output, stretched -0.2 to 0.9."),
        L._u8(ndvi, -0.2, 0.9), ramp_style("rdylgn"))
    add("ndwi", "NDWI", "Indices",
        L.ramp(-0.6, 0.6, "dry", "water", "blues", "(green - NIR) / (green + NIR) on the output, stretched -0.6 to 0.6."),
        L._u8(ndwi, -0.6, 0.6), ramp_style("blues"))
    add("water", "Water mask", "Land cover",
        L.classes([("Water", "#2563EB"), ("Other", "#94A3B8")],
                  f"NDWI above {L.WATER_NDWI} and NIR reflectance below {L.WATER_NIR_MAX}; other pixels are transparent."),
        (lc != 0).astype("uint8"), {"kind": "classes", "palette": ["#2563EB", None]})
    add("landcover", "Land cover", "Land cover",
        L.classes(L.LC_CLASSES, f"Rule-based: water (NDWI), dense vegetation (NDVI above {L.VEG_DENSE_NDVI}), "
                  f"cropland / sparse (above {L.VEG_SPARSE_NDVI}), otherwise built-up / bare."),
        lc, {"kind": "classes", "palette": [c for _, c in L.LC_CLASSES]})
    add("builtup", "Built-up / bare", "Land cover",
        L.classes([("Built-up / bare", "#B45309"), ("Other", "#94A3B8")],
                  f"Low NDVI, not water, mean visible reflectance above {L.BUILTUP_MIN_BRIGHT}; other pixels are transparent."),
        1 - L.builtup_mask(out, lc), {"kind": "classes", "palette": ["#B45309", None]})
    add("fields", "Field boundaries", "Land cover",
        L.classes([("Field boundary", L.FIELD_COLOR)],
                  "Sobel gradient of smoothed NDVI, thinned by non-maximum suppression; lines on transparent."),
        L.field_edges(ndvi), {"kind": "classes", "palette": [None, L.FIELD_COLOR]})
    wlo, whi = (float(v) for v in np.percentile(wav, [2, 99.5]))
    add("wavelet", "Wavelet detail energy", "Detail",
        L.ramp(wlo, whi, "smooth", "fine detail", "magma", "1-level Haar DWT of luminance: |LH| + |HL| + |HH|, 2nd to 99.5th percentile."),
        L._u8(wav, wlo, whi), ramp_style("magma"))
    if fmap is not None:
        fnote = "Backbone activations (24 channels, 4th of 6 SPAB blocks) reduced to 3 principal components, shown as RGB."
        fm = fmap
    else:
        fnote = "Backbone hook unavailable: PCA of the input bands and their gradients instead."
        fm = _fallback_features(refl)
    add("features", "Backbone features", "Detail",
        L.ramp(0, 1, "component low", "component high", "rgb", fnote), L.pca_rgb(fm), {"kind": "rgb"})
    uhi = float(np.percentile(unc, 98))
    add("uncertainty", "Uncertainty", "Trust",
        L.ramp(0, uhi, "stable", "uncertain", "magma", f"Std dev across {n_tta} test-time dihedral transforms (mean over bands), reflectance units."),
        L._u8(unc, 0, uhi), ramp_style("magma"))
    ihi = float(np.percentile(inf, 98))
    add("inferred", "Observed vs inferred", "Trust",
        L.ramp(0, ihi, "observed", "inferred", "plasma", "Output minus its 4x area average re-expanded bilinearly: detail the 10 m pixels cannot have observed."),
        L._u8(inf, 0, ihi), ramp_style("plasma"))
    add("confidence", "Confidence", "Trust",
        L.ramp(0, 1, "low", "high", "viridis",
               f"1 - ({L.CONF_W_UNC} x scaled uncertainty + {L.CONF_W_INF} x scaled inferred detail), each scaled by its 98th percentile."),
        L._u8(conf, 0, 1), ramp_style("viridis"))
    aef_info = {k: aef[k] for k in ("available", "year", "source", "note")}
    if aef["available"]:
        emb = aef["emb"]
        gate = L._resize(L.gate_map(emb, refl), H, W)
        add("alphaearth", "AlphaEarth embedding", "AlphaEarth",
            L.ramp(0, 1, "component low", "component high", "rgb",
                   f"Prior-year ({aef['year']}) embedding, {emb.shape[0]} of 64 dimensions, as 3 principal components, resampled to the output grid."),
            L.pca_rgb(emb), {"kind": "rgb"})
        add("gate", "Change gate", "AlphaEarth",
            L.ramp(0, 1, "disagrees", "agrees", "rdylgn",
                   "Per-pixel cosine agreement between the embedding (linearly fitted to current reflectance and indices) and the current image."),
            L._u8(gate, 0, 1), ramp_style("rdylgn"))

    writer.result()
    prune_results()
    tick("products", t0)

    notes += [
        "Previews use one 2-98 percentile stretch computed from the input RGB (B4,B3,B2), applied to both.",
        f"The input preview is enlarged {SCALE}x with nearest-neighbour so both previews have the same pixel size.",
        "The output has the measurement lock applied: a Gaussian-PSF back-projection onto the observed pixels.",
    ]
    order = ["ingest", "normalise", "alphaearth", "patching", "backbone", "wavelet", "lock", "uncertainty", "products"]
    return {
        "id": rid,
        "input": {"width": W, "height": H, "png": f"/api/results/{rid}/input.png"},
        "output": {"width": W, "height": H, "png": f"/api/results/{rid}/output.png"},
        "runtime_ms": runtime_ms,
        "model": MODEL_NAME,
        "crs": meta["crs"].to_string() if meta["crs"] else None,
        "notes": notes,
        "scene": scene,
        "patches": patches,
        "layers": lay,
        "stages": [{"id": k, "ms": stages[k]} for k in order],
        "alphaearth": aef_info,
        "confidence": conf_stats,
        "lock": {"consistency_before": round(c_before, 5), "consistency_after": round(c_after, 5), "applied": True},
    }


@app.post("/api/superres")
def superres(file: UploadFile = File(...), band_order: str = Form("B4,B3,B2,B8")):
    return run_pipeline(file.file.read(), band_order)


@app.post("/api/samples/{sample_id}/superres")
def sample_superres(sample_id: str):
    sample = find_sample(sample_id)
    return run_pipeline((SAMPLES_DIR / f"{sample_id}.tif").read_bytes(), "B4,B3,B2,B8", sample)


class AreaRequest(BaseModel):
    lat: float
    lon: float
    size_px: int = 256
    date_from: str | None = None
    date_to: str | None = None
    max_cloud: float = 20
    name: str | None = None


def _parse_day(text: str | None, field: str):
    if text is None:
        return None
    try:
        return datetime.strptime(text, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(422, f"{field} must be a date in YYYY-MM-DD format")


def validate_area(req: AreaRequest):
    if not -84 <= req.lat <= 84:
        raise HTTPException(422, "lat must be between -84 and 84 (Sentinel-2 coverage)")
    if not -180 <= req.lon <= 180:
        raise HTTPException(422, "lon must be between -180 and 180")
    if req.size_px not in (256, 512):
        raise HTTPException(422, "size_px must be 256 or 512")
    if not 0 <= req.max_cloud <= 100:
        raise HTTPException(422, "max_cloud must be between 0 and 100")
    d_from, d_to = _parse_day(req.date_from, "date_from"), _parse_day(req.date_to, "date_to")
    today = datetime.now(timezone.utc).date()
    if d_from and d_to and d_from > d_to:
        raise HTTPException(422, "date_from must not be after date_to")
    if (d_from and d_from > today) or (d_to and d_to > today):
        raise HTTPException(422, "The date range must not be in the future")
    return d_from, d_to


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, exc: RequestValidationError):
    """A readable string for the area endpoint; other routes keep FastAPI's default list."""
    if request.url.path != "/api/area/superres":
        return await request_validation_exception_handler(request, exc)
    first = exc.errors()[0]
    where = ".".join(str(p) for p in first["loc"] if p != "body") or "body"
    return JSONResponse({"detail": f"Invalid {where}: {first['msg']}"}, status_code=422)


@app.post("/api/area/superres")
def area_superres(req: AreaRequest):
    d_from, d_to = validate_area(req)
    t0 = time.perf_counter()
    try:
        sc = area.search_scene(req.lat, req.lon, req.size_px, d_from, d_to, req.max_cloud)
    except area.AreaError as e:
        raise HTTPException(e.status, e.detail)
    except Exception as e:
        raise HTTPException(503, f"Sentinel-2 search failed ({type(e).__name__}). Try again in a moment.")
    search_ms = round((time.perf_counter() - t0) * 1000)
    with MemoryFile() as mem:
        with mem.open(driver="GTiff", count=4, height=req.size_px, width=req.size_px, dtype="float32", crs=sc.crs,
                      transform=sc.transform, compress="deflate", predictor=3) as dst:
            dst.write(sc.refl)
            dst.update_tags(band_order="B4,B3,B2,B8", processing_baseline=sc.processing_baseline or "",
                            reflectance_offset_applied=str(sc.offset_applied_dn), source_item=sc.item_id)
        tif = mem.read()
    body = run_pipeline(tif, "B4,B3,B2,B8", {"date": sc.date, "source_item": sc.item_id}, input_tif=tif)
    body["scene"]["satellite"] = sc.satellite or body["scene"]["satellite"]
    body["source_scene"] = {"item_id": sc.item_id, "date": sc.date, "satellite": body["scene"]["satellite"],
                            "tile_id": sc.tile_id or body["scene"]["tile_id"], "cloud_cover": sc.cloud_cover,
                            "window_cloud_fraction": sc.window_cloud_fraction,
                            "processing_baseline": sc.processing_baseline, "relaxed_cloud": sc.relaxed_cloud}
    body["name"] = (req.name or "").strip() or f"{req.lat:.4f}, {req.lon:.4f}"
    off = (f"Processing baseline {sc.processing_baseline}: subtracted the L2A offset of 1000 DN, then divided by 10 000."
           if sc.offset_applied_dn else "Processing baseline below 04.00: no L2A offset; divided by 10 000.")
    body["notes"] = [f"Sentinel-2 window read from Microsoft Planetary Computer ({sc.item_id}); {off}"] + sc.notes + body["notes"]
    body["stages"].insert(0, {"id": "search", "ms": search_ms})
    return body


@app.get("/api/samples/{sample_id}/input.png")
def sample_input_png(sample_id: str):
    find_sample(sample_id)
    return Response(sample_thumbnail(sample_id), media_type="image/png")


@app.get("/api/results/{result_id}/{name}")
def result_file(result_id: str, name: str):
    media = {"output.tif": "image/tiff", "input.tif": "image/tiff", "input.png": "image/png", "output.png": "image/png"}
    if not re.fullmatch(r"[0-9a-f]{32}", result_id) or name not in media:
        raise HTTPException(404, "Not found")
    path = RESULTS_DIR / result_id / name
    if not path.exists():
        raise HTTPException(404, "Result not found (results are kept only for the most recent runs)")
    return FileResponse(path, media_type=media[name], filename=name if name.endswith(".tif") else None)


@app.get("/api/results/{result_id}/layers/{layer_id}.png")
def result_layer(result_id: str, layer_id: str):
    if not re.fullmatch(r"[0-9a-f]{32}", result_id) or not re.fullmatch(r"[a-z_]{1,32}", layer_id):
        raise HTTPException(404, "Not found")
    d = RESULTS_DIR / result_id
    cache = {"Cache-Control": "public, max-age=3600"}
    if layer_id == "rgb":
        path = d / "output.png"
        if not path.exists():
            raise HTTPException(404, "Result not found (results are kept only for the most recent runs)")
        return FileResponse(path, media_type="image/png", headers=cache)
    size_path = d / "layers" / "size.json"
    if not size_path.exists():
        raise HTTPException(404, "Result not found (results are kept only for the most recent runs)")
    rendered = L.render_layer(d / "layers", layer_id, tuple(json.loads(size_path.read_text())))
    if rendered is None:
        raise HTTPException(404, "Unknown layer for this result")
    body, media = rendered
    return Response(body, media_type=media, headers=cache)
