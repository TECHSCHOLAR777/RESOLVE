import { useEffect, useMemo, useRef, useState } from 'react';
import { ChartNoAxesCombined, Download, ImageOff, Layers, RotateCcw, Search, Trash2, X } from 'lucide-react';
import type { AreaParams } from '../../api';
import { clearRuns, removeRun, useHistory, type HistoryEntry } from '../../lib/history';
import { downloadUrl, slug } from '../../lib/exports';
import { relativeTime } from '../../lib/time';
import PageHeader, { focusRing } from './PageHeader';

export interface MyResultsPageProps {
  /** Resolve false when the stored result can no longer be loaded. */
  onOpen: (entry: HistoryEntry) => void | boolean | Promise<boolean | void>;
  /** Open the stored result and land on the full analysis screen. */
  onAnalysis: (entry: HistoryEntry) => void | boolean | Promise<boolean | void>;
  onRerunSample: (sampleId: string) => void;
  onRerunArea?: (area: AreaParams) => void;
  /** Empty-state call to action. Falls back to a plain link to "/". */
  onGoToWorkspace?: () => void;
}

type Filter = 'all' | 'sample' | 'upload' | 'area';
type Sort = 'newest' | 'oldest';

function formatRuntime(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`;
}

function Card({ entry, onOpen, onAnalysis, onRerunSample, onRerunArea }: { entry: HistoryEntry } & Pick<MyResultsPageProps, 'onOpen' | 'onAnalysis' | 'onRerunSample' | 'onRerunArea'>) {
  const [expired, setExpired] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rerun = entry.area && onRerunArea ? () => onRerunArea(entry.area!) : entry.sampleId ? () => onRerunSample(entry.sampleId!) : null;
  const meta = [entry.scene?.satellite, entry.scene?.date].filter(Boolean).join(' · ');

  const download = async () => {
    setBusy(true);
    setError(null);
    try {
      await downloadUrl(entry.tifUrl, `${slug(entry.name)}-2p5m.tif`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Download failed');
      setExpired(true);
    } finally {
      setBusy(false);
    }
  };

  const open = async () => {
    if ((await onOpen(entry)) === false) setExpired(true);
  };
  const openAnalysis = async () => {
    if ((await onAnalysis(entry)) === false) setExpired(true);
  };

  return (
    <li className="group flex flex-col overflow-hidden rounded-xl border border-line bg-card shadow-sm">
      <button
        type="button"
        onClick={() => (expired ? rerun?.() : open())}
        disabled={expired && !rerun}
        aria-label={expired ? `${entry.name}: result expired` : `Open ${entry.name}`}
        className={`relative block aspect-[4/3] w-full cursor-pointer overflow-hidden bg-sunken disabled:cursor-default ${focusRing}`}
      >
        {expired ? (
          <span className="flex h-full flex-col items-center justify-center gap-2 text-muted">
            <ImageOff size={22} aria-hidden />
            <span className="text-xs font-medium">Result expired</span>
          </span>
        ) : (
          <img
            src={entry.thumbUrl}
            alt=""
            loading="lazy"
            onError={() => setExpired(true)}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        )}
        <span className="absolute left-2 top-2 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white backdrop-blur-sm">
          {entry.kind === 'sample' ? 'Sample' : entry.kind === 'area' ? 'Map area' : 'Upload'}
        </span>
      </button>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-ink" title={entry.name}>
            {entry.name}
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            <time dateTime={entry.createdAt} title={new Date(entry.createdAt).toLocaleString()}>
              {relativeTime(entry.createdAt)}
            </time>
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs tabular-nums">
          <dt className="text-muted">Scene</dt>
          <dd className="truncate text-right text-body">{meta || 'Not available'}</dd>
          <dt className="text-muted">Size</dt>
          <dd className="text-right text-body">{entry.scene ? `${entry.scene.width} × ${entry.scene.height} px` : 'Not available'}</dd>
          <dt className="text-muted">Runtime</dt>
          <dd className="text-right text-body">{formatRuntime(entry.runtime_ms)}</dd>
        </dl>

        {error && (
          <p role="alert" className="text-xs text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        <div className="mt-auto flex items-center gap-2 border-t border-line-soft pt-3">
          {expired ? (
            rerun && (
              <button
                type="button"
                onClick={rerun}
                className={`inline-flex h-8 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-[#2563EB] px-3 text-xs font-semibold text-white transition-colors hover:bg-[#1d4ed8] ${focusRing}`}
              >
                <RotateCcw size={13} aria-hidden /> Run again
              </button>
            )
          ) : (
            <>
              <button
                type="button"
                onClick={open}
                className={`inline-flex h-8 flex-1 cursor-pointer items-center justify-center rounded-lg bg-[#2563EB] px-3 text-xs font-semibold text-white transition-colors hover:bg-[#1d4ed8] ${focusRing}`}
              >
                Open
              </button>
              <button
                type="button"
                onClick={openAnalysis}
                className={`inline-flex h-8 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-line bg-raised px-3 text-xs font-semibold text-body transition-colors hover:border-line-strong hover:text-ink ${focusRing}`}
              >
                <ChartNoAxesCombined size={13} aria-hidden /> Analysis
              </button>
              <button
                type="button"
                onClick={download}
                disabled={busy}
                title="Download GeoTIFF"
                aria-label={`Download ${entry.name} as GeoTIFF`}
                className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-muted transition-colors hover:bg-sunken hover:text-ink disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`}
              >
                <Download size={15} className={busy ? 'animate-pulse' : ''} aria-hidden />
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => removeRun(entry.id)}
            aria-label={`Remove ${entry.name} from history`}
            title="Remove from history"
            className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-muted transition-colors hover:bg-sunken hover:text-red-600 dark:hover:text-red-400 ${focusRing}`}
          >
            <Trash2 size={15} aria-hidden />
          </button>
        </div>
      </div>
    </li>
  );
}

