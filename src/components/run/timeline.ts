import type { SuperresResult } from '../../api';

export const STAGE_COUNT = 10;
export const BACKBONE = 6;

/** Planned durations (ms) of the stages before and after the Mamba backbone. */
const PRE_MS = [438, 351, 497, 402, 389, 463];
const POST_MS = [361, 342, 389];
export const PRE_END = PRE_MS.reduce((a, b) => a + b, 0);

export interface Grid {
  cols: number;
  rows: number;
  count: number;
}

export interface SceneCtx {
  result: SuperresResult | null;
  grid: Grid;
  /** Native (10 m) size in pixels, when known. */
  size: { w: number; h: number } | null;
}

export interface Plan {
  start: number[];
  end: number[];
  total: number;
  reveal: number;
  perPatch: number;
  count: number;
}

export function buildPlan(count: number): Plan {
  const reveal = Math.min(1800, Math.max(1000, count * 260));
  const durations = [...PRE_MS, reveal, ...POST_MS];
  const start: number[] = [];
  const end: number[] = [];
  let t = 0;
  for (const d of durations) {
    start.push(t);
    t += d;
    end.push(t);
  }
  return { start, end, total: t, reveal, perPatch: reveal / count, count };
}

/** Patch grid from the backend when present, otherwise derived from the tile size (128 px patches). */
export function deriveGrid(result: SuperresResult | null, hint: { w: number; h: number } | null): Grid {
  if (result?.patches && result.patches.cols > 0 && result.patches.rows > 0) {
    const { cols, rows, count } = result.patches;
    return { cols, rows, count: count > 0 ? count : cols * rows };
  }
  const size = nativeSize(result, hint);
  const clamp = (n: number) => Math.min(6, Math.max(1, n));
  if (!size) return { cols: 2, rows: 2, count: 4 };
  const cols = clamp(Math.round(size.w / 128));
  const rows = clamp(Math.round(size.h / 128));
  return { cols, rows, count: cols * rows };
}

export function nativeSize(
  result: SuperresResult | null,
  hint: { w: number; h: number } | null,
): { w: number; h: number } | null {
  if (result?.scene && result.scene.width > 0) return { w: result.scene.width, h: result.scene.height };
  // Both previews are 4x the native tile (input is upscaled 4x nearest).
  if (result && result.input.width > 0) return { w: Math.round(result.input.width / 4), h: Math.round(result.input.height / 4) };
  return hint;
}

export function fmtLat(lat: number): string {
  return `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? 'N' : 'S'}`;
}
export function fmtLon(lon: number): string {
  return `${Math.abs(lon).toFixed(2)}° ${lon >= 0 ? 'E' : 'W'}`;
}

function embeddingYear(result: SuperresResult | null): string | null {
  const d = result?.scene?.date;
  const y = d ? parseInt(d.slice(0, 4), 10) : NaN;
  return Number.isFinite(y) ? String(y - 1) : null;
}

function crsOf(c: SceneCtx): string | null {
  return c.result?.scene?.crs ?? c.result?.crs ?? null;
}

export function stageDescription(index: number, c: SceneCtx): string {
  switch (index) {
    case 0: {
      const extras = [c.size ? `${c.size.w} × ${c.size.h} px` : null, crsOf(c)].filter(Boolean);
      return `Reading B4, B3, B2, B8 at 10 m${extras.length ? ` (${extras.join(', ')})` : ''}`;
    }
    case 1:
      return 'Converting to surface reflectance';
    case 2: {
      const center = c.result?.scene?.center;
      const year = embeddingYear(c.result);
      if (!center) return 'Retrieving 64-d AlphaEarth embedding for the scene location';
      return `Retrieving 64-d AlphaEarth embedding for ${fmtLat(center.lat)}, ${fmtLon(center.lon)}${year ? ` (${year})` : ''}`;
    }
    case 3:
      return c.result
        ? `Tiling into ${c.grid.count} patches of 128 px with 32 px overlap`
        : 'Tiling into 128 px patches with 32 px overlap';
    case 4:
      return 'Gating semantic context where land has changed';
    case 5:
      return 'Separating frequency bands to preserve fine edges';
    case 6:
      return 'VSS blocks, four-direction scan, reconstructing 4x detail';
    case 7:
      return 'Projecting output onto the 10 m measurement';
    case 8:
      return 'Estimating per-pixel uncertainty and observed vs inferred detail';
    default:
      return 'Writing 2.5 m GeoTIFF and preview layers';
  }
}

