"""Area selection -> Sentinel-2 L2A window from Microsoft Planetary Computer (STAC, no key).

search_scene() finds the best clear scene for a square of size_px x 10 m around a point and reads only that window
(B04, B03, B02, B08 at 10 m, SCL at 20 m resampled to 10 m) with HTTP range requests. It returns reflectance (4, n, n)
float32 in the order B4, B3, B2, B8, the tile georeferencing and the scene metadata, or raises AreaError.
"""
import math
import os
import time
from concurrent.futures import ThreadPoolExecutor, wait
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from functools import lru_cache

import numpy as np
import rasterio
from rasterio.crs import CRS
from rasterio.enums import Resampling
from rasterio.transform import Affine
from rasterio.warp import transform as warp_transform
from rasterio.windows import Window

STAC_URL = os.environ.get("RESOLVE_STAC_URL", "https://planetarycomputer.microsoft.com/api/stac/v1")
COLLECTION = "sentinel-2-l2a"
BANDS = ["B04", "B03", "B02", "B08"]  # becomes B4, B3, B2, B8
PIXEL = 10
DEFAULT_WINDOW_DAYS = 120
RELAXED_CLOUD = 60
MAX_CANDIDATES = 5
LOOKAHEAD = 2  # candidates read concurrently
MAX_NODATA = 0.01
MAX_WINDOW_CLOUD = 0.10
CLOUD_CLASSES = (3, 8, 9, 10)  # SCL: cloud shadow, cloud medium / high probability, thin cirrus
NO_SCENE = "No clear Sentinel-2 scene found for this area and date range. Try a wider date range or a higher cloud limit."
GDAL_ENV = dict(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".tif,.tiff",
                GDAL_HTTP_TIMEOUT="15", GDAL_HTTP_MAX_RETRY="2", GDAL_HTTP_RETRY_DELAY="0.5",
                GDAL_HTTP_MULTIPLEX="YES", GDAL_HTTP_MERGE_CONSECUTIVE_RANGES="YES", GDAL_NUM_THREADS="1")


class AreaError(Exception):
    def __init__(self, status: int, detail: str):
        super().__init__(detail)
        self.status, self.detail = status, detail


@dataclass
class Scene:
    refl: np.ndarray  # (4, n, n) float32, 0-1 surface reflectance, B4 B3 B2 B8
    crs: CRS
    transform: Affine
    item_id: str
    date: str
    satellite: str | None
    tile_id: str | None
    cloud_cover: float
    window_cloud_fraction: float
    processing_baseline: str | None
    relaxed_cloud: bool
    offset_applied_dn: int
    notes: list[str] = field(default_factory=list)


def total_budget(size_px: int) -> float:
    base = float(os.environ.get("RESOLVE_AREA_TIMEOUT_S", "20"))
    return base * (size_px / 256) ** 1.0


def resolve_dates(date_from: date | None, date_to: date | None, today: date) -> tuple[date, date, bool]:
    """(start, end, latest_mode). Latest mode = no dates given: the last 120 days, most recent clear scene first."""
    if date_from is None and date_to is None:
        return today - timedelta(days=DEFAULT_WINDOW_DAYS), today, True
    end = date_to or today
    start = date_from or end - timedelta(days=DEFAULT_WINDOW_DAYS)
    return start, end, False


@lru_cache(maxsize=1)
def _catalog():
    import planetary_computer
    import pystac_client
    return pystac_client.Client.open(STAC_URL, modifier=planetary_computer.sign_inplace, timeout=12)


def _search(lat: float, lon: float, start: date, end: date, max_cloud: float, latest: bool) -> list:
    """Items for the point, cloud <= max(max_cloud, 60). Latest mode asks the server for newest first."""
    kw = dict(collections=[COLLECTION], intersects={"type": "Point", "coordinates": [lon, lat]},
              datetime=f"{start.isoformat()}/{end.isoformat()}",
              query={"eo:cloud_cover": {"lte": max(max_cloud, RELAXED_CLOUD)}}, max_items=60, limit=60)
    if latest:
        kw["sortby"] = [{"field": "datetime", "direction": "desc"}]
    return list(_catalog().search(**kw).items())


