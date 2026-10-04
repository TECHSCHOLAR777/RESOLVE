# RESOLVE prototype plan: SEN2SR-Lite behind an upload page

## Goal

A user uploads a 4-band Sentinel-2 10 m GeoTIFF (or picks a bundled sample). A Python backend runs SEN2SR-Lite (CNN, about 0.4 M parameters, RGBN x4) and returns the 2.5 m result. The web UI shows input and output side by side and as a slider split, and offers the 2.5 m GeoTIFF and a PNG preview for download.

Not in scope: AlphaEarth context, wavelet branch, trust layer, ensembles, task heads. The UI must not claim them.

## Architecture

- `backend/`: FastAPI service, Python, CPU only. Uses the official `sen2sr` and `mlstac` packages to load SEN2SR-Lite RGBN x4. Deployable as a Docker Hugging Face Space (free CPU tier).
- `src/`: existing React 19 + Vite + Tailwind front end, kept as the static site on Vercel. Calls the backend through `VITE_API_URL` (default `http://localhost:8000`).

## API contract (both sides build against this)

- `GET /api/health` returns `{"status": "ok", "model": "SEN2SR-Lite RGBN x4", "device": "cpu"}`.
- `GET /api/samples` returns a list of `{"id", "name", "location", "date", "width", "height"}`.
- `POST /api/superres` takes multipart field `file` (GeoTIFF, 4 bands, order B4 B3 B2 B8, 10 m). Optional form field `band_order` (default `"B4,B3,B2,B8"`).
- `POST /api/samples/{id}/superres` runs the same pipeline on a bundled sample.
- Both super-resolution calls return:
  `{"id", "input": {"width", "height", "png"}, "output": {"width", "height", "png"}, "runtime_ms", "model", "crs", "notes": [..]}`
  where `png` values are URLs under `/api/results/{id}/...` that return RGB previews (B4 B3 B2) with one shared percentile stretch computed from the input.
- `GET /api/results/{id}/output.tif` returns the georeferenced 2.5 m GeoTIFF (4 bands, float32 reflectance, transform scaled by 1/4).
- `GET /api/results/{id}/input.png`, `.../output.png` return previews.
- Errors return HTTP 4xx with `{"detail": "..."}`: wrong band count, file not a GeoTIFF, input larger than 512 x 512 px (413).

## Input handling

- Reflectance scaling: if values look like integers above 1 (L2A digital numbers), divide by 10 000. Apply the L2A offset (-1000) only when the file metadata says processing baseline 04.00 or later. Otherwise assume 0 to 1 reflectance.
- Input limit 512 x 512 pixels. Results kept in a temp folder with a cap on stored results.

## Samples

Three or four real 4-band 10 m tiles (about 256 x 256 px) over India, cut from Sentinel-2 L2A on Microsoft Planetary Computer (free, no key): farmland, a city, a river or flood plain, a hilly area. Stored in `backend/samples/` with a `samples.json` index.

## Front end (functional first, no UI text changes)

- Owner instruction: do not change any visible UI text, labels or copy in this phase. Make it functional first.
- Replace the CSS blur and contrast fakes with the real input and output previews from the backend.
- Wire the existing upload control (file input and drag-and-drop) to `POST /api/superres`, and the existing download button to the real `output.tif`.
- Load a bundled sample by default through `POST /api/samples/{id}/superres` instead of the Wikimedia photo.
- Keep the existing look, side-by-side and split views and zoom. Reuse existing elements for loading and error states. Any new element must be minimal and is allowed only where no existing element can carry the state.
- Cleanup of unused components, `@google/genai` and copy changes are deferred to a later phase.

## Verification

- Backend: pytest smoke tests for health, samples, a superres call on each sample (output is 4x size, finite values, output downsampled by 4 is close to input), and error cases.
- Front end: `npm run lint` and `npm run build` pass. Browser smoke test against the local backend: run a sample, check both images load, check downloads.

## Delivery

- Work on branch `prototype-sen2sr`, pushed to origin. `master` is left alone so the live Vercel site does not break before the backend is hosted.
- `backend/README.md` explains local run and Hugging Face Space deployment. Hosting needs the owner's Hugging Face and Vercel accounts.
