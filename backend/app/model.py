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


@torch.no_grad()
def super_resolve(refl: np.ndarray) -> np.ndarray:
    """refl: (4, H, W) float32 reflectance (B4 B3 B2 B8). Returns (4, 4H, 4W) float32.

    The image is reflect-padded and cut into overlapping 128x128 tiles; only the
    central 96x96 of each tile's output is kept, so tile seams and borders are hidden.
    """
    model = get_model()
    _, h, w = refl.shape
    ph, pw = padded_size(h), padded_size(w)
    padded = np.pad(refl, ((0, 0), (MARGIN, ph - h - MARGIN), (MARGIN, pw - w - MARGIN)), mode="reflect")
    x = torch.from_numpy(padded)
    out = torch.zeros(4, ph * SCALE, pw * SCALE)
    m = MARGIN * SCALE
    for y in range(0, ph - TILE + 1, STRIDE):
        for xx in range(0, pw - TILE + 1, STRIDE):
            sr = model(x[None, :, y:y + TILE, xx:xx + TILE]).squeeze(0)
            core = sr[:, m:-m, m:-m]
            oy, ox = (y + MARGIN) * SCALE, (xx + MARGIN) * SCALE
            out[:, oy:oy + core.shape[1], ox:ox + core.shape[2]] = core
    return out[:, m:m + h * SCALE, m:m + w * SCALE].numpy()