def _epsg(item) -> int:
    p = item.properties
    code = p.get("proj:epsg") or str(p.get("proj:code", "")).split(":")[-1]
    return int(code)


def rank(items: list, max_cloud: float, latest: bool) -> list[tuple[object, bool]]:
    """[(item, relaxed)] in try order: within the cloud limit first, then (only if needed) up to 60 %.
    Latest mode: newest first. Range mode: lowest cloud first, newest on ties."""
    def key(i):
        c = i.properties.get("eo:cloud_cover", 100.0)
        return -i.datetime.timestamp() if latest else (c, -i.datetime.timestamp())

    strict = sorted((i for i in items if i.properties.get("eo:cloud_cover", 100.0) <= max_cloud), key=key)
    loose = sorted((i for i in items if i.properties.get("eo:cloud_cover", 100.0) > max_cloud), key=key)
    return [(i, False) for i in strict] + [(i, True) for i in loose]


def window_geometry(item, lat: float, lon: float, size: int):
    """(col0, row0, tile transform, crs) of the size x size window centred on the point in the item's 10 m grid,
    snapped to the 20 m grid so the SCL window is integral; None if the tile does not contain the whole square."""
    epsg = _epsg(item)
    a = item.assets["B04"].extra_fields
    t = a["proj:transform"]
    rows, cols = a["proj:shape"]
    x, y = warp_transform("EPSG:4326", f"EPSG:{epsg}", [lon], [lat])
    col0 = 2 * round((((x[0] - t[2]) / PIXEL) - size / 2) / 2)
    row0 = 2 * round((((t[5] - y[0]) / PIXEL) - size / 2) / 2)
    if col0 < 0 or row0 < 0 or col0 + size > cols or row0 + size > rows:
        return None
    return col0, row0, Affine(PIXEL, 0, t[2] + col0 * PIXEL, 0, -PIXEL, t[5] - row0 * PIXEL), CRS.from_epsg(epsg)


def _read_band(href: str, col0: int, row0: int, size: int, scl: bool) -> np.ndarray:
    """One window of one COG; a single retry covers the occasional truncated range response."""
    try:
        return _read_band_once(href, col0, row0, size, scl)
    except rasterio.errors.RasterioIOError:
        return _read_band_once(href, col0, row0, size, scl)