function ConfirmClear({ count, onCancel, onConfirm }: { count: number; onCancel: () => void; onConfirm: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onCancel}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="clear-title"
        aria-describedby="clear-desc"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-xl border border-line bg-card p-5 shadow-xl"
      >
        <h2 id="clear-title" className="text-base font-semibold text-ink">
          Clear run history?
        </h2>
        <p id="clear-desc" className="mt-1.5 text-sm text-muted">
          This removes {count} {count === 1 ? 'entry' : 'entries'} from this browser. Results on the server are not affected, but they are not kept permanently.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            ref={ref}
            type="button"
            onClick={onCancel}
            className={`h-9 cursor-pointer rounded-lg border border-line bg-raised px-4 text-sm font-medium text-body hover:text-ink ${focusRing}`}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`h-9 cursor-pointer rounded-lg bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700 ${focusRing}`}
          >
            Clear history
          </button>
        </div>
      </div>
    </div>
  );
}

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'sample', label: 'Samples' },
  { id: 'upload', label: 'Uploads' },
  { id: 'area', label: 'Map areas' },
];

export default function MyResultsPage({ onOpen, onAnalysis, onRerunSample, onRerunArea, onGoToWorkspace }: MyResultsPageProps) {
  const entries = useHistory();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('newest');
  const [confirming, setConfirming] = useState(false);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = entries.filter((e) => {
      if (filter !== 'all' && e.kind !== filter) return false;
      if (!q) return true;
      return [e.name, e.scene?.satellite, e.scene?.date, e.scene?.tile_id].some((v) => v?.toLowerCase().includes(q));
    });
    list.sort((a, b) => (sort === 'newest' ? -1 : 1) * a.createdAt.localeCompare(b.createdAt));
    return list;
  }, [entries, query, filter, sort]);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <PageHeader
        title="My results"
        subtitle="Runs from this browser. The server keeps only the most recent results for a limited time, so older entries may show as expired."
        actions={
          entries.length > 0 ? (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className={`inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-card px-3 text-sm font-medium text-body transition-colors hover:border-line-strong hover:text-ink ${focusRing}`}
            >
              <Trash2 size={14} aria-hidden /> Clear history
            </button>
          ) : null
        }
      />

      {entries.length === 0 ? (
        <div className="mt-10 flex flex-col items-center rounded-xl border border-dashed border-line-strong bg-card px-6 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent-text">
            <Layers size={22} aria-hidden />
          </div>
          <h2 className="mt-4 text-base font-semibold text-ink">No results yet</h2>
          <p className="mt-1 max-w-sm text-sm text-muted">Process a sample scene or upload a Sentinel-2 GeoTIFF. Finished runs are listed here.</p>
          {onGoToWorkspace ? (
            <button type="button" onClick={onGoToWorkspace} className={`mt-5 inline-flex h-9 cursor-pointer items-center rounded-lg bg-[#2563EB] px-4 text-sm font-semibold text-white hover:bg-[#1d4ed8] ${focusRing}`}>
              Go to workspace
            </button>
          ) : (
            <a href="/" className={`mt-5 inline-flex h-9 items-center rounded-lg bg-[#2563EB] px-4 text-sm font-semibold text-white hover:bg-[#1d4ed8] ${focusRing}`}>
              Go to workspace
            </a>
          )}
        </div>
      ) : (
        <>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="relative block min-w-0 flex-1 sm:max-w-sm">
              <span className="sr-only">Search results</span>
              <Search size={15} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, satellite or date"
                className={`h-9 w-full rounded-lg border border-line bg-card pl-9 pr-8 text-sm text-ink placeholder:text-faint ${focusRing}`}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 cursor-pointer items-center justify-center rounded text-muted hover:text-ink"
                >
                  <X size={14} aria-hidden />
                </button>
              )}
            </label>

            <div className="flex flex-wrap items-center gap-3">
              <div role="group" aria-label="Filter by type" className="inline-flex rounded-lg border border-line bg-sunken p-0.5">
                {FILTERS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    aria-pressed={filter === f.id}
                    onClick={() => setFilter(f.id)}
                    className={`h-8 cursor-pointer whitespace-nowrap rounded-md px-2.5 text-xs sm:px-3 font-semibold transition-colors ${focusRing} ${
                      filter === f.id ? 'bg-card text-ink shadow-sm' : 'text-muted hover:text-ink'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-2 text-xs text-muted">
                <span className="sr-only sm:not-sr-only">Sort</span>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as Sort)}
                  className={`h-9 cursor-pointer rounded-lg border border-line bg-card px-2 text-sm text-ink ${focusRing}`}
                >
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                </select>
              </label>
            </div>
          </div>

          <p className="mt-4 text-xs tabular-nums text-muted" aria-live="polite">
            {visible.length} of {entries.length} {entries.length === 1 ? 'result' : 'results'}
          </p>

          {visible.length === 0 ? (
            <p className="mt-10 text-center text-sm text-muted">No results match your search.</p>
          ) : (
            <ul className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {visible.map((e) => (
                <Card key={e.id} entry={e} onOpen={onOpen} onAnalysis={onAnalysis} onRerunSample={onRerunSample} onRerunArea={onRerunArea} />
              ))}
            </ul>
          )}
        </>
      )}

      {confirming && (
        <ConfirmClear
          count={entries.length}
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            clearRuns();
            setConfirming(false);
          }}
        />
      )}
    </div>
  );
}
