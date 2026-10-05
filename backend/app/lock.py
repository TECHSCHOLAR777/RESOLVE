"""Measurement lock: closed-form back-projection onto the observed Sentinel-2 pixels.

Observation operator A (per band): Gaussian PSF with sigma in output pixels, then SCALE x SCALE area
decimation. Given the network output z and observation y,
    x_hat = z + A^T (A A^T + lam I)^-1 (y - A z),
with the linear system solved by a few conjugate-gradient steps (A A^T is small and well conditioned).
x_hat reproduces y under A (up to lam) while keeping z's detail in the null space of A.
"""
import math

import numpy as np
import torch
import torch.nn.functional as F

SIGMAS = (3.0, 2.9, 2.9, 3.4)  # output px for B4, B3, B2, B8
SCALE = 4
LAM = 0.03
CG_ITERS = 6


def _kernel(sigma: float) -> torch.Tensor:
    r = math.ceil(3 * sigma)
    x = torch.arange(-r, r + 1, dtype=torch.float32)
    k = torch.exp(-x * x / (2 * sigma * sigma))
    return k / k.sum()


def _blur(x: torch.Tensor, kernels) -> torch.Tensor:
    """x: (4,H,W). Separable Gaussian blur per band, reflect padding."""
    out = []
    for band, k in zip(x, kernels):
        r = len(k) // 2
        t = F.pad(band[None, None], (r, r, r, r), mode="reflect")
        t = F.conv2d(t, k.view(1, 1, 1, -1))
        t = F.conv2d(t, k.view(1, 1, -1, 1))
        out.append(t[0, 0])
    return torch.stack(out)


def _A(z, kernels):
    return F.avg_pool2d(_blur(z, kernels)[None], SCALE)[0]


def _At(r, kernels):
    return _blur(r.repeat_interleave(SCALE, 1).repeat_interleave(SCALE, 2) / (SCALE * SCALE), kernels)


def consistency(x: np.ndarray, y: np.ndarray) -> float:
    """Relative RMS of (A x - y) / RMS(y)."""
    kernels = [_kernel(s) for s in SIGMAS]
    with torch.inference_mode():
        r = _A(torch.from_numpy(np.ascontiguousarray(x)), kernels).numpy() - y
    return float(np.sqrt((r ** 2).mean()) / max(np.sqrt((y ** 2).mean()), 1e-9))


@torch.inference_mode()
def lock(z: np.ndarray, y: np.ndarray) -> tuple[np.ndarray, float, float]:
    """z: output (4,4h,4w); y: observed (4,h,w). Returns (x_hat, consistency_before, consistency_after)."""
    kernels = [_kernel(s) for s in SIGMAS]
    zt, yt = torch.from_numpy(np.ascontiguousarray(z)), torch.from_numpy(y)
    rhs = yt - _A(zt, kernels)
    # CG on (A A^T + lam I) u = rhs, independently per band (sums over the spatial dims only)
    u = torch.zeros_like(rhs)
    r = rhs.clone()
    p = r.clone()
    rs = (r * r).sum((1, 2), keepdim=True)
    for _ in range(CG_ITERS):
        Ap = _A(_At(p, kernels), kernels) + LAM * p
        alpha = rs / ((p * Ap).sum((1, 2), keepdim=True) + 1e-20)
        u += alpha * p
        r -= alpha * Ap
        rs_new = (r * r).sum((1, 2), keepdim=True)
        p = r + (rs_new / (rs + 1e-20)) * p
        rs = rs_new
    xh = zt + _At(u, kernels)
    xh = xh.clamp_min(0).numpy()
    return xh, consistency(z, y), consistency(xh, y)