def _read_band_once(href: str, col0: int, row0: int, size: int, scl: bool) -> np.ndarray:
    with rasterio.Env(**GDAL_ENV):
        with rasterio.open(href) as src:
            if scl:
                return src.read(1, window=Window(col0 // 2, row0 // 2, size // 2, size // 2), out_shape=(size, size),
                                resampling=Resampling.nearest)
            return src.read(1, window=Window(col0, row0, size, size))


def _read_candidate(item, geom, size: int, pool: ThreadPoolExecutor, deadline: float):
    """(dn (4,n,n) uint16, scl (n,n)) or raises; waits for the five band reads until the deadline."""
    col0, row0 = geom[0], geom[1]
    futs = [pool.submit(_read_band, item.assets[b].href, col0, row0, size, False) for b in BANDS]
    futs.append(pool.submit(_read_band, item.assets["SCL"].href, col0, row0, size, True))
    done, pending = wait(futs, timeout=max(0.1, deadline - time.perf_counter()))
    if pending:
        for f in pending:
            f.cancel()
        raise TimeoutError("band reads timed out")
    res = [f.result() for f in futs]
    return np.stack(res[:4]), res[4]


def assess(dn: np.ndarray, scl: np.ndarray) -> tuple[float, float]:
    """(nodata fraction, SCL cloud / shadow / cirrus fraction) of a window."""
    nodata = float((dn == 0).any(axis=0).mean())
    cloud = float(np.isin(scl, CLOUD_CLASSES).mean())
    return nodata, cloud


def to_reflectance(dn: np.ndarray, baseline: str | None) -> tuple[np.ndarray, int]:
    """Same convention as scripts/fetch_samples.py: baseline >= 04.00 carries a +1000 DN offset."""
    try:
        offset = 1000 if baseline is not None and float(baseline) >= 4.0 else 0
    except ValueError:
        offset = 0
    return (np.clip(dn.astype("float32") - offset, 0, None) / 10000.0).astype("float32"), offset


def search_scene(lat: float, lon: float, size: int, date_from: date | None, date_to: date | None,
                 max_cloud: float, today: date | None = None, budget: float | None = None) -> Scene:
    today = today or datetime.now(timezone.utc).date()
    start, end, latest = resolve_dates(date_from, date_to, today)
    budget = budget or total_budget(size)
    t0 = time.perf_counter()
    deadline = t0 + budget
    pool = ThreadPoolExecutor(max_workers=24)
    try:
        # the STAC search itself runs in a worker so that a hung connection cannot outlive the deadline
        sf = pool.submit(_search, lat, lon, start, end, max_cloud, latest)
        done, _ = wait([sf], timeout=budget)
        if not done:
            raise AreaError(503, "The Planetary Computer catalogue did not answer in time. Try again in a moment.")
        try:
            items = sf.result()
        except Exception as e:
            raise AreaError(503, f"The Planetary Computer catalogue is unavailable ({type(e).__name__}). Try again in a moment.")

        cands = []
        for item, relaxed in rank(items, max_cloud, latest):
            try:
                geom = window_geometry(item, lat, lon, size)
            except Exception:
                continue
            if geom is not None:  # tiles that do not contain the whole square would have nodata in the window
                cands.append((item, relaxed, geom))
            if len(cands) == MAX_CANDIDATES:
                break
        if not cands:
            raise AreaError(404, NO_SCENE)

        pending = {}
        for k in range(min(LOOKAHEAD, len(cands))):
            pending[k] = pool.submit(_read_candidate, cands[k][0], cands[k][2], size, pool, deadline)
        errors = rejected = 0
        for k, (item, relaxed, geom) in enumerate(cands):
            nxt = k + LOOKAHEAD
            if nxt < len(cands) and nxt not in pending:
                pending[nxt] = pool.submit(_read_candidate, cands[nxt][0], cands[nxt][2], size, pool, deadline)
            if time.perf_counter() > deadline:
                break
            try:
                dn, scl = pending[k].result(timeout=max(0.1, deadline - time.perf_counter()))
            except Exception:
                errors += 1
                continue
            if dn.shape != (4, size, size) or scl.shape != (size, size):
                errors += 1
                continue
            nodata, cloud = assess(dn, scl)
            if nodata > MAX_NODATA or cloud > MAX_WINDOW_CLOUD:
                rejected += 1
                continue
            p = item.properties
            baseline = p.get("s2:processing_baseline")
            refl, offset = to_reflectance(dn, baseline)
            plat = p.get("platform")
            notes = []
            if relaxed:
                notes.append(f"No scene under {max_cloud:g} % scene cloud had a clear window; accepted {p.get('eo:cloud_cover', 0):.0f} %.")
            return Scene(refl=refl, crs=geom[3], transform=geom[2], item_id=item.id, date=item.datetime.date().isoformat(),
                         satellite=plat, tile_id=("T" + p["s2:mgrs_tile"]) if p.get("s2:mgrs_tile") else None,
                         cloud_cover=round(float(p.get("eo:cloud_cover", 0.0)), 2), window_cloud_fraction=round(cloud, 4),
                         processing_baseline=baseline, relaxed_cloud=relaxed, offset_applied_dn=offset, notes=notes)
        if errors and not rejected:
            raise AreaError(503, "Sentinel-2 imagery could not be read from the Planetary Computer in time. Try again in a moment.")
        raise AreaError(404, NO_SCENE)
    finally:
        pool.shutdown(wait=False, cancel_futures=True)
