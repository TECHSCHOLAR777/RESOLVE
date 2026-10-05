import type { StageTiming } from '../../api';

export const STAGE_TITLES = [
  'Sentinel-2 ingest',
  'Reflectance normalisation',
  'AlphaEarth context',
  'Sensor-matched patching',
  'AlphaEarth change gate',
  'Wavelet texture branch',
  'Mamba backbone',
  'Measurement lock',
  'Trust layer',
  'Products',
];

// Ordered: the first matching pattern wins, so "alphaearth_gate" lands on the gate stage, not the context stage.
const MATCHERS: [RegExp, number][] = [
  [/gate|change/, 4],
  [/wavelet|texture/, 5],
  [/lock|measurement|consisten/, 7],
  [/trust|uncert|confiden/, 8],
  [/alphaearth|embed|context/, 2],
  [/patch|tile|tiling/, 3],
  [/mamba|backbone|model|infer|forward|network/, 6],
  [/product|export|write|layer|output/, 9],
  [/normal|radiom|reflect|scal/, 1],
  [/ingest|read|load|fetch|sentinel/, 0],
];

/** Real per-stage milliseconds from the backend, aligned to the ten displayed stages (null where unknown). */
export function mapStageMs(stages: StageTiming[] | null | undefined): (number | null)[] {
  const out: (number | null)[] = Array(STAGE_TITLES.length).fill(null);
  if (!stages) return out;
  for (const s of stages) {
    const id = s.id.toLowerCase();
    const hit = MATCHERS.find(([re]) => re.test(id));
    if (!hit || !Number.isFinite(s.ms)) continue;
    out[hit[1]] = (out[hit[1]] ?? 0) + s.ms;
  }
  return out;
}
