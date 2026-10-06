import { useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { sampleThumbUrl, type Sample } from '../../api';

interface Props {
  samples: Sample[];
  loading: boolean;
  busy: boolean;
  activeName: string;
  onPick: (sample: Sample) => void;
  /** Grid columns on wider single-column layouts. */
  className?: string;
}

function Thumb({ id, name }: { id: string; name: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-sunken text-faint">
      {failed ? (
        <ImageIcon className="h-5 w-5" aria-hidden />
      ) : (
        <img
          src={sampleThumbUrl(id)}
          alt={name}
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
          style={{ imageRendering: 'pixelated' }}
        />
      )}
    </div>
  );
}

export default function SampleGallery({ samples, loading, busy, activeName, onPick, className = '' }: Props) {
  return (
    <section aria-label="Sample scenes">
      <div className="mb-2.5 flex items-baseline justify-between">
        <h2 className="text-sm font-bold text-ink">Sample scenes</h2>
        {samples.length > 0 && <span className="text-[11px] text-faint">{samples.length} bundled</span>}
      </div>

      {samples.length === 0 ? (
        loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[56px] animate-pulse rounded-xl border border-line bg-sunken" />
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-line-strong p-4 text-center text-xs text-muted">
            Sample scenes are unavailable. Upload an image to get started.
          </p>
        )
      ) : (
        <ul className={`grid grid-cols-1 gap-2 ${className}`}>
          {samples.map((s) => {
            const active = s.name === activeName;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => onPick(s)}
                  disabled={busy}
                  aria-label={`Enhance ${s.name}`}
                  className={`flex w-full cursor-pointer items-center gap-3 rounded-xl border bg-card p-1.5 pr-3 text-left shadow-2xs transition-all hover:border-line-strong disabled:cursor-not-allowed disabled:opacity-60 dark:shadow-none ${
                    active ? 'border-accent-text ring-1 ring-accent-text/30' : 'border-line'
                  }`}
                >
                  <Thumb id={s.id} name={s.name} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-bold text-ink">{s.name}</div>
                    {(s.location || s.date) && (
                      <div className="mt-0.5 truncate text-[11px] text-muted">{[s.location, s.date].filter(Boolean).join(' · ')}</div>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
