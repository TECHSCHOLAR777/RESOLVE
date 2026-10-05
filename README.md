# RESOLVE

RESOLVE is a demo web app for Sentinel-2 super-resolution. It reconstructs a 10 m scene at 2.5 m (4x) and shows how much of the added detail the measurements support. The system it demonstrates combines:

- a Mamba backbone that reconstructs the high-resolution image,
- a wavelet texture branch for fine edges and texture,
- AlphaEarth context, change-gated so it is used only where it agrees with the current observation,
- a measurement lock that keeps the output consistent with the original 10 m data when averaged back down,
- a trust layer: per-pixel uncertainty, an observed versus inferred detail map, and calibrated confidence,
- downstream maps (land cover, NDVI) derived from the enhanced image.

Inferred detail is a model estimate, not a measurement.

## Live

- Backend API: https://raone777-resolve-backend.hf.space (Hugging Face Space, sleeps when idle; the first request can take 20 to 60 s)

## Input

A 4-band Sentinel-2 L2A GeoTIFF, bands B4 B3 B2 B8 (red, green, blue, near infrared) at 10 m pixel size, up to 512 x 512 px. Sample scenes are bundled with the backend.

## Pages

| Route | Page |
|-------|------|
| `/` | Workspace: upload or pick a sample, compare input and output, switch layers, inspector, exports |
| `/run` | Live processing view for the current run |
| `/results` | My Results: runs stored in this browser (history), reopen, download, remove |
| `/settings` | Theme, default view mode and layer, corner labels, auto-return, telemetry log |
| `/help` | About, how to use, FAQ, credits, references |
| `/report` | One-page printable report for the current result |

History and settings are kept in `localStorage`; nothing is sent to a server except the scene being processed.

## Local development

Frontend (Node.js 18 or newer):

```bash
npm install
npm run dev        # http://localhost:3000
npm run lint       # type check (tsc --noEmit)
npm run build      # production build in dist/
```

The dev server talks to `http://localhost:8000` unless `VITE_API_URL` is set. Copy `.env.example` to `.env.local` to point it at the hosted backend. Production builds default to the hosted backend.

Backend (Python 3.11 or 3.12, see `backend/README.md` for details):

```bash
cd backend
python -m pip install uv
python -m uv venv --python 3.11 .venv
python -m uv pip install --python .venv/Scripts/python.exe -r requirements-dev.txt --extra-index-url https://download.pytorch.org/whl/cpu
.venv/Scripts/python -m uvicorn app.main:app --port 8000     # Linux/macOS: .venv/bin/python
```

## Structure

```
src/
  App.tsx                 router and lazy pages
  api.ts                  backend client and result types
  theme.tsx               light / dark theme hook and toggle
  lib/                    history, settings, exports, time helpers
  components/
    workspace/            shell, nav, viewer, layers, samples, exports
    run/                  run state, live processing page, timeline
    inspector/            scene, map, metrics and pipeline cards
    pages/                results, settings, help, report
    splash/               three.js globe splash
public/assets/            logo and Earth textures
backend/                  FastAPI service and model code
```

## Deployment

The frontend is a static Vite build (see `vercel.json`).

## Credits

Contains modified Copernicus Sentinel data. AlphaEarth Foundations Satellite Embedding dataset, Google and Google DeepMind, CC-BY 4.0. Map data OpenStreetMap contributors (ODbL). Super-resolution weights from SEN2SR (ESA OpenSR), CC0. Earth imagery: NASA Blue Marble. Full list on the Help page.
