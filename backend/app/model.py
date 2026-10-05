"""SEN2SR-Lite RGBN x4 loading and tiled inference."""
from pathlib import Path

import mlstac
import numpy as np
import torch

MODEL_URL = "https://huggingface.co/tacofoundation/sen2sr/resolve/main/SEN2SRLite/NonReference_RGBN_x4/mlm.json"
MODEL_DIR = Path(__file__).resolve().parents[1] / "models" / "SEN2SRLite_RGBN"
MODEL_NAME = "SEN2SR-Lite RGBN x4"
SCALE, TILE, MARGIN = 4, 128, 16  # the model is fixed to 128x128 inputs
STRIDE = TILE - 2 * MARGIN

_model = None


def get_model():
    global _model
    if _model is None:
        if not (MODEL_DIR / "mlm.json").exists():
            mlstac.download(file=MODEL_URL, output_dir=str(MODEL_DIR))
        _model = mlstac.load(str(MODEL_DIR)).compiled_model(device="cpu").eval()
    return _model


def padded_size(n: int) -> int:
    """Smallest size >= n + 2*MARGIN that 128-px tiles with stride 96 cover exactly."""
    n += 2 * MARGIN
    return TILE if n <= TILE else TILE + -(-(n - TILE) // STRIDE) * STRIDE


FEATURE_LAYER = "sr_model.blocks.3"  # 4th of 6 SPAB blocks: 24 channels at input resolution, mid-depth


def make_tiles(refl: np.ndarray):
    """Reflect-pad and cut into overlapping TILE x TILE patches. Returns (tiles (N,4,T,T), origins, (ph, pw))."""
    _, h, w = refl.shape
    ph, pw = padded_size(h), padded_size(w)
    padded = np.pad(refl, ((0, 0), (MARGIN, ph - h - MARGIN), (MARGIN, pw - w - MARGIN)), mode="reflect")
    origins = [(y, x) for y in range(0, ph - TILE + 1, STRIDE) for x in range(0, pw - TILE + 1, STRIDE)]
    tiles = torch.from_numpy(np.stack([padded[:, y:y + TILE, x:x + TILE] for y, x in origins]))
    return tiles, origins, (ph, pw)


def stitch(sr: torch.Tensor, origins, padded_hw, h: int, w: int, scale: int) -> np.ndarray:
    """Keep the central (TILE - 2 MARGIN) block of every tile output and crop the padding."""
    ph, pw = padded_hw
    m = MARGIN * scale
    out = torch.zeros(sr.shape[1], ph * scale, pw * scale)
    for t, (y, x) in zip(sr, origins):
        core = t[:, m:-m, m:-m]
        oy, ox = (y + MARGIN) * scale, (x + MARGIN) * scale
        out[:, oy:oy + core.shape[1], ox:ox + core.shape[2]] = core
    return out[:, m:m + h * scale, m:m + w * scale].numpy()


@torch.inference_mode()
def run_tiles(tiles: torch.Tensor, batch: int = 16, capture: bool = False):
    """Model output for a stack of tiles, in batches. With capture, also the FEATURE_LAYER activations."""
    model = get_model()
    feats = []
    handle = None
    if capture:
        layer = dict(model.named_modules())[FEATURE_LAYER]
        handle = layer.register_forward_hook(lambda mod, inp, o: feats.append((o[0] if isinstance(o, tuple) else o).clone()))
    try:
        outs = [model(tiles[i:i + batch]) for i in range(0, len(tiles), batch)]
    finally:
        if handle is not None:
            handle.remove()
    return torch.cat(outs), (torch.cat(feats) if capture else None)


def super_resolve_features(refl: np.ndarray):
    """Like super_resolve, but also returns (feature map (C,h,w) at input resolution, patching_ms, backbone_ms)."""
    import time
    _, h, w = refl.shape
    t0 = time.perf_counter()
    tiles, origins, padded_hw = make_tiles(refl)
    t1 = time.perf_counter()
    sr, feats = run_tiles(tiles, capture=True)
    out = stitch(sr, origins, padded_hw, h, w, SCALE)
    try:
        fmap = stitch(feats, origins, padded_hw, h, w, 1)
    except Exception:
        fmap = None
    return out, fmap, round((t1 - t0) * 1000), round((time.perf_counter() - t1) * 1000)


# The 8 dihedral transforms (k quarter turns, optional flip) and their inverses
DIHEDRAL = [(k, f) for f in (False, True) for k in range(4)]


def d_apply(x: np.ndarray, k: int, flip: bool) -> np.ndarray:
    x = np.rot90(x, k, axes=(-2, -1))
    return np.flip(x, axis=-1) if flip else x


def d_invert(x: np.ndarray, k: int, flip: bool) -> np.ndarray:
    x = np.flip(x, axis=-1) if flip else x
    return np.rot90(x, -k, axes=(-2, -1))


def super_resolve_tta(refl: np.ndarray, first: np.ndarray, n: int = 8) -> np.ndarray:
    """(n, 4, 4H, 4W) outputs for the first n dihedral transforms (inverted back); index 0 is `first`, the
    untransformed output already computed. All other transforms are batched together through the model."""
    _, h, w = refl.shape
    transforms = DIHEDRAL[1:n] if n < 8 else DIHEDRAL[1:]
    tiles_all, meta = [], []
    for k, f in transforms:
        tr = np.ascontiguousarray(d_apply(refl, k, f))
        tiles, origins, phw = make_tiles(tr)
        tiles_all.append(tiles)
        meta.append((origins, phw, tr.shape[1], tr.shape[2], k, f))
    sr, _ = run_tiles(torch.cat(tiles_all))
    outs, pos = [first], 0
    for tiles, (origins, phw, th, tw, k, f) in zip(tiles_all, meta):
        o = stitch(sr[pos:pos + len(tiles)], origins, phw, th, tw, SCALE)
        outs.append(np.ascontiguousarray(d_invert(o, k, f)))
        pos += len(tiles)
    return np.stack(outs)


def super_resolve(refl: np.ndarray) -> np.ndarray:
    """refl: (4, H, W) float32 reflectance (B4 B3 B2 B8). Returns (4, 4H, 4W) float32.

    The image is reflect-padded and cut into overlapping 128x128 tiles; only the
    central 96x96 of each tile's output is kept, so tile seams and borders are hidden.
    """
    _, h, w = refl.shape
    tiles, origins, padded_hw = make_tiles(refl)
    sr, _ = run_tiles(tiles)
    return stitch(sr, origins, padded_hw, h, w, SCALE)
