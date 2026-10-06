---
title: RESOLVE backend
emoji: 🛰️
colorFrom: blue
colorTo: green
sdk: gradio
sdk_version: 6.29.1
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
    python -m uv pip install --python .venv/Scripts/python.exe -r requirements-dev.txt --extra-index-url https://download.pytorch.org/whl/cpu   # Linux/macOS: .venv/bin/python
    .venv/Scripts/python -m uvicorn app.main:app --port 8000

Weights download on first use into `backend/models/` (gitignored, about 7.5 MB).

## Tests

    .venv/Scripts/python -m pytest -q

Tests that need the network (AlphaEarth bucket, Planetary Computer) skip themselves when offline.

## Sample tiles

`samples/*.tif` are committed. Regenerate with `.venv/Scripts/python scripts/fetch_samples.py` (Microsoft Planetary Computer, no key).
Convention: float32 surface reflectance 0-1, band order B4 B3 B2 B8, 256x256 px at 10 m, native UTM CRS. The L2A offset (1000 DN, processing baseline >= 04.00; all four scenes are 05.11) was removed and values divided by 10 000 at fetch time. `samples.json` records source scene, baseline and offset.

## Input handling

Integer values above 1 are treated as L2A DNs and divided by 10 000; 1000 is subtracted first only if a tag containing "baseline" in the file says 04.00 or later. Otherwise values are taken as 0-1 reflectance. Max 512x512 px (413 above), 4 bands required.
Large inputs are tiled in 128 px tiles with 32 px overlap (the model is fixed to 128 px).

## API additions

- `GET /api/samples/{id}/input.png`: 256x256 RGB (B4,B3,B2) preview of a bundled sample, 2-98 percentile stretch, cached in memory; 404 if unknown.
- Both superres responses also carry `scene` (`center`, `bounds` [w,s,e,n] WGS84, `crs`, `pixel_size_m`, `width`, `height`, `date`, `satellite`, `source_item`, `tile_id`; parsed from the GeoTIFF `source_item` tag, samples fall back to `samples.json`; geo fields are null without a CRS) and `patches` (`tile`, `overlap`, `cols`, `rows`, `count`: the real inference tiling).

### Analysis layers, stages, lock, AlphaEarth

Both superres responses also carry (additive; existing fields unchanged):

- `layers`: list of `{id, name, group, url, legend}`. `url` is `/api/results/{id}/layers/{layer_id}.png`, a PNG the same pixel size as `output.png` (4x the input) so layers overlay it. The arrays are computed during the POST and stored as small uint8 files in the result folder; the PNG is rendered and cached on the first GET. `legend` is `{type: "ramp", min, max, min_label, max_label, colormap, note}` (colormaps: `viridis`, `magma`, `plasma`, `rdylgn`, `blues`, and `rgb` for 3-component false-colour layers where min/max are 0/1) or `{type: "classes", classes: [{label, color}], note}`. Ids: `rgb`, `nir_false`, `ndvi`, `ndwi`, `water`, `landcover`, `builtup`, `fields`, `wavelet`, `features`, `uncertainty`, `inferred`, `confidence`, plus `alphaearth` and `gate` only when AlphaEarth is available. Mask layers (`water`, `builtup`, `fields`) are transparent outside the class.
- `stages`: `[{id, ms}]` measured wall-clock durations for `ingest`, `normalise`, `alphaearth`, `patching`, `backbone`, `wavelet`, `lock`, `uncertainty`, `products`. Stages overlap in time: AlphaEarth is fetched in a background thread while the model runs, and the output files are written while the TTA passes run, so the sum can exceed the request time. `uncertainty` covers the extra test-time-augmentation passes only (the first pass is `backbone`). `runtime_ms` is still patching + backbone.
- `alphaearth`: `{available, year, source, note}`.
- `confidence`: `{mean, high_fraction}` (confidence 0 to 1; high is 0.8 or more).
- `lock`: `{consistency_before, consistency_after, applied}`: relative RMS of `A x - y` over RMS of `y` before and after the measurement lock (see below). The lock is applied: `output.png` and `output.tif` are the locked result.

How the layers are computed (all on the 2.5 m output unless noted):

