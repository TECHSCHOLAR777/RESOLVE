---
title: RESOLVE backend
emoji: 🛰️
colorFrom: blue
colorTo: green
sdk: gradio
sdk_version: 6.29.1
python_version: "3.11"
app_file: space.py
pinned: false
---

# RESOLVE backend (prototype)

FastAPI service running SEN2SR-Lite RGBN x4 (about 0.4 M parameters, CPU) on 4-band Sentinel-2 10 m GeoTIFFs (B4 B3 B2 B8) to give a 2.5 m result. API contract: see `../PROTOTYPE_PLAN.md`.

## Local run

Python 3.11 to 3.12 is needed (sen2sr does not support 3.14).

    cd backend
    python -m pip install uv
    python -m uv venv --python 3.11 .venv
    python -m uv pip install --python .venv/Scripts/python.exe -r requirements.txt   # Linux/macOS: .venv/bin/python
    .venv/Scripts/python -m uvicorn app.main:app --port 8000

Weights download on first use into `backend/models/` (gitignored, about 7.5 MB).

## Tests

    .venv/Scripts/python -m pytest -q

## Sample tiles

`samples/*.tif` are committed. Regenerate with `.venv/Scripts/python scripts/fetch_samples.py` (Microsoft Planetary Computer, no key).
Convention: float32 surface reflectance 0-1, band order B4 B3 B2 B8, 256x256 px at 10 m, native UTM CRS. The L2A offset (1000 DN, processing baseline >= 04.00; all four scenes are 05.11) was removed and values divided by 10 000 at fetch time. `samples.json` records source scene, baseline and offset.

## Input handling

Integer values above 1 are treated as L2A DNs and divided by 10 000; 1000 is subtracted first only if a tag containing "baseline" in the file says 04.00 or later. Otherwise values are taken as 0-1 reflectance. Max 512x512 px (413 above), 4 bands required.
Large inputs are tiled in 128 px tiles with 32 px overlap (the model is fixed to 128 px).

## Licence

Weights: Hugging Face repo `tacofoundation/sen2sr`, licence CC0-1.0 (public domain dedication), so free non-commercial and commercial use is allowed. The `sen2sr` package is MIT. Sentinel-2 data is free under the Copernicus licence; please credit Copernicus Sentinel data.

## Deploy to a Hugging Face Space (free CPU, Gradio SDK)

Docker Spaces are paid, so the backend runs on the free Gradio SDK. `space.py` loads the model and serves the same FastAPI app on port 7860, with a one-line Gradio page at `/`.

1. Create a Space with SDK "Gradio", template "Blank", free CPU hardware.
2. From `backend/`, upload this folder as the Space repo root. This README already carries the Space front matter (`sdk: gradio`, `app_file: space.py`, Python 3.11). The CLI handles the binary sample tiles:
   `hf upload <user>/<space> . . --repo-type space --exclude ".venv/*" "models/*" "__pycache__/*" ".pytest_cache/*" "Dockerfile"`
3. The Space installs `requirements.txt` and downloads the weights on first start. The API is then at `https://<user>-<space>.hf.space/api/health`.
4. Set `VITE_API_URL` on Vercel to `https://<user>-<space>.hf.space` and redeploy. CORS is open to all origins.

`Dockerfile` is kept for paid Docker Spaces or other hosts and is not needed for the Gradio Space.

Results are stored in the system temp folder (last 50 kept) and are lost on restart.
