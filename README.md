# resolve — Satellite Imagery Enhancer

> **High-fidelity 10 m → 2.5 m super-resolution workspace for Sentinel-2 and aerial imagery.**

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/TECHSCHOLAR777/RESOLVE)

---

## Architecture

The pipeline below describes how RESOLVE processes raw 10 m satellite data into calibrated 2.5 m output products.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  1 · Inputs                                                              │
│  ┌─────────────────┐  ┌───────────────────────┐  ┌───────────────────┐  │
│  │  Sentinel-2     │  │  Maxar 0.5 m training │  │  AlphaEarth       │  │
│  │  10 m · 4 bands │  │  reference            │  │  land-cover ctx   │  │
│  └────────┬────────┘  └──────────┬────────────┘  └─────────┬─────────┘  │
└───────────┼────────────────────── │ training only ──────────┼────────────┘
            ▼                       ▼                         │
   ┌────────────────────────────────────┐                     │
   │  2 · Pre-processing                │                     │
   │  reflectance · cloud mask · pairing│                     │
   └────────────────┬───────────────────┘                     │
                    │                                         │
   ┌────────────────▼──────────────────────────────────┐      │
   │  3 · Super-resolution network (SEN2SR)            │      │
   │  ┌──────────────────┐   ┌────────────────────┐   │      │
   │  │ Wavelet texture  │   │ AlphaEarth context │◄──┼──────┘
   │  │ branch           │   │ + change gate      │   │
   │  └────────┬─────────┘   └─────────┬──────────┘   │
   │           └──────────┬────────────┘               │
   │              ┌───────▼────────┐                   │
   │              │ Mamba backbone │◄──── 10 m input   │
   │              │   (SEN2SR)     │                   │
   │              └───────┬────────┘                   │
   └──────────────────────┼────────────────────────────┘
                          │ features
                          ▼
              ┌───────────────────────┐    ┌──────────────────────────────┐
              │  High-resolution img  │◄───│  4 · Measurement lock        │
              │  2.5 m · 4 bands      │    │  output must match 10 m input│
              └──────┬────────────────┘    └──────────────────────────────┘
                     │
                     │          ┌───────────────────────────────────────┐
                     │          │  5 · Trust layer                      │
                     │          │  ┌─────────────────┐ ┌─────────────┐ │
                     │          │  │  Uncertainty     │ │ Observed vs │ │
                     │          │  │  3 models + head │ │ inferred    │ │
                     │          │  │                  │ │ per pixel   │ │
                     │          │  └────────┬─────────┘ └──────┬──────┘ │
                     │          │           └────────┬──────────┘        │
                     │          │              ┌─────▼──────┐            │
                     │          │              │ Calibrated │            │
                     │          │              │ confidence │            │
                     │          │              └────────────┘            │
                     │          └───────────────────────────────────────┘
                     │ trust weights
   ┌─────────────────▼──────────────────────────────────────────────────┐
   │  6 · Downstream mapping                                            │
   │  ┌───────────────────────┐                                         │
   │  │ 2.5 m feature map     │──────────► Light task heads             │
   │  │ 64 channels           │            (segmentation)               │
   │  └───────────────────────┘                                         │
   └────────────────────────────────────────────────────────────────────┘
                     │
   ┌─────────────────▼──────────────────────────────────────────────────┐
   │  7 · Products                                                      │
   │  ┌──────────────┐ ┌────────────────┐ ┌─────────────┐ ┌──────────┐ │
   │  │ Land-cover   │ │ Flood / water  │ │   Field     │ │ Built-up │ │
   │  │ map          │ │ map            │ │  boundaries │ │ map      │ │
   │  └──────────────┘ └────────────────┘ └─────────────┘ └──────────┘ │
   │  ┌───────────────────────────┐   ┌──────────────────────────────┐  │
   │  │ Indices · NDVI · NDWI     │   │ Confidence map               │  │
   │  └───────────────────────────┘   └──────────────────────────────┘  │
   └────────────────────────────────────────────────────────────────────┘
```

### Stage Descriptions

| # | Stage | Description |
|---|-------|-------------|
| 1 | **Inputs** | Sentinel-2 L2A (10 m, 4-band), Maxar 0.5 m training reference (training only), AlphaEarth land-cover context |
| 2 | **Pre-processing** | Surface reflectance normalisation, cloud/shadow masking, and scene pairing |
| 3 | **Super-resolution network** | Dual-branch: wavelet texture branch + AlphaEarth context/change-gate, fused into the Mamba-based SEN2SR backbone |
| 4 | **Measurement lock** | Pixel-level constraint ensuring super-resolved output is radiometrically consistent with the original 10 m sensor data |
| 5 | **Trust layer** | Ensemble uncertainty head (3 models) + observed-vs-inferred comparison produces per-pixel calibrated confidence weights |
| 6 | **Downstream mapping** | 2.5 m, 64-channel feature map fed into lightweight task-head segmentation network with trust-weighted attention |
| 7 | **Products** | Land-cover map, Flood/water map, Field boundaries, Built-up map, NDVI/NDWI indices, Confidence map |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| UI Framework | React 19 + TypeScript |
| Build Tool | Vite 8 |
| Styling | Tailwind CSS v4 |
| Icons | Lucide React |
| Deployment | Vercel (static) |

---

## Local Development

### Prerequisites

- **Node.js** ≥ 18

### Setup

```bash
# 1. Clone
git clone https://github.com/TECHSCHOLAR777/RESOLVE.git
cd RESOLVE

# 2. Install dependencies
npm install

# 3. Start dev server
npm run dev
# → http://localhost:3000
```

### Build for Production

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

---
