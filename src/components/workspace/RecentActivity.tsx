import { useState } from 'react';
import { ArrowRight, Download } from 'lucide-react';
import { sampleThumbUrl, type Sample } from '../../api';
import { downloadUrl, slug } from '../../lib/exports';
import type { HistoryEntry } from '../../lib/history';
import { relativeTime } from '../../lib/time';

interface Props {
  history: HistoryEntry[];
  /** Shown only while history is empty, so the section is never made up. */
  samples: Sample[];
  onOpenEntry: (entry: HistoryEntry) => void;
  onPickSample: (sample: Sample) => void;
  onViewAll: () => void;
}

const ring = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB]';

function Badge({ children }: { children: string }) {
  return (
    <div className="absolute right-2 top-2 rounded border border-amber-200/60 bg-amber-50/90 px-1.5 py-0.5 text-[10px] font-bold text-amber-900 shadow-2xs backdrop-blur-xs dark:border-amber-300/20 dark:bg-amber-400/15 dark:text-amber-200 dark:shadow-none">
      {children}
    </div>
  );
}

function Card({ title, subtitle, imgUrl, badge, onOpen, onDownload }: { title: string; subtitle: string; imgUrl: string; badge: string; onOpen: () => void; onDownload?: () => void }) {
  return (
    <div className="group flex flex-col justify-between overflow-hidden rounded-xl border border-line bg-card shadow-2xs transition-all hover:shadow-md dark:shadow-none dark:hover:border-line-strong dark:hover:shadow-none">
      <button type="button" onClick={onOpen} className={`block cursor-pointer text-left ${ring}`} aria-label={`Open ${title}`}>
        <div className="relative aspect-[16/10] overflow-hidden bg-sunken">
          <img src={imgUrl} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
          <Badge>{badge}</Badge>
        </div>
      </button>
      <div className="flex items-center justify-between gap-2 p-3">
        <div className="min-w-0">
          <div className="truncate text-xs font-bold text-ink" title={title}>{title}</div>
          <div className="mt-0.5 truncate text-[11px] text-faint">{subtitle}</div>
        </div>
        {onDownload && (
          <button
            type="button"
            onClick={onDownload}
            className={`flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-faint transition-colors hover:bg-accent-soft hover:text-accent-text ${ring}`}
            title="Download 2.5 m PNG"
            aria-label={`Download ${title} as PNG`}
          >
            <Download className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

export default function RecentActivity({ history, samples, onOpenEntry, onPickSample, onViewAll }: Props) {
  const [error, setError] = useState<string | null>(null);
  const entries = history.slice(0, 4);
  const fallback = samples.slice(0, 4);
  if (entries.length === 0 && fallback.length === 0) return null;

  const download = (e: HistoryEntry) => {
    setError(null);
    downloadUrl(e.outputUrl, `${slug(e.name)}-2p5m.png`).catch((err: unknown) => setError(err instanceof Error ? err.message : 'Download failed'));
  };

  return (
    <section aria-label="Recent activity">
      <div className="mb-3.5 flex items-center justify-between">
        <h2 className="text-base font-bold text-ink">{entries.length > 0 ? 'Recent Activity' : 'Try a sample scene'}</h2>
        {entries.length > 0 && (
          <button
            type="button"
            onClick={onViewAll}
            className={`flex cursor-pointer items-center gap-1 rounded text-xs font-semibold text-accent-text transition-colors hover:text-accent-text-hover ${ring}`}
          >
            <span>View All</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="mb-2 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {entries.length > 0
          ? entries.map((e) => (
              <Card
                key={e.id}
                title={e.name}
                subtitle={relativeTime(e.createdAt)}
                imgUrl={e.thumbUrl}
                badge="4×"
                onOpen={() => onOpenEntry(e)}
                onDownload={() => download(e)}
              />
            ))
          : fallback.map((s) => (
              <Card
                key={s.id}
                title={s.name}
                subtitle={[s.location, s.date].filter(Boolean).join(' · ') || 'Sample scene'}
                imgUrl={sampleThumbUrl(s.id)}
                badge="Sample"
                onOpen={() => onPickSample(s)}
              />
            ))}
      </div>
    </section>
  );
}
