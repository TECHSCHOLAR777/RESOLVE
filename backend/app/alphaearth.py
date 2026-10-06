"""AlphaEarth Foundations Satellite Embedding V1 (annual) window reader. Best effort, never raises.

Data: Cloud-Optimized GeoTIFFs on Source Cooperative (`tge-labs/aef`, also the AWS Open Data bucket), one
8192x8192 px, 64-band, int8 file per UTM zone cell, year and 81.92 km grid square at 10 m, bottom-up
(row 0 is the southern edge). Bands are stored planar (one 1024x1024 ZSTD tile per band, ~0.6 MB each),
so reading K bands costs about K x 0.6 MB per tile touched; reading all 64 would be ~37 MB.
We therefore read the first AEF_BANDS (default 8) dimensions in parallel within a time budget.
Values: int8 -> float via sign(v) * (v / 127.5)^2; -128 is masked.
"""
import gzip
import hashlib
import json
import math
import os
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor, wait
from functools import lru_cache
from pathlib import Path

import numpy as np
import rasterio
from rasterio.crs import CRS
from rasterio.enums import Resampling
from rasterio.transform import Affine
from rasterio.warp import reproject, transform, transform_bounds
from rasterio.windows import Window

INDEX_PATH = Path(__file__).resolve().parent / "data" / "aef_index.json.gz"
BASE_URL = os.environ.get(
    "AEF_BASE_URL", "https://s3.us-west-2.amazonaws.com/us-west-2.opendata.source.coop/tge-labs/aef/v1/annual")
CACHE_DIR = Path(tempfile.gettempdir()) / "resolve_aef_cache"
FIRST_YEAR, LAST_YEAR = 2017, 2025
GRID, WEST0, PIX = 81920, 8480, 10  # file footprint (m), grid origin easting, pixel size (m)
FILE_PX = 8192
SOUTH0 = {"N": 0, "S": 5760}  # northing origin of the file grid per hemisphere (m)
SOURCE = "AlphaEarth Foundations Satellite Embedding V1 annual (Google / Google DeepMind, CC-BY 4.0), via Source Cooperative tge-labs/aef"
GDAL_ENV = dict(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".tif,.tiff",
                GDAL_HTTP_TIMEOUT="10", GDAL_HTTP_MAX_RETRY="0", GDAL_HTTP_MULTIPLEX="YES")
_failures: dict[str, float] = {}  # cache key -> time of last failure, to avoid hammering a dead network


def enabled() -> bool:
    return os.environ.get("RESOLVE_ALPHAEARTH", "1").lower() not in ("0", "off", "false", "no")


def n_bands() -> int:
    return max(3, min(64, int(os.environ.get("AEF_BANDS", "8"))))


def budget_s() -> float:
    return float(os.environ.get("AEF_TIMEOUT_S", "10"))


def target_year(date: str | None) -> int:
    """Embedding year = acquisition year minus 1 (the embedding is the prior-year context), clamped."""
    year = int(date[:4]) - 1 if date and date[:4].isdigit() else 2024
    return max(FIRST_YEAR, min(LAST_YEAR, year))


@lru_cache(maxsize=1)
def _index() -> dict:
    with gzip.open(INDEX_PATH, "rt") as f:
        return json.load(f)


@lru_cache(maxsize=64)
def cells(year: int, zone: str) -> dict[tuple[int, int], str] | None:
    """(grid column, grid row) -> file name stem for one year and UTM zone ('43N', '23S'), or None if absent.
    The bundled index stores 2x2 export blocks [hash, cx0, cy0, mask]; see scripts/build_aef_index.py."""
    blocks = _index()["blocks"].get(f"{year}/{zone}")
    if blocks is None:
        return None
    out = {}
    for h, cx0, cy0, mask in blocks:
        for dy in (0, 1):
            for dx in (0, 1):
                if mask >> (dy * 2 + dx) & 1:
                    out[(cx0 + dx, cy0 + dy)] = f"{h}-{dy * FILE_PX:010d}-{dx * FILE_PX:010d}"
    return out


