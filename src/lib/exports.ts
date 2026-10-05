import { absUrl, outputTifUrl, type SuperresResult } from '../api';

function saveBlob(blob: Blob, filename: string) {
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(href), 2000);
}

/** Fetch to a blob first so the download attribute works for cross-origin URLs. */
export async function downloadUrl(url: string, filename: string): Promise<void> {
  const res = await fetch(absUrl(url));
  if (!res.ok) throw new Error(`Download failed (${res.status}). The result may have expired.`);
  const blob = await res.blob();
  // Continuous layers are served as WebP; keep the file extension honest.
  if (blob.type === 'image/webp') filename = filename.replace(/\.png$/, '.webp');
  saveBlob(blob, filename);
}

export function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'resolve';
}

/** `which` is 'input', 'output', or a layer id from result.layers. */
export function downloadPng(result: SuperresResult, which: string, name = 'resolve'): Promise<void> {
  let url: string;
  if (which === 'input') url = result.input.png;
  else if (which === 'output') url = result.output.png;
  else {
    const layer = result.layers?.find((l) => l.id === which);
    if (!layer) return Promise.reject(new Error(`Unknown layer "${which}"`));
    url = layer.url;
  }
  return downloadUrl(url, `${slug(name)}-${which}.png`);
}

export function downloadTif(result: SuperresResult, name = 'resolve'): Promise<void> {
  return downloadUrl(outputTifUrl(result), `${slug(name)}-2p5m.tif`);
}

export function downloadMetadataJson(result: SuperresResult, name: string): void {
  const payload = {
    name,
    id: result.id,
    generated: new Date().toISOString(),
    model: result.model,
    crs: result.crs,
    runtime_ms: result.runtime_ms,
    input: { width: result.input.width, height: result.input.height },
    output: { width: result.output.width, height: result.output.height },
    scene: result.scene ?? null,
    patches: result.patches ?? null,
    confidence: result.confidence ?? null,
    lock: result.lock ?? null,
    alphaearth: result.alphaearth ?? null,
    stages: result.stages ?? null,
    layers: result.layers?.map((l) => ({ id: l.id, name: l.name, group: l.group })) ?? null,
    notes: result.notes,
  };
  saveBlob(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), `${slug(name)}-metadata.json`);
}