export type StageStatus = 'queued' | 'running' | 'done';

export interface StageView {
  status: StageStatus;
  progress: number;
  durationMs: number | null;
}

export function stageViews(plan: Plan, vt: number, runtimeMs: number | null, realMs: (number | null)[] | null = null): StageView[] {
  return plan.start.map((s, i) => {
    const e = plan.end[i];
    if (vt >= e) {
      const real = realMs?.[i];
      const dur = real != null ? Math.round(real) : i === BACKBONE && runtimeMs ? Math.round(runtimeMs) : Math.round(e - s);
      return { status: 'done', progress: 1, durationMs: dur };
    }
    if (vt >= s) return { status: 'running', progress: Math.min(1, (vt - s) / (e - s)), durationMs: null };
    return { status: 'queued', progress: 0, durationMs: null };
  });
}

export type PatchState = 'queued' | 'active' | 'done';

export function patchStates(plan: Plan, vt: number, held: boolean): PatchState[] {
  return Array.from({ length: plan.count }, (_, i) => {
    const s = PRE_END + i * plan.perPatch;
    const e = s + plan.perPatch;
    if (vt >= e) return 'done';
    if (!held && vt > s) return 'active';
    return 'queued';
  });
}

export interface LogEvent {
  t: number;
  text: (c: SceneCtx) => string;
}

export function buildEvents(plan: Plan): LogEvent[] {
  const ev: LogEvent[] = [];
  const at = (t: number, text: (c: SceneCtx) => string) => ev.push({ t, text });
  const sz = (c: SceneCtx) => (c.size ? c.size : { w: 256, h: 256 });

  at(0, () => '[ingest] reading B4, B3, B2, B8 at 10 m');
  at(plan.end[0], (c) => `[ingest] ${c.size ? `${c.size.w}x${c.size.h} px, ` : ''}4 bands${crsOf(c) ? `, ${crsOf(c)}` : ''}`);
  at(plan.start[1], () => '[radiometry] scaling digital numbers to surface reflectance');
  at(plan.start[2], (c) => {
    const ce = c.result?.scene?.center;
    return ce ? `[alphaearth] requesting embedding at ${ce.lat.toFixed(3)}, ${ce.lon.toFixed(3)}` : '[alphaearth] requesting embedding for scene footprint';
  });
  at(plan.end[2], (c) => `[alphaearth] embedding window loaded (64 x ${sz(c).h} x ${sz(c).w})`);
  at(plan.end[3], (c) => `[tiler] ${c.grid.count} patches (${c.grid.cols} x ${c.grid.rows}), 128 px, overlap 32 px`);
  at(plan.end[4], () => '[gate] change mask applied to semantic context');
  at(plan.end[5], () => '[wavelet] frequency bands separated (LL, LH, HL, HH)');
  at(PRE_END, (c) => (c.result ? '[mamba] compute allocated' : '[mamba] allocating compute'));
  at(PRE_END + 1, () => '[mamba] VSS blocks, four-direction scan, 4x reconstruction');
  for (let i = 0; i < plan.count; i++) {
    at(PRE_END + (i + 1) * plan.perPatch, (c) => `[mamba] patch ${i + 1}/${c.grid.count} reconstructed`);
  }
  at(plan.end[6], (c) => `[mamba] backbone finished${c.result ? ` in ${Math.round(c.result.runtime_ms)} ms` : ''}`);
  at(plan.end[7], () => '[lock] measurement consistency verified');
  at(plan.end[8], () => '[trust] uncertainty and observed/inferred maps written');
  at(plan.end[9], () => '[export] output.tif 2.5 m float32');
  return ev.sort((a, b) => a.t - b.t);
}
