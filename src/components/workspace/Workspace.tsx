import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, ChartNoAxesCombined, Download, Info, MapPinned, Sparkles, X } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useRun } from '../run/RunContext';
import { downloadTif } from '../../lib/exports';
import { useHistory, type HistoryEntry } from '../../lib/history';
import RecentActivity from './RecentActivity';
import SampleGallery from './SampleGallery';
import UploadCard from './UploadCard';
import Viewer from './Viewer';

const actionBase =
  'flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-xs font-semibold transition-all active:scale-98 disabled:cursor-not-allowed disabled:opacity-50';

export default function Workspace() {
  const navigate = useNavigate();
  const location = useLocation();
  const { result, imageName, samples, isBusy, initializing, startSample, startUpload, openEntry, consumeFromRun } = useRun();
  const history = useHistory();
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>((location.state as { notice?: string } | null)?.notice ?? null);

  // After a run (or opening a stored result) the viewer is shown first on narrow screens.
  const [fresh, setFresh] = useState(false);
  const viewerRef = useRef<HTMLDivElement>(null);
  const seenId = useRef<string | undefined>(undefined);
  const resultId = result?.id;
  useEffect(() => {
    const fromRun = consumeFromRun();
    const changed = seenId.current !== undefined && seenId.current !== resultId;
    seenId.current = resultId;
    if (!fromRun && !changed) return;
    setFresh(true);
    if (!window.matchMedia('(min-width: 1024px)').matches) viewerRef.current?.scrollIntoView({ block: 'start' });
  }, [consumeFromRun, resultId]);

  const handleSample = () => {
    if (samples.length > 0) startSample(samples[Math.floor(Math.random() * samples.length)]);
  };

  const handleSave = async () => {
    if (!result) return;
    setActionError(null);
    setIsSaving(true);
    try {
      await downloadTif(result, imageName);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2500);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenEntry = (entry: HistoryEntry) => {
    setActionError(null);
    openEntry(entry).then((ok) => {
      if (!ok) setActionError('This result is no longer available on the server.');
    });
  };

  return (
    <main className="mx-auto flex w-full max-w-[1500px] flex-1 flex-col gap-6 px-4 pb-10 pt-4 lg:pt-0 sm:px-6 xl:px-8">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-ink sm:text-2xl xl:text-3xl">Enhance Satellite Imagery</h1>
        <p className="mt-1 text-xs text-muted xl:text-sm">
          Reconstruct Sentinel-2 scenes from 10 m to 2.5 m and see which pixels you can trust.
        </p>
      </div>

      {notice && (
        <div role="status" className="flex items-start gap-2.5 rounded-xl border border-accent-line bg-accent-soft px-3.5 py-2.5 text-xs text-accent-text">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span className="flex-1">{notice}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss" className="cursor-pointer rounded p-0.5 hover:bg-accent-soft-hover">
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[20rem_minmax(0,1fr)] lg:grid-rows-[auto_1fr] xl:grid-cols-[22rem_minmax(0,1fr)] xl:gap-6">
        <div className={`flex flex-col gap-4 lg:col-start-1 lg:row-start-1 ${fresh ? 'max-lg:order-2' : 'max-lg:order-1'}`}>
          <UploadCard onFile={startUpload} />
          <Link
            to="/map"
            className="group flex items-center gap-3 rounded-2xl border border-line bg-card p-3.5 shadow-xs transition-all hover:border-line-strong hover:shadow-sm dark:shadow-none"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-text">
              <MapPinned className="h-5 w-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-ink">Select area on map</span>
              <span className="block text-xs text-muted">Pick a place and enhance its latest Sentinel-2 scene</span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-faint transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
        </div>

        <div className="lg:col-start-1 lg:row-start-2 max-lg:order-3">
          <SampleGallery
            samples={samples}
            loading={initializing}
            busy={isBusy}
            activeName={imageName}
            onPick={(s) => startSample({ id: s.id, name: s.name })}
            className="sm:grid-cols-2 lg:grid-cols-1"
          />
        </div>

        <div
          ref={viewerRef}
          className={`flex min-w-0 scroll-mt-16 flex-col gap-4 lg:col-start-2 lg:row-span-2 lg:row-start-1 ${fresh ? 'max-lg:order-1' : 'max-lg:order-2'}`}
        >
          <Viewer result={result} imageName={imageName} initializing={initializing} />

          <div className="flex flex-wrap items-center gap-2">
            {actionError && (
              <span role="alert" className="basis-full text-xs text-red-600 dark:text-red-400">
                {actionError}
              </span>
            )}
            <button
              type="button"
              onClick={() => navigate('/analysis')}
              disabled={isBusy || !result}
              className={`${actionBase} bg-gradient-to-r from-[#6366F1] to-[#2563EB] font-bold text-white shadow-sm hover:from-[#4F46E5] hover:to-[#1D4ED8] hover:shadow-md max-sm:w-full`}
            >
              <ChartNoAxesCombined className="h-4 w-4" aria-hidden />
              <span>See full analysis</span>
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isBusy || !result || isSaving}
              className={`${actionBase} border border-accent-line bg-accent-soft text-accent-text shadow-2xs hover:bg-accent-soft-hover max-sm:flex-1 dark:shadow-none`}
            >
              {isSaving ? (
                <>
                  <Download className="h-4 w-4 animate-pulse" aria-hidden />
                  <span>Preparing GeoTIFF</span>
                </>
              ) : isSaved ? (
                <>
                  <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
                  <span className="text-emerald-700 dark:text-emerald-400">Downloaded</span>
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" aria-hidden />
                  <span>Save GeoTIFF</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleSample}
              disabled={isBusy || samples.length === 0}
              className={`${actionBase} text-body hover:bg-sunken hover:text-ink max-sm:flex-1 sm:ml-auto`}
            >
              <Sparkles className="h-4 w-4" aria-hidden />
              <span>Run sample</span>
            </button>
          </div>
        </div>
      </div>

      <RecentActivity
        history={history}
        onOpenEntry={handleOpenEntry}
        onViewAll={() => navigate('/results')}
      />
    </main>
  );
}
