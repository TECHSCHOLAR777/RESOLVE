import { Gauge, Globe2, Lock, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import type { SuperresResult } from '../../api';

function Stat({ icon, label, value, hint }: { icon: ReactNode; label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-xl border border-line bg-card p-3 sm:p-3.5 shadow-2xs dark:shadow-none">
      <span className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft sm:flex text-accent-text">{icon}</span>
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-faint">{label}</div>
        <div className="mt-0.5 truncate text-base font-bold sm:text-lg tabular-nums text-ink">{value}</div>
        {hint && <div className="mt-0.5 text-[11px] text-muted">{hint}</div>}
      </div>
    </div>
  );
}

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

/** Headline trust figures. Only stats the result actually carries are shown. */
export default function TrustStrip({ result }: { result: SuperresResult }) {
  const { confidence, lock, alphaearth } = result;
  const reduction = lock && lock.consistency_before > 0 ? (1 - lock.consistency_after / lock.consistency_before) * 100 : null;
  const cards: ReactNode[] = [];

  if (confidence) {
    cards.push(
      <Stat key="mean" icon={<Gauge className="h-4.5 w-4.5" aria-hidden />} label="Mean confidence" value={pct(confidence.mean)} hint="Average over all output pixels" />,
      <Stat key="high" icon={<ShieldCheck className="h-4.5 w-4.5" aria-hidden />} label="High confidence" value={pct(confidence.high_fraction)} hint="Share of pixels you can trust" />,
    );
  }
  if (lock) {
    cards.push(
      <Stat
        key="lock"
        icon={<Lock className="h-4.5 w-4.5" aria-hidden />}
        label="Measurement lock"
        value={
          <>
            {lock.consistency_before.toFixed(3)} <span className="text-faint">→</span> {lock.consistency_after.toFixed(3)}
          </>
        }
        hint={reduction != null && reduction > 0 ? `${reduction.toFixed(0)}% lower inconsistency` : 'Consistency with the 10 m input'}
      />,
    );
  }
  if (alphaearth) {
    cards.push(
      <Stat
        key="aef"
        icon={<Globe2 className="h-4.5 w-4.5" aria-hidden />}
        label="AlphaEarth context"
        value={alphaearth.available ? (alphaearth.year ?? 'Available') : 'Unavailable'}
        hint={alphaearth.available ? 'Embedding year used as context' : (alphaearth.note ?? 'No embedding for this scene')}
      />,
    );
  }
  if (cards.length === 0) return null;

  return (
    <section aria-label="Trust summary" className={`grid grid-cols-2 gap-2.5 sm:gap-3 ${cards.length >= 4 ? 'lg:grid-cols-4' : cards.length === 3 ? 'lg:grid-cols-3' : ''}`}>
      {cards}
    </section>
  );
}