| id | method |
| --- | --- |
| `rgb` | the output true colour (served from `output.png`) |
| `nir_false` | NIR, red, green as R, G, B with a 2-98 percentile stretch per band |
| `ndvi`, `ndwi` | (NIR - R) / (NIR + R) stretched -0.2 to 0.9; (G - NIR) / (G + NIR) stretched -0.6 to 0.6 |
| `water` | NDWI > 0.1 and NIR < 0.25 |
| `landcover` | water (above); else NDVI > 0.5 dense vegetation; NDVI > 0.2 cropland / sparse; else built-up / bare |
| `builtup` | low NDVI (<= 0.2), not water, mean visible reflectance > 0.10 |
| `fields` | Sobel gradient magnitude of Gaussian-smoothed (sigma 2 px) NDVI, non-maximum suppression, top-8% and >= 0.01 threshold, thickened to about 2 px |
| `wavelet` | 1-level Haar DWT of luminance, `abs(LH)+abs(HL)+abs(HH)`, bilinearly upsampled; 2nd to 99.5th percentile |
| `features` | forward hook on `sr_model.blocks.3` (4th of 6 SPAB blocks, 24 channels at input resolution); PCA (SVD) to 3 components, bilinearly upsampled. Falls back to PCA of bands + gradients if the hook fails (the legend note says so) |
| `uncertainty` | std dev over the 8 dihedral transforms (4 rotations x flip) of the model output, each inverted back, mean over bands; the 7 extra passes are batched through the model. Inputs above 16 tiles (about 300 px and up) use 4 passes to bound run time (`RESOLVE_TTA` sets the count, default 8) |
| `inferred` | mean over bands of `abs(out - bilinear_up(area_avg_4x(out)))`: detail the 10 m pixels cannot have observed |
| `confidence` | `1 - clip(0.6 * u + 0.4 * i, 0, 1)` with `u`, `i` the uncertainty and inferred maps divided by their 98th percentile |
| `alphaearth` | PCA of the embedding dimensions read, to 3 components, resampled to the output grid |
| `gate` | least-squares linear map from the embedding (plus bias) to current reflectance + NDVI + NDWI over the tile; per-pixel cosine between predicted and observed standardised features, mapped to 0..1 |

Measurement lock (`app/lock.py`): `x_hat = z + A^T (A A^T + lam I)^-1 (y - A z)` with A a per-band Gaussian PSF (sigma 3.0, 2.9, 2.9, 3.4 output px for B4, B3, B2, B8) followed by 4x area decimation, `lam = 0.03`, 6 conjugate-gradient steps, then clipped at 0. A smaller `lam` (0.003 and below) behaves as a deconvolution and visibly rings, so 0.03 is used: it cuts the inconsistency by about 20% with no visible change to the image.

AlphaEarth (`app/alphaearth.py`): the AlphaEarth Foundations Satellite Embedding V1 annual dataset (CC-BY 4.0, "produced by Google and Google DeepMind") is public as COGs on Source Cooperative `tge-labs/aef` (also the AWS bucket `us-west-2.opendata.source.coop`). Files are 8192x8192 px, 64 int8 bands, 10 m, one per UTM zone / year / 81.92 km grid square, bottom-up, bands stored planar in 1024x1024 ZSTD tiles (about 0.6 MB per band per tile). The file name is a hash, so `app/data/aef_index.json.gz` (1.36 MB, the whole world: all 120 UTM zone/hemisphere combinations, years 2017 to 2025, 302 466 files) maps (year, zone, grid cell) to the file. Coverage is global; any lat/lon the dataset covers resolves, in both hemispheres (zones named like `31N`, `37S`; southern grids start at northing 5760 m). Encoding: the file name is `<hash>-<oy>-<ox>.tiff`, one hash per year, zone and 2x2 export block, so the index stores `[hash, cx0, cy0, 4-bit mask]` per block (96 041 blocks). Rebuild with `python scripts/build_aef_index.py aef_index.parquet` after downloading `https://data.source.coop/tge-labs/aef/v1/annual/aef_index.parquet` (78 MB; needs `pyarrow`, dev only, not a runtime dependency). Nothing is downloaded at server start: the bundle loads in about 0.2 s on first use. At request time the tile bounds give the grid cells, rasterio reads only the window with HTTP range requests (`GDAL_DISABLE_READDIR_ON_OPEN=EMPTY_DIR`, `CPL_VSIL_CURL_ALLOWED_EXTENSIONS=.tif,.tiff`), values are de-quantised as `sign(v) * (v / 127.5)^2` (-128 is masked) and reprojected to the tile grid. Year = acquisition year - 1, clamped to 2017-2025 (2024 if the date is unknown). Because all 64 bands would be about 37 MB per tile, only the first `AEF_BANDS` (default 8) dimensions are read, in parallel, inside an `AEF_TIMEOUT_S` (default 10 s) budget; a contiguous prefix of at least 3 dimensions is used and the note says how many. Fully read windows are cached in `<tmp>/resolve_aef_cache`. The fetch runs in a background thread concurrent with inference, the first `/api/health` call pre-warms the cache for the bundled samples, and any failure (no network, tile outside the index, timeout, masked) gives `alphaearth.available = false` with a short note and no `alphaearth` / `gate` layers. `RESOLVE_ALPHAEARTH=0` switches the lookup off (the tests do).


