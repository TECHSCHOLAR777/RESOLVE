import { Gauge } from 'lucide-react';
import type { SuperresResult } from '../../api';
import { Card, NA, Skeleton } from './ui';

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  const missing = value === NA;
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-950/60">
      <div className="text-[11px] text-slate-500 dark:text-slate-400">{label}</div>
      <div className={`mt-0.5 whitespace-nowrap tabular-nums ${missing ? 'text-sm text-slate-400 dark:text-slate-500' : 'text-lg font-semibold text-slate-900 dark:text-slate-100'}`}>
        {value}
        {unit && !missing && <span className="ml-1 text-xs font-normal text-slate-500 dark:text-slate-400">{unit}</span>}
      </div>
    </div>
  );
}

export default function MetricsCard({ result, loading }: { result: SuperresResult | null; loading?: boolean }) {
  if (!result) {
    return (
      <Card title="Metrics" icon={<Gauge size={13} aria-hidden />}>
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className={`h-14 ${loading ? '' : 'animate-none opacity-60'}`} />
          ))}
        </div>
        {!loading && <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Run a scene to see metrics.</p>}
      </Card>
    );
  }
  const { scene, patches } = result;
  const nf = (n: number) => n.toLocaleString('en-US');
  const px = scene?.pixel_size_m;
  const outPx = px ? px / 4 : null;
  const inW = scene && scene.width > 0 ? scene.width : Math.round(result.input.width / 4);
  const inH = scene && scene.width > 0 ? scene.height : Math.round(result.input.height / 4);
  const { confidence, lock } = result;
  const pct = (v: number) => `${(v * 100).toFixed(1)}`;
  const area = scene && px ? (scene.width * px * scene.height * px) / 1e6 : null;

  return (
    <Card title="Metrics" icon={<Gauge size={13} aria-hidden />}>
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Runtime" value={nf(Math.round(result.runtime_ms))} unit="ms" />
        <Stat label="Scale factor" value="4×" />
        <Stat label="Input size (px)" value={`${inW} × ${inH}`} />
        <Stat label="Output size (px)" value={`${result.output.width} × ${result.output.height}`} />
        <Stat label="Patches" value={patches ? nf(patches.count) : NA} unit={patches ? `${patches.cols} × ${patches.rows}` : undefined} />
        <Stat label="Output resolution" value={outPx ? String(outPx) : NA} unit="m/px" />
        <div className="col-span-2">
          <Stat label="Ground area covered" value={area != null ? area.toFixed(2) : NA} unit="km²" />
        </div>
        {confidence && <Stat label="Mean confidence" value={pct(confidence.mean)} unit="%" />}
        {confidence && <Stat label="High-confidence share" value={pct(confidence.high_fraction)} unit="%" />}
        {lock && (
          <div className="col-span-2">
            <Stat label="Measurement-lock consistency" value={`${lock.consistency_before.toFixed(3)} → ${lock.consistency_after.toFixed(3)}`} />
          </div>
        )}
      </div>
    </Card>
  );
}
