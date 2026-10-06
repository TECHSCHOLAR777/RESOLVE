import { useState } from 'react';
import { Check, ChevronUp, Copy, Loader2, MapPin, Sparkles } from 'lucide-react';
import { sideKm, type LatLon, type SizePx } from './geo';
import type { DateMode } from '../../lib/mapState';

export interface AreaSettings {
  size: SizePx;
  dateMode: DateMode;
  dateFrom: string;
  dateTo: string;
  maxCloud: number;
}

interface Props extends AreaSettings {
  centre: LatLon;
  /** Place name, or null while unknown. */
  name: string | null;
  naming: boolean;
  onChange: (patch: Partial<AreaSettings>) => void;
  onSubmit: () => void;
  /** Why the run cannot start, shown under the button. Null when it can. */
  blocked: string | null;
  /** Phone bottom sheet: collapsible, summary row first. */
  sheet?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
}

const SIZES: { size: SizePx; time: string }[] = [
  { size: 256, time: 'about 10 s' },
  { size: 512, time: 'about 20 s' },
];

export const todayIso = () => new Date().toISOString().slice(0, 10);

const label = 'mb-2 block text-[11px] font-semibold uppercase tracking-wider text-faint';
const dateInput =
  'h-9 w-full min-w-0 select-text rounded-lg border border-line bg-card px-2.5 text-sm tabular-nums text-ink disabled:opacity-50';

