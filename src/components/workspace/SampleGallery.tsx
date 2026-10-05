import { useState } from 'react';
import { Calendar, Image as ImageIcon, MapPin } from 'lucide-react';
import { sampleThumbUrl, type Sample } from '../../api';

interface Props {
  samples: Sample[];
  loading: boolean;
  busy: boolean;
  activeName: string;
  onPick: (sample: Sample) => void;
  /** Grid columns on wider single-column layouts (tabs). */
  className?: string;
}

function Thumb({ id, name }: { id: string; name: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-sunken text-faint">
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
              <div key={i} className="h-[84px] animate-pulse rounded-xl border border-line bg-sunken" />
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
                  className={`flex w-full cursor-pointer items-center gap-3 rounded-xl border bg-card p-2 text-left shadow-2xs transition-all hover:border-line-strong disabled:cursor-not-allowed disabled:opacity-60 dark:shadow-none ${
                    active ? 'border-accent-text ring-1 ring-accent-text/30' : 'border-line'
                  }`}
                >
                  <Thumb id={s.id} name={s.name} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-bold text-ink">{s.name}</div>
                    {s.location && (
                      <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted">
                        <MapPin className="h-3 w-3 shrink-0" aria-hidden />
                        <span className="truncate">{s.location}</span>
                      </div>
                    )}
                    {s.date && (
                      <div className="mt-0.5 flex items-center gap-1 text-[11px] text-faint">
                        <Calendar className="h-3 w-3 shrink-0" aria-hidden />
                        <span className="truncate">{s.date}</span>
                      </div>
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
