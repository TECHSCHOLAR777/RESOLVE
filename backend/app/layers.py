"""Analysis layers derived from the super-resolved tile. Everything is plain numpy (+ torch for resampling).

Layers are computed once when the result is made and stored as small uint8 arrays; PNGs are rendered
and cached on first GET (see render_layer).
"""
import io
import json
from pathlib import Path

import numpy as np
import torch
import torch.nn.functional as F
from PIL import Image

WATER_NDWI = 0.1  # NDWI above this (and a dark NIR) is water
WATER_NIR_MAX = 0.25
VEG_DENSE_NDVI, VEG_SPARSE_NDVI = 0.5, 0.2
BUILTUP_MIN_BRIGHT = 0.10  # mean visible reflectance
LC_CLASSES = [("Water", "#2563EB"), ("Dense vegetation", "#15803D"),
              ("Cropland / sparse vegetation", "#A3E635"), ("Built-up / bare", "#B45309")]
CONF_HIGH = 0.8
CONF_W_UNC, CONF_W_INF = 0.6, 0.4
FIELD_COLOR = "#FACC15"
MPL_NAMES = {"rdylgn": "RdYlGn", "blues": "Blues"}

_lut_cache: dict[str, np.ndarray] = {}


def ramp(lo, hi, lo_label, hi_label, colormap, note=None) -> dict:
    d = {"type": "ramp", "min": round(float(lo), 4), "max": round(float(hi), 4), "min_label": lo_label,
         "max_label": hi_label, "colormap": colormap}
    return {**d, "note": note} if note else d


def classes(items, note=None) -> dict:
    d = {"type": "classes", "classes": [{"label": a, "color": b} for a, b in items]}
    return {**d, "note": note} if note else d


def _resize(a: np.ndarray, h: int, w: int) -> np.ndarray:
    """Bilinear resize of (H,W) or (C,H,W) float array."""
    t = torch.from_numpy(np.ascontiguousarray(a, dtype="float32"))
    t = t[None, None] if t.ndim == 2 else t[None]
    return F.interpolate(t, size=(h, w), mode="bilinear", align_corners=False)[0].squeeze(0).numpy()


def _u8(a: np.ndarray, lo: float, hi: float) -> np.ndarray:
    return (np.clip((a - lo) / max(hi - lo, 1e-9), 0, 1) * 255).round().astype("uint8")


def _blur(a: np.ndarray, sigma: float) -> np.ndarray:
    r = int(np.ceil(3 * sigma))
    x = torch.arange(-r, r + 1, dtype=torch.float32)
    k = torch.exp(-x * x / (2 * sigma * sigma))
    k /= k.sum()
    t = F.pad(torch.from_numpy(a)[None, None], (r, r, r, r), mode="reflect")
    t = F.conv2d(F.conv2d(t, k.view(1, 1, 1, -1)), k.view(1, 1, -1, 1))
    return t[0, 0].numpy()


# ---- indices and rule-based classes -----------------------------------------------------------

def indices(out: np.ndarray):
    r, g, _, n = out
    return (n - r) / (n + r + 1e-6), (g - n) / (g + n + 1e-6)


def landcover(out: np.ndarray, ndvi: np.ndarray, ndwi: np.ndarray) -> np.ndarray:
    """uint8 class map: 0 water, 1 dense vegetation, 2 cropland / sparse vegetation, 3 built-up / bare."""
    cls = np.full(ndvi.shape, 3, "uint8")
    cls[ndvi > VEG_SPARSE_NDVI] = 2
    cls[ndvi > VEG_DENSE_NDVI] = 1
    cls[(ndwi > WATER_NDWI) & (out[3] < WATER_NIR_MAX)] = 0
    return cls


def builtup_mask(out: np.ndarray, lc: np.ndarray) -> np.ndarray:
    return ((lc == 3) & (out[:3].mean(0) > BUILTUP_MIN_BRIGHT)).astype("uint8")


def false_colour(out: np.ndarray) -> np.ndarray:
    """NIR-R-G composite, uint8 (H,W,3), 2-98 percentile stretch per band."""
    comp = np.stack([out[3], out[0], out[1]])
    lo, hi = np.percentile(comp, [2, 98], axis=(1, 2))
    return np.stack([_u8(c, l, h) for c, l, h in zip(comp, lo, hi)], -1)