function Segmented<T extends string>({ value, options, onChange, ariaLabel }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; ariaLabel: string }) {
  return (
    <div role="group" aria-label={ariaLabel} className="grid grid-flow-col auto-cols-fr rounded-lg border border-line bg-sunken p-0.5">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
          className={`h-8 cursor-pointer rounded-md px-2 text-xs font-semibold transition-colors ${
            value === o.id ? 'bg-raised text-ink shadow-sm dark:shadow-none dark:ring-1 dark:ring-line-strong' : 'text-muted hover:text-ink'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function AreaPanel(p: Props) {
  const [copied, setCopied] = useState(false);
  const coords = `${p.centre.lat.toFixed(5)}, ${p.centre.lon.toFixed(5)}`;
  const km = sideKm(p.size);
  const today = todayIso();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(coords);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  const showDetails = !p.sheet || p.expanded;

  const header = p.sheet ? (
    <button
      type="button"
      onClick={p.onToggle}
      aria-expanded={p.expanded}
      className="flex w-full cursor-pointer items-center gap-3 text-left"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-text">
        <MapPin className="h-4 w-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-ink">{p.name ?? (p.naming ? 'Finding place name' : 'Selected area')}</span>
        <span className="block truncate text-xs tabular-nums text-muted">
          {km} km square · {p.dateMode === 'latest' ? 'latest clear image' : 'date range'} · cloud ≤ {p.maxCloud} %
        </span>
      </span>
      <ChevronUp className={`h-4 w-4 shrink-0 text-faint transition-transform ${p.expanded ? 'rotate-180' : ''}`} aria-hidden />
    </button>
  ) : (
    <div>
      <h2 className="text-base font-bold text-ink">Select area</h2>
      <p className="mt-0.5 text-xs text-muted">Drag the square or click the map, then choose how to fetch the scene.</p>
    </div>
  );

  return (
    <div className={`flex min-h-0 flex-col ${p.sheet ? 'gap-3' : 'h-full'}`}>
      <div className={p.sheet ? '' : 'border-b border-line px-5 py-4'}>{header}</div>

      {showDetails && (
        <div className={`flex flex-col gap-5 ${p.sheet ? 'max-h-[min(40dvh,340px)] overflow-y-auto pb-1' : 'min-h-0 flex-1 overflow-y-auto px-5 py-5'}`}>
          {!p.sheet && (
            <section>
              <span className={label}>Area</span>
              <div className="flex items-start gap-2.5 rounded-lg border border-line bg-sunken px-3 py-2.5">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent-text" aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                    <span className="truncate" title={p.name ?? undefined}>
                      {p.name ?? (p.naming ? 'Finding place name' : 'Unnamed location')}
                    </span>
                    {p.naming && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-faint" aria-hidden />}
                  </div>
                  <div className="font-mono text-[11px] tabular-nums text-muted">{km} km × {km} km</div>
                </div>
              </div>
            </section>
          )}

          <section>
            <span className={label}>Size</span>
            <div role="group" aria-label="Selection size" className="grid grid-cols-2 gap-2">
              {SIZES.map((s) => {
                const on = p.size === s.size;
                return (
                  <button
                    key={s.size}
                    type="button"
                    aria-pressed={on}
                    onClick={() => p.onChange({ size: s.size })}
                    className={`cursor-pointer rounded-lg border px-3 py-2 text-left transition-colors ${
                      on ? 'border-[#2563EB] bg-accent-soft' : 'border-line bg-card hover:border-line-strong'
                    }`}
                  >
                    <span className={`block text-sm font-bold tabular-nums ${on ? 'text-accent-text' : 'text-ink'}`}>{sideKm(s.size)} km</span>
                    <span className="block text-[11px] text-muted">
                      {s.size} px, {s.time}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <span className={label}>Date</span>
            <Segmented
              ariaLabel="Date selection"
              value={p.dateMode}
              onChange={(v) => p.onChange({ dateMode: v })}
              options={[
                { id: 'latest', label: 'Latest clear image' },
                { id: 'range', label: 'Date range' },
              ]}
            />
            {p.dateMode === 'range' && (
              <div className="mt-2.5 grid grid-cols-2 gap-2">
                <label className="min-w-0">
                  <span className="mb-1 block text-[11px] text-muted">From</span>
                  <input
                    type="date"
                    value={p.dateFrom}
                    max={p.dateTo && p.dateTo < today ? p.dateTo : today}
                    min="2015-07-01"
                    onChange={(e) => p.onChange({ dateFrom: e.target.value })}
                    className={dateInput}
                  />
                </label>
                <label className="min-w-0">
                  <span className="mb-1 block text-[11px] text-muted">To</span>
                  <input
                    type="date"
                    value={p.dateTo}
                    max={today}
                    min={p.dateFrom || '2015-07-01'}
                    onChange={(e) => p.onChange({ dateTo: e.target.value })}
                    className={dateInput}
                  />
                </label>
              </div>
            )}
            <p className="mt-2 text-[11px] leading-snug text-muted">
              {p.dateMode === 'latest' ? 'Picks the most recent Sentinel-2 scene that is clear over this square.' : 'Picks the clearest scene captured inside the range.'}
            </p>
          </section>

          <section>
            <div className="mb-2 flex items-baseline justify-between">
              <label htmlFor="max-cloud" className="text-[11px] font-semibold uppercase tracking-wider text-faint">
                Max cloud cover
              </label>
              <output htmlFor="max-cloud" className="font-mono text-sm font-semibold tabular-nums text-ink">
                {p.maxCloud} %
              </output>
            </div>
            <input
              id="max-cloud"
              type="range"
              min={0}
              max={60}
              step={5}
              value={p.maxCloud}
              onChange={(e) => p.onChange({ maxCloud: Number(e.target.value) })}
              className="h-1.5 w-full cursor-pointer accent-[#2563EB]"
            />
            <div className="mt-1 flex justify-between font-mono text-[10px] tabular-nums text-faint">
              <span>0 %</span>
              <span>60 %</span>
            </div>
          </section>

          <section>
            <span className={label}>Centre</span>
            <div className="flex items-center justify-between gap-2 rounded-lg border border-line bg-sunken px-3 py-2">
              <span className="min-w-0 select-text truncate font-mono text-xs tabular-nums text-ink">{coords}</span>
              <button
                type="button"
                onClick={copy}
                aria-label="Copy centre coordinates"
                className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-accent-text hover:bg-accent-soft"
              >
                {copied ? <Check size={12} aria-hidden /> : <Copy size={12} aria-hidden />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </section>
        </div>
      )}

      <div className={p.sheet ? '' : 'border-t border-line px-5 py-4'}>
        <button
          type="button"
          onClick={p.onSubmit}
          disabled={!!p.blocked}
          className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#6366F1] to-[#2563EB] text-sm font-bold text-white shadow-sm transition-all hover:from-[#4F46E5] hover:to-[#1D4ED8] hover:shadow-md active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
        >
          <Sparkles className="h-4 w-4" aria-hidden />
          Enhance this area
        </button>
        <p className={`mt-2 min-h-4 text-center text-[11px] ${p.blocked ? 'text-amber-700 dark:text-amber-300' : 'text-muted'}`} role={p.blocked ? 'status' : undefined}>
          {p.blocked ?? 'Sentinel-2 L2A at 10 m, reconstructed to 2.5 m'}
        </p>
      </div>
    </div>
  );
}
