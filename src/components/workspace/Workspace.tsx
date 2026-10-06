import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Check, Download, FileText, MapPinned, Sparkles } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { InspectorPanel } from '../inspector';
import { useRun } from '../run/RunContext';
import { downloadTif } from '../../lib/exports';
import { useHistory, type HistoryEntry } from '../../lib/history';
import Drawer from './Drawer';
import ExportMenu from './ExportMenu';
import RecentActivity from './RecentActivity';
import SampleGallery from './SampleGallery';
import UploadCard from './UploadCard';
import Viewer from './Viewer';
import { useLayout } from './useBreakpoint';

type Tab = 'upload' | 'viewer' | 'details';
const TABS: { key: Tab; label: string }[] = [
  { key: 'upload', label: 'Upload' },
  { key: 'viewer', label: 'Viewer' },
  { key: 'details', label: 'Details' },
];

const actionBase =
  'flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-xs font-semibold transition-all active:scale-98 disabled:cursor-not-allowed disabled:opacity-50';

export default function Workspace() {
  const layout = useLayout();
  const navigate = useNavigate();
  const [inspectorOpen, setInspectorOpen] = useState(false);
  // Coming back from a finished run lands on the viewer; a fresh visit starts at the upload tab.
  const { consumeFromRun } = useRun();
  const [tab, setTab] = useState<Tab>('upload');
  useEffect(() => {
    if (consumeFromRun()) setTab('viewer');
  }, [consumeFromRun]);

  const { result, imageName, samples, isBusy, initializing, startSample, startUpload, openEntry } = useRun();
  const history = useHistory();
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [layerId, setLayerId] = useState('rgb');

  const closeInspector = useCallback(() => setInspectorOpen(false), []);

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

  const mobile = layout === 'mobile';
  const desktop = layout === 'desktop';

  const upload = (
    <>
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
          <span className="block text-xs text-muted">Pick any place and enhance its latest Sentinel-2 scene</span>
        </span>
        <ArrowRight className="h-4 w-4 shrink-0 text-faint transition-transform group-hover:translate-x-0.5" aria-hidden />
      </Link>
    </>
  );
  const gallery = (
    <SampleGallery
      samples={samples}
      loading={initializing}
      busy={isBusy}
      activeName={imageName}
      onPick={(s) => startSample({ id: s.id, name: s.name })}
      className={mobile ? 'sm:grid-cols-2' : ''}
    />
  );

  const viewer = (
    <Viewer
      result={result}
      imageName={imageName}
      initializing={initializing}
      onOpenInspector={layout === 'laptop' ? () => setInspectorOpen(true) : undefined}
      onLayerChange={setLayerId}
    />
  );

  const actions = (
    <div className="flex flex-wrap items-center justify-end gap-2 max-sm:[&>*]:flex-1">
      {actionError && (
        <span role="alert" className="mr-auto text-xs text-red-600 dark:text-red-400 max-sm:basis-full">
          {actionError}
        </span>
      )}
      <button
        type="button"
        onClick={handleSample}
        disabled={isBusy || samples.length === 0}
        className={`${actionBase} bg-gradient-to-r from-[#6366F1] to-[#2563EB] font-bold text-white shadow-sm hover:from-[#4F46E5] hover:to-[#1D4ED8] hover:shadow-md`}
      >
        <Sparkles className="h-4 w-4" aria-hidden />
        <span>Run sample</span>
      </button>
      <button
        type="button"
        onClick={handleSave}
        disabled={isBusy || !result || isSaving}
        className={`${actionBase} border border-accent-line bg-accent-soft text-accent-text shadow-2xs hover:bg-accent-soft-hover dark:shadow-none`}
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
        onClick={() => navigate('/report')}
        disabled={isBusy || !result}
        className={`${actionBase} border border-line bg-card text-body shadow-2xs hover:border-line-strong hover:text-ink dark:shadow-none`}
      >
        <FileText className="h-4 w-4" aria-hidden />
        <span>Export report</span>
      </button>
      <ExportMenu result={result} name={imageName} layerId={layerId} onError={setActionError} />
    </div>
  );

  const inspector = <InspectorPanel result={result} sceneName={imageName} loading={isBusy && !result} />;
  const recent = (
    <RecentActivity
      history={history}
      samples={samples}
      onOpenEntry={handleOpenEntry}
      onPickSample={(s) => startSample({ id: s.id, name: s.name })}
      onViewAll={() => navigate('/results')}
    />
  );

  return (
    <>
      <main className="mx-auto flex w-full max-w-[1800px] flex-1 flex-col gap-6 px-4 pb-8 sm:px-6 xl:px-8">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink sm:text-2xl xl:text-3xl">Enhance Satellite Imagery</h1>
          <p className="mt-1 text-xs text-muted xl:text-sm">
            Reconstruct Sentinel-2 scenes from 10 m to 2.5 m and see which pixels you can trust.
          </p>
        </div>

        {mobile ? (
          <>
            <div role="tablist" aria-label="Workspace sections" className="grid grid-cols-3 rounded-xl border border-line bg-sunken p-1">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  id={`tab-${t.key}`}
                  aria-selected={tab === t.key}
                  aria-controls={`panel-${t.key}`}
                  onClick={() => setTab(t.key)}
                  className={`cursor-pointer rounded-lg py-2 text-xs font-semibold transition-all ${
                    tab === t.key ? 'bg-raised text-accent-text shadow-2xs dark:shadow-none' : 'text-muted hover:text-ink'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div role="tabpanel" id="panel-upload" aria-labelledby="tab-upload" hidden={tab !== 'upload'} className="flex flex-col gap-6">
              {upload}
              {gallery}
              {recent}
            </div>
            <div role="tabpanel" id="panel-viewer" aria-labelledby="tab-viewer" hidden={tab !== 'viewer'} className="flex flex-col gap-4">
              {viewer}
              {actions}
            </div>
            {tab === 'details' && (
              <div role="tabpanel" id="panel-details" aria-labelledby="tab-details">
                {inspector}
              </div>
            )}
          </>
        ) : (
          <>
            <div className={`grid items-start gap-5 ${desktop ? 'grid-cols-[17rem_minmax(0,1fr)_19rem]' : 'grid-cols-[18rem_minmax(0,1fr)]'}`}>
              <div className="flex flex-col gap-5">
                {upload}
                {gallery}
              </div>
              <div className="flex min-w-0 flex-col gap-4">
                {viewer}
                {actions}
              </div>
              {desktop && <div className="sticky top-2 max-h-[calc(100dvh-1rem)] overflow-y-auto pr-1">{inspector}</div>}
            </div>
            {recent}
          </>
        )}
      </main>

      <Drawer open={inspectorOpen && layout === 'laptop'} onClose={closeInspector} side="right" title="Scene details" widthClass="w-[380px]">
        <div className="p-3">{inspector}</div>
      </Drawer>
    </>
  );
}