def field_edges(ndvi: np.ndarray) -> np.ndarray:
    """Approximate field boundaries: Sobel gradient of smoothed NDVI, non-maximum suppressed, thresholded."""
    s = _blur(ndvi.astype("float32"), 2.0)
    p = np.pad(s, 1, mode="edge")
    gx = (p[:-2, 2:] + 2 * p[1:-1, 2:] + p[2:, 2:] - p[:-2, :-2] - 2 * p[1:-1, :-2] - p[2:, :-2]) / 8
    gy = (p[2:, :-2] + 2 * p[2:, 1:-1] + p[2:, 2:] - p[:-2, :-2] - 2 * p[:-2, 1:-1] - p[:-2, 2:]) / 8
    mag = np.hypot(gx, gy)
    thr = max(float(np.percentile(mag, 92)), 0.01)
    ang = (np.degrees(np.arctan2(gy, gx)) + 180) % 180  # gradient direction, 0..180
    q = ((ang + 22.5) // 45).astype(int) % 4  # 0: horizontal grad, 1: 45 deg, 2: vertical, 3: 135 deg
    m = np.pad(mag, 1)
    shifts = [((0, 1), (0, -1)), ((1, 1), (-1, -1)), ((1, 0), (-1, 0)), ((1, -1), (-1, 1))]
    keep = np.zeros(mag.shape, bool)
    H, W = mag.shape
    for i, (a, b) in enumerate(shifts):
        na = m[1 + a[0]:1 + a[0] + H, 1 + a[1]:1 + a[1] + W]
        nb = m[1 + b[0]:1 + b[0] + H, 1 + b[1]:1 + b[1] + W]
        keep |= (q == i) & (mag >= na) & (mag >= nb)
    edge = keep & (mag >= thr)
    d = edge.copy()  # thicken to ~2 px so the lines read at full size
    d[:-1] |= edge[1:]
    d[:, :-1] |= edge[:, 1:]
    d[:-1, :-1] |= edge[1:, 1:]
    return d.astype("uint8")


# ---- detail / trust layers --------------------------------------------------------------------

def haar_energy(out: np.ndarray) -> np.ndarray:
    """1-level Haar DWT of luminance; |LH|+|HL|+|HH| at half size, bilinearly upsampled to full size."""
    lum = (0.2126 * out[0] + 0.7152 * out[1] + 0.0722 * out[2]).astype("float32")
    H, W = (lum.shape[0] // 2) * 2, (lum.shape[1] // 2) * 2
    a, b, c, d = lum[0:H:2, 0:W:2], lum[0:H:2, 1:W:2], lum[1:H:2, 0:W:2], lum[1:H:2, 1:W:2]
    lh, hl, hh = (a + b - c - d) / 2, (a - b + c - d) / 2, (a - b - c + d) / 2
    e = np.abs(lh) + np.abs(hl) + np.abs(hh)
    return _resize(e, lum.shape[0], lum.shape[1])


def inferred_magnitude(out: np.ndarray, scale: int = 4) -> np.ndarray:
    """|output - bilinear(area-average(output, scale))|, mean over bands: the part the pixels cannot have observed."""
    t = torch.from_numpy(np.ascontiguousarray(out))[None]
    low = F.avg_pool2d(t, scale)
    up = F.interpolate(low, size=t.shape[-2:], mode="bilinear", align_corners=False)
    return (t - up).abs().mean(1)[0].numpy()


def pca_rgb(x: np.ndarray) -> np.ndarray:
    """x (C,h,w) -> uint8 (h,w,3): top 3 principal components (SVD of the centred data), 2-98 percentile stretch."""
    C, h, w = x.shape
    m = x.reshape(C, -1).T.astype("float64")
    m = np.where(np.isfinite(m), m, np.nanmean(m, axis=0, keepdims=True))
    m -= m.mean(0)
    _, _, vt = np.linalg.svd(m, full_matrices=False)
    proj = (m @ vt[:3].T).T.reshape(3, h, w)
    lo, hi = np.percentile(proj, [2, 98], axis=(1, 2))
    return np.stack([_u8(p, l, hh) for p, l, hh in zip(proj, lo, hi)], -1)


def confidence_map(unc: np.ndarray, inf: np.ndarray):
    """0..1 confidence (1 = confident) from uncertainty and inferred magnitude, each scaled by its 98th percentile."""
    u = np.clip(unc / max(np.percentile(unc, 98), 1e-9), 0, 1)
    i = np.clip(inf / max(np.percentile(inf, 98), 1e-9), 0, 1)
    return 1 - np.clip(CONF_W_UNC * u + CONF_W_INF * i, 0, 1)


def gate_map(emb: np.ndarray, refl: np.ndarray) -> np.ndarray:
    """Agreement (0..1) between the prior-year AlphaEarth embedding and the current image, at 10 m.

    A linear map from the embedding (plus a bias) to current reflectance and indices is fitted by least
    squares over the tile; the gate is the per-pixel cosine similarity between the predicted and the
    observed (standardised) feature vector, rescaled from -1..1 to 0..1. Low = the current image departs
    from what the embedding predicts.
    """
    r, g, b, n = refl
    feats = np.stack([r, g, b, n, (n - r) / (n + r + 1e-6), (g - n) / (g + n + 1e-6)]).reshape(6, -1).T
    e = emb.reshape(emb.shape[0], -1).T
    ok = np.isfinite(e).all(1)
    e = np.where(ok[:, None], e, np.nanmean(e[ok], 0) if ok.any() else 0)
    e = (e - e.mean(0)) / (e.std(0) + 1e-6)
    f = (feats - feats.mean(0)) / (feats.std(0) + 1e-6)
    X = np.concatenate([e, np.ones((len(e), 1))], 1)
    coef, *_ = np.linalg.lstsq(X, f, rcond=None)
    pred = X @ coef
    cos = (pred * f).sum(1) / (np.linalg.norm(pred, axis=1) * np.linalg.norm(f, axis=1) + 1e-6)
    return ((cos + 1) / 2).reshape(refl.shape[1:]).astype("float32")


# ---- storage and lazy rendering -----------------------------------------------------------------

def _lut(name: str) -> np.ndarray:
    if name not in _lut_cache:
        import matplotlib
        _lut_cache[name] = (matplotlib.colormaps[MPL_NAMES.get(name, name)](np.linspace(0, 1, 256))[:, :3] * 255).round().astype("uint8")
    return _lut_cache[name]


def _hex(c: str) -> list[int]:
    return [int(c[i:i + 2], 16) for i in (1, 3, 5)]


def save_layer(folder: Path, layer_id: str, arr: np.ndarray, style: dict):
    """arr: uint8. style: {"kind": "ramp", "colormap"} | {"kind": "classes", "palette": [hex|None,...]} | {"kind": "rgb"}."""
    folder.mkdir(exist_ok=True)
    np.save(folder / f"{layer_id}.npy", arr)
    (folder / f"{layer_id}.json").write_text(json.dumps(style))


def render_layer(folder: Path, layer_id: str, size: tuple[int, int]) -> tuple[bytes, str] | None:
    """Image bytes and media type for a stored layer at `size` = (height, width), rendered once and cached.

    Continuous layers (ramps, three-channel composites) are opaque, so they go out as lossy WebP,
    about 10x smaller than PNG. Class masks keep PNG for exact colours and transparency.
    """
    for ext, media in (("webp", "image/webp"), ("png", "image/png")):
        cached = folder / f"{layer_id}.{ext}"
        if cached.exists():
            return cached.read_bytes(), media
    if not (folder / f"{layer_id}.npy").exists():
        return None
    arr = np.load(folder / f"{layer_id}.npy")
    style = json.loads((folder / f"{layer_id}.json").read_text())
    kind = style["kind"]
    if kind == "ramp":
        rgb = _lut(style["colormap"])[arr]
        a = np.full(arr.shape, 255, "uint8")
    elif kind == "classes":
        pal = np.array([[*_hex(c), 255] if c else [0, 0, 0, 0] for c in style["palette"]], "uint8")
        rgba = pal[arr]
        rgb, a = rgba[..., :3], rgba[..., 3]
    else:
        rgb, a = arr, np.full(arr.shape[:2], 255, "uint8")
    img = Image.fromarray(np.dstack([rgb, a]), "RGBA")
    if img.size != (size[1], size[0]):
        img = img.resize((size[1], size[0]), Image.BILINEAR)
    buf = io.BytesIO()
    if kind == "classes":
        ext, media = "png", "image/png"
        img.save(buf, "PNG", compress_level=3)
    else:
        ext, media = "webp", "image/webp"
        img.convert("RGB").save(buf, "WEBP", quality=85, method=4)
    (folder / f"{layer_id}.{ext}").write_bytes(buf.getvalue())
    return buf.getvalue(), media
