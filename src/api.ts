// Hosted backend (Hugging Face Space). VITE_API_URL overrides it; dev builds default to a local backend.
const HOSTED_API_URL = 'https://raone777-resolve-backend.hf.space';

export const API_URL: string = (
  (import.meta.env.VITE_API_URL as string | undefined) ||
  (import.meta.env.PROD ? HOSTED_API_URL : 'http://localhost:8000')
).replace(/\/+$/, '');

export interface Health {
  status: string;
  model: string;
  device: string;
}

export interface Sample {
  id: string;
  name: string;
  location: string;
  date: string;
  width: number;
  height: number;
}

export interface ImageInfo {
  width: number;
  height: number;
  png: string;
}

export interface SceneInfo {
  center: { lat: number; lon: number };
  bounds: [number, number, number, number];
  crs: string | null;
  pixel_size_m: number;
  width: number;
  height: number;
  date: string | null;
  satellite: string | null;
  source_item: string | null;
  tile_id: string | null;
}

export interface PatchInfo {
  tile: number;
  overlap: number;
  cols: number;
  rows: number;
  count: number;
}

export type LayerLegend =
  | { type: 'ramp'; min: number; max: number; min_label: string; max_label: string; colormap: string }
  | { type: 'classes'; classes: { label: string; color: string }[] };

/** One selectable product layer, pixel-aligned with output.png. Optional: older backends omit `layers`. */
export interface LayerInfo {
  id: string;
  name: string;
  group: string;
  url: string;
  legend?: LayerLegend | null;
}

export interface StageTiming {
  id: string;
  ms: number;
}

export interface AlphaEarthInfo {
  available: boolean;
  year?: number | null;
  source?: string | null;
  note?: string | null;
}

export interface ConfidenceInfo {
  mean: number;
  high_fraction: number;
}

export interface LockInfo {
  consistency_before: number;
  consistency_after: number;
}

export interface SuperresResult {
  id: string;
  input: ImageInfo;
  output: ImageInfo;
  runtime_ms: number;
  model: string;
  crs: string | null;
  notes: string[];
  scene?: SceneInfo | null;
  patches?: PatchInfo | null;
  layers?: LayerInfo[] | null;
  stages?: StageTiming[] | null;
  alphaearth?: AlphaEarthInfo | null;
  confidence?: ConfidenceInfo | null;
  lock?: LockInfo | null;
}

/** Resolve a backend path (relative or absolute) to an absolute URL. */
export function absUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

/** Early placeholder thumbnail for a bundled sample (available before the run finishes). */
export function sampleThumbUrl(id: string): string {
  return absUrl(`/api/samples/${encodeURIComponent(id)}/input.png`);
}

export function outputTifUrl(result: SuperresResult): string {
  return absUrl(`/api/results/${result.id}/output.tif`);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(absUrl(path), init);
  } catch {
    throw new Error(`Cannot reach the backend at ${API_URL}`);
  }
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (typeof body?.detail === 'string') detail = body.detail;
      else if (body?.detail) detail = JSON.stringify(body.detail);
    } catch {
      /* non-JSON error body */
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

export const health = () => request<Health>('/api/health');

export const listSamples = () => request<Sample[]>('/api/samples');

export const superresSample = (id: string) =>
  request<SuperresResult>(`/api/samples/${encodeURIComponent(id)}/superres`, { method: 'POST' });

export function superresUpload(file: File): Promise<SuperresResult> {
  const form = new FormData();
  form.append('file', file, file.name);
  return request<SuperresResult>('/api/superres', { method: 'POST', body: form });
}
