/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { ArrowRight, ChevronDown, Check, Download, HelpCircle, Menu, Sparkles } from 'lucide-react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { absUrl, outputTifUrl } from './api';
import { InspectorPanel } from './components/inspector';
import { RunProvider, useRun, type RecentItem } from './components/run/RunContext';
import Drawer from './components/workspace/Drawer';
import NavSidebar, { type NavKey } from './components/workspace/NavSidebar';
import RecentActivity from './components/workspace/RecentActivity';
import SampleGallery from './components/workspace/SampleGallery';
import UploadCard from './components/workspace/UploadCard';
import Viewer from './components/workspace/Viewer';
import { useLayout } from './components/workspace/useBreakpoint';
import { ThemeToggle } from './theme';

const RunPage = lazy(() => import('./components/run/RunPage'));

export default function App() {
  return (
    <BrowserRouter>
      <RunProvider>
        <Suspense fallback={<div className="min-h-screen bg-page" />}>
          <Routes>
            <Route path="/" element={<Workspace />} />
            <Route path="/run" element={<RunPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </RunProvider>
    </BrowserRouter>
  );
}

type Tab = 'upload' | 'viewer' | 'details';
const TABS: { key: Tab; label: string }[] = [
  { key: 'upload', label: 'Upload' },
  { key: 'viewer', label: 'Viewer' },
  { key: 'details', label: 'Details' },
];

function Workspace() {
  const layout = useLayout();
  const [activeNav, setActiveNav] = useState<NavKey>('enhance');
  const [navOpen, setNavOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  // Coming back from a finished run lands on the viewer; a fresh visit starts at the upload tab.
  const { consumeFromRun } = useRun();
  const [tab, setTab] = useState<Tab>('upload');
  useEffect(() => {
    if (consumeFromRun()) setTab('viewer');
  }, [consumeFromRun]);

  const { result, imageName, recentItems, samples, isBusy, initializing, startSample, startUpload } = useRun();
  const [isSaved, setIsSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const closeInspector = useCallback(() => setInspectorOpen(false), []);
  const closeNav = useCallback(() => setNavOpen(false), []);

  const handleEnhance = () => {
    if (samples.length > 0) startSample(samples[Math.floor(Math.random() * samples.length)]);
  };

  const markSaved = () => {
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  // Download the real 2.5 m GeoTIFF, or the preview when no scene has run yet
  const handleSave = async () => {
    setSaveError(null);
    if (!result) {
      const a = document.createElement('a');
      a.href = '/assets/punjab.jpg';
      a.download = `${imageName || 'enhanced'}_2.5m.png`;
      a.click();
      markSaved();
      return;
    }
    try {
      const res = await fetch(outputTifUrl(result));
      if (!res.ok) throw new Error(`Download failed (${res.status})`);
      const href = URL.createObjectURL(await res.blob());
      const link = document.createElement('a');
      link.href = href;
      link.download = `${imageName || 'scene'}_enhanced_2.5m.tif`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(href);
      markSaved();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleSelectRecent = (item: RecentItem) => {
    if (item.sampleId) {
      startSample({ id: item.sampleId, name: item.title });
    } else if (samples.length > 0) {
      const matched = samples.find((s) => s.name.toLowerCase().includes(item.id.toLowerCase())) || samples[0];
      startSample({ id: matched.id, name: item.title });
    }
  };

  const mobile = layout === 'mobile';
  const desktop = layout === 'desktop';

  const upload = <UploadCard onFile={startUpload} />;
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
    <Viewer result={result} imageName={imageName} initializing={initializing} onOpenInspector={layout === 'laptop' ? () => setInspectorOpen(true) : undefined} />
  );

  const actions = (
    <div className="flex flex-wrap items-center justify-end gap-3 max-sm:[&>button]:flex-1">
      {saveError && (
        <span role="alert" className="mr-auto text-xs text-red-600 dark:text-red-400 max-sm:basis-full">
          {saveError}
        </span>
      )}
      <button
        type="button"
        onClick={handleEnhance}
        disabled={isBusy || samples.length === 0}
        className="flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#6366F1] to-[#2563EB] whitespace-nowrap px-6 py-2.5 text-xs font-bold text-white shadow-sm transition-all hover:from-[#4F46E5] hover:to-[#1D4ED8] hover:shadow-md active:scale-98 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Sparkles className="h-4 w-4" />
        <span>Enhance Image</span>
        <ArrowRight className="ml-1 h-3.5 w-3.5 max-sm:hidden" />
      </button>
      <button
        type="button"
        onClick={handleSave}
        disabled={isBusy}
        className="flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-accent-line bg-accent-soft px-5 py-2.5 text-xs font-semibold text-accent-text shadow-2xs transition-all hover:bg-accent-soft-hover active:scale-98 disabled:cursor-not-allowed disabled:opacity-50 dark:shadow-none"
      >
        {isSaved ? (
          <>
            <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-emerald-700 dark:text-emerald-400">Downloaded</span>
          </>
        ) : (
          <>
            <Download className="h-4 w-4" />
            <span>Save Image</span>
          </>
        )}
      </button>
    </div>
  );

  const inspector = <InspectorPanel result={result} sceneName={imageName} loading={isBusy && !result} />;
  const recent = <RecentActivity items={recentItems} onSelect={handleSelectRecent} onViewAll={() => setActiveNav('results')} />;

  return (
    <div className="flex h-dvh w-full select-none overflow-hidden bg-page font-sans text-body antialiased">
      {!mobile && <NavSidebar active={activeNav} onSelect={setActiveNav} />}

      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        {mobile ? (
          <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-line bg-card/95 px-4 backdrop-blur">
            <div className="flex items-center gap-2.5">
              <img src="/assets/logo_earth.png" alt="" className="h-8 w-8 rounded-full border border-cyan-400/30 object-cover ring-2 ring-blue-500/20" />
              <span className="text-[15px] font-black tracking-tight text-ink">RESOLVE</span>
            </div>
            <div className="flex items-center gap-1">
              <ThemeToggle />
              <button
                type="button"
                onClick={() => setNavOpen(true)}
                aria-label="Open navigation"
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-line text-body transition-colors hover:bg-sunken hover:text-ink"
              >
                <Menu className="h-5 w-5" />
              </button>
            </div>
          </header>
        ) : (
          <header className="flex h-14 shrink-0 items-center justify-end gap-3 px-6 xl:px-8">
            <button
              type="button"
              onClick={() => setActiveNav('help')}
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-transparent text-body transition-all hover:border-line hover:bg-card hover:text-ink"
              title="Help"
              aria-label="Help"
            >
              <HelpCircle className="h-5 w-5 text-muted" />
            </button>
            <ThemeToggle />
            <div className="flex cursor-pointer items-center gap-1.5 pl-1">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2563EB] text-xs font-bold text-white shadow-sm">RS</div>
              <ChevronDown className="h-3.5 w-3.5 text-muted" />
            </div>
          </header>
        )}

        <main className="mx-auto flex w-full max-w-[1800px] flex-1 flex-col gap-6 px-4 pb-8 sm:px-6 xl:px-8">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-ink sm:text-2xl xl:text-3xl">
              Enhance Satellite Imagery <span className="text-accent-text">with AI</span>
            </h1>
            <p className="mt-1 text-xs text-muted xl:text-sm">
              Upload a Sentinel-2 image and get 4× higher resolution (2.5 m) while preserving real-world fidelity.
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
              <div
                className={`grid items-start gap-5 ${
                  desktop ? 'grid-cols-[17rem_minmax(0,1fr)_19rem]' : 'grid-cols-[18rem_minmax(0,1fr)]'
                }`}
              >
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
      </div>

      <Drawer open={navOpen && mobile} onClose={closeNav} side="left" title="Navigation" bare widthClass="w-72">
        <NavSidebar
          active={activeNav}
          onSelect={(k) => {
            setActiveNav(k);
            closeNav();
          }}
          className="h-full min-h-[480px] w-full"
        />
      </Drawer>

      <Drawer open={inspectorOpen && layout === 'laptop'} onClose={closeInspector} side="right" title="Scene details" widthClass="w-[380px]">
        <div className="p-3">{inspector}</div>
      </Drawer>
    </div>
  );
}