### Area super-resolution from a map selection

`POST /api/area/superres` takes `{"lat", "lon", "size_px": 256 | 512, "date_from": "YYYY-MM-DD" | null, "date_to": ... | null, "max_cloud": 0-100 (default 20), "name": str | null}`, fetches a Sentinel-2 L2A window from the Microsoft Planetary Computer (STAC `sentinel-2-l2a`, `pystac-client` + `planetary-computer` signing, no key) and runs the same full pipeline as `/api/superres`. The response has the same shape plus `source_scene` (`item_id`, `date`, `satellite`, `tile_id`, `cloud_cover`, `window_cloud_fraction`, `processing_baseline`, `relaxed_cloud`, plus top-level `name`: the request name, or "lat, lon" with 4 decimals), a first `stages` entry `{"id": "search", "ms"}` (STAC search + window reads), `scene.date / satellite / tile_id / source_item` from the item, and the input tile as a GeoTIFF at `GET /api/results/{id}/input.tif` (float32 reflectance 0-1, B4 B3 B2 B8, native UTM).

Selection (`app/area.py`): the square is `size_px x 10 m` centred on the point in the item's UTM grid, snapped to the 20 m grid. Window default is the 120 days ending today (newest clear scene first); with `date_from` / `date_to` the lowest scene cloud wins (newest on ties); a single bound is completed with today, or with 120 days before `date_to`. Items with `eo:cloud_cover <= max_cloud` come first, then items up to 60 % (flagged `relaxed_cloud`). Only tiles that contain the whole square are tried (an MGRS tile overlapping the square would leave nodata). Up to 5 candidates are read, 2 at a time; each read is B04, B03, B02, B08 (10 m) and SCL (20 m, nearest to 10 m) windows by range requests in parallel threads. A window is rejected if more than 1 % of pixels are 0 (nodata) or more than 10 % are SCL 3, 8, 9 or 10. Processing baseline >= 04.00 subtracts 1000 DN, then divides by 10 000, as in `fetch_samples.py`.

Errors: 422 with a one-line `detail` for bad input (lat -84..84, lon -180..180, size 256 or 512, date order, dates in the future, max_cloud); 404 `No clear Sentinel-2 scene found for this area and date range. Try a wider date range or a higher cloud limit.`; 503 when the catalogue or imagery is unreachable or the search/read phase exceeds its hard limit (`RESOLVE_AREA_TIMEOUT_S`, default 20 s for 256 px and 40 s for 512 px).

Example request: `{"lat": 48.8566, "lon": 2.3522, "size_px": 256}`.

## Licence

Weights: Hugging Face repo `tacofoundation/sen2sr`, licence CC0-1.0 (public domain dedication), so free non-commercial and commercial use is allowed. The `sen2sr` package is MIT. Sentinel-2 data is free under the Copernicus licence; please credit Copernicus Sentinel data.

## Deploy to a Hugging Face Space

Live: `https://raone777-resolve-backend.hf.space` (Space `RAONE777/resolve-backend`). The production front end uses this URL by default (see `src/api.ts`).

Docker Spaces are paid, so the backend runs under the Gradio SDK. New free Gradio Spaces get ZeroGPU hardware and cannot be switched to plain CPU without PRO. `space.py` handles the ZeroGPU rules:

- ZeroGPU runs Python 3.10 and only torch 2.8 to 2.13, so `requirements.txt` pins `torch==2.10.0` and keeps other pins loose. Dev and test tools are in `requirements-dev.txt`.
- ZeroGPU refuses to start without a `@spaces.GPU` function, and it only reports one from a hook in `gr.Blocks.launch()`. Since uvicorn serves the app, `space.py` defines a placeholder GPU function and calls `spaces.zero.startup()` itself. The model is small and runs on CPU.
- The Space sets `GRADIO_SSR_MODE`. With SSR on, Gradio starts a Node server on port 7860 that answers every path with HTML, so `space.py` mounts Gradio with `ssr_mode=False` and binds uvicorn to 7860.

To redeploy, upload this folder as the Space repo root (front matter in this README sets `sdk: gradio` and `app_file: space.py`):

    python -c "from huggingface_hub import HfApi; HfApi().upload_folder(repo_id='RAONE777/resolve-backend', repo_type='space', folder_path='.', ignore_patterns=['.venv/*','models/*','**/__pycache__/*','__pycache__/*','.pytest_cache/*','Dockerfile'])"

`Dockerfile` is kept for paid Docker Spaces or other hosts.

Results are stored in the system temp folder (last 50 kept) and are lost on restart.