def locate(lat: float, lon: float, year: int) -> str | None:
    """URL of the AlphaEarth file covering a WGS84 point in a year, or None. Used by tests and diagnostics."""
    zone_n = int((lon + 180) // 6) % 60 + 1
    hemi = "N" if lat >= 0 else "S"
    zone = f"{zone_n}{hemi}"
    x, y = transform(CRS.from_epsg(4326), CRS.from_epsg((32600 if hemi == "N" else 32700) + zone_n), [lon], [lat])
    c = cells(year, zone)
    if not c:
        return None
    name = c.get((math.floor((x[0] / PIX - WEST0 / PIX) / FILE_PX), math.floor((y[0] / PIX - SOUTH0[hemi] / PIX) / FILE_PX)))
    return f"{BASE_URL}/{year}/{zone}/{name}.tiff" if name else None


def _result(available: bool, year, note, emb=None, source=None) -> dict:
    return {"available": available, "year": year if available else None,
            "source": source if available else None, "note": note, "emb": emb}


def _zone_crs(crs, bounds) -> tuple[str, str]:
    """(UTM zone like '43N', its EPSG code) for the tile."""
    epsg = crs.to_epsg()
    if epsg and 32601 <= epsg <= 32660:
        return f"{epsg - 32600}N", f"EPSG:{epsg}"
    if epsg and 32701 <= epsg <= 32760:
        return f"{epsg - 32700}S", f"EPSG:{epsg}"
    west, south, east, north = transform_bounds(crs, "EPSG:4326", *bounds)
    lon, lat = (west + east) / 2, (south + north) / 2
    zone = int((lon + 180) // 6) % 60 + 1
    return (f"{zone}N", f"EPSG:{32600 + zone}") if lat >= 0 else (f"{zone}S", f"EPSG:{32700 + zone}")


def _read_cell_band(url: str, window: Window, band: int) -> np.ndarray:
    """One band of one window of one COG, as raw int8. The seam the tests patch."""
    with rasterio.Env(**GDAL_ENV):
        with rasterio.open(url) as src:
            return src.read(band + 1, window=window)


def _dequantise(raw: np.ndarray) -> np.ndarray:
    v = raw.astype("float32")
    out = np.sign(v) * (v / 127.5) ** 2
    out[raw == -128] = np.nan
    return out


def fetch(crs, transform, w: int, h: int, date: str | None, budget: float | None = None) -> dict:
    """Embedding resampled to the tile's own grid: dict(available, year, source, note, emb (K,h,w) float32)."""
    year = target_year(date)
    if not enabled():
        return _result(False, year, "AlphaEarth lookup is switched off on this server.")
    if crs is None:
        return _result(False, year, "File has no CRS, so the embedding cannot be located.")
    t0 = time.perf_counter()
    try:
        key = hashlib.sha1(f"{crs.to_string()}|{tuple(transform)[:6]}|{w}x{h}|{year}".encode()).hexdigest()[:20]
        cached = CACHE_DIR / f"{key}.npy"
        if cached.exists():
            emb = np.load(cached).astype("float32")
            return _result(True, year, f"Read {emb.shape[0]} of 64 dimensions (cached).", emb, SOURCE)
        if time.time() - _failures.get(key, 0) < 60:
            return _result(False, year, "AlphaEarth data was unreachable moments ago; not retried yet.")
        res = _fetch_uncached(crs, transform, w, h, year, t0 + (budget or budget_s()))
        if res["available"] and res["emb"].shape[0] >= n_bands():
            CACHE_DIR.mkdir(exist_ok=True)
            np.save(cached, res["emb"].astype("float16"))
        elif not res["available"]:
            _failures[key] = time.time()
        return res
    except Exception as e:  # never fail the request
        return _result(False, year, f"AlphaEarth lookup failed ({type(e).__name__}).")


def _fetch_uncached(crs, transform, w: int, h: int, year: int, deadline: float) -> dict:
    left, top = transform.c, transform.f
    right, bottom = left + transform.a * w, top + transform.e * h
    zone, zcrs = _zone_crs(crs, (left, bottom, right, top))
    cell_names = cells(year, zone)
    if cell_names is None:
        return _result(False, year, f"Zone {zone} has no AlphaEarth files for {year} in the bundled index.")
    off = SOUTH0[zone[-1]] // PIX  # grid rows are offset from the northing origin in the southern hemisphere
    zl, zb, zr, zt = (left, bottom, right, top) if zcrs == crs.to_string() else transform_bounds(crs, zcrs, left, bottom, right, top)
    pad = 2 * PIX  # a little context for resampling
    c0, c1 = math.floor((zl - pad - WEST0) / PIX), math.ceil((zr + pad - WEST0) / PIX)
    r0, r1 = math.floor((zb - pad) / PIX), math.ceil((zt + pad) / PIX)  # global rows, northing upward
    K = n_bands()
    canvas = np.full((K, r1 - r0, c1 - c0), np.nan, "float32")
    tasks = []
    for ky in range((r0 - off) // FILE_PX, (r1 - 1 - off) // FILE_PX + 1):
        for kx in range(c0 // FILE_PX, (c1 - 1) // FILE_PX + 1):
            name = cell_names.get((kx, ky))
            if name is None:
                continue
            fy = ky * FILE_PX + off  # global row of the file's southern edge
            gx0, gx1 = max(c0, kx * FILE_PX), min(c1, (kx + 1) * FILE_PX)
            gy0, gy1 = max(r0, fy), min(r1, fy + FILE_PX)
            win = Window(gx0 - kx * FILE_PX, gy0 - fy, gx1 - gx0, gy1 - gy0)
            tasks.append((f"{BASE_URL}/{year}/{zone}/{name}.tiff", win, (gy0 - r0, gy1 - r0, gx0 - c0, gx1 - c0)))
    if not tasks:
        return _result(False, year, "No AlphaEarth file covers this tile (ocean or outside the dataset).")

    ex = ThreadPoolExecutor(max_workers=min(K * len(tasks), 8))
    jobs = {}  # future -> (band, slice)
    for b in range(K):  # lowest dimensions first, so a timeout still leaves a usable prefix
        for url, win, sl in tasks:
            jobs[ex.submit(_read_cell_band, url, win, b)] = (b, sl)
    done, _ = wait(list(jobs), timeout=max(0.1, deadline - time.perf_counter()))
    ex.shutdown(wait=False, cancel_futures=True)
    ok = {}
    for f in done:
        b, sl = jobs[f]
        if f.exception() is None:
            ok.setdefault(b, []).append((sl, f.result()))
    good = [b for b in range(K) if len(ok.get(b, [])) == len(tasks)]
    prefix = []
    for b in range(K):  # keep a contiguous prefix of dimensions
        if b not in good:
            break
        prefix.append(b)
    if len(prefix) < 3:
        return _result(False, year, "AlphaEarth data could not be read in time (network).")
    for b in prefix:
        for (y0, y1, x0, x1), raw in ok[b]:
            canvas[b, y0:y1, x0:x1] = _dequantise(raw)
    canvas = canvas[prefix]
    src_tf = Affine(PIX, 0, WEST0 + c0 * PIX, 0, -PIX, (r1) * PIX)  # flip rows to top-down
    emb = np.full((len(prefix), h, w), np.nan, "float32")
    for i in range(len(prefix)):
        reproject(canvas[i, ::-1].copy(), emb[i], src_transform=src_tf, src_crs=zcrs, dst_transform=transform,
                  dst_crs=crs, resampling=Resampling.bilinear, src_nodata=np.nan, dst_nodata=np.nan)
    if np.isnan(emb[0]).mean() > 0.5:
        return _result(False, year, "AlphaEarth has no valid pixels here (masked).")
    note = f"Read {len(prefix)} of 64 dimensions at 10 m (A00 to A{len(prefix) - 1:02d}); window only, no full-file download."
    return _result(True, year, note, emb, SOURCE)
