import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, ArrowLeft, ArrowRight, Check, RotateCcw } from 'lucide-react';
import { absUrl, sampleThumbUrl } from '../../api';
import { useRun, type RunState } from './RunContext';
import { useSettings } from '../../lib/settings';
import { ThemeToggle } from '../../theme';
import { useRunTimeline } from './useRunTimeline';
import { STAGE_COUNT } from './timeline';
import { STAGE_TITLES } from './stageTimings';
import LiveTile from './LiveTile';
import StageList from './StageList';
import Telemetry from './Telemetry';

const RETURN_DELAY_MS = 1100;

export default function RunPage() {
  const { run } = useRun();
  if (!run) return <Navigate to="/" replace />;
  return <RunView key={run.seq} run={run} />;
}

function RunView({ run }: { run: RunState }) {
  const navigate = useNavigate();
  const { finishRun, retry } = useRun();
  const { settings } = useSettings();
  const result = run.result;

  // Warm the cache with both previews; the reveal only starts once they can paint instantly.
  const [assetsReady, setAssetsReady] = useState(false);
  useEffect(() => {
    if (!result) return;
    let cancelled = false;
    let pending = 2;
    const settle = () => {
      pending -= 1;
      if (pending === 0 && !cancelled) setAssetsReady(true);
    };
    for (const path of [result.input.png, result.output.png]) {
      const img = new Image();
      img.onload = settle;
      img.onerror = settle;
      img.src = absUrl(path);
    }
    const guard = window.setTimeout(() => !cancelled && setAssetsReady(true), 8000);
    return () => {
      cancelled = true;
      window.clearTimeout(guard);
    };
  }, [result]);

  const tl = useRunTimeline(run, assetsReady);

  // Early placeholder for bundled samples; falls back to the skeleton if the thumbnail is missing.
  const [thumbFailed, setThumbFailed] = useState(false);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const baseSrc = result ? absUrl(result.input.png) : run.sampleId && !thumbFailed ? sampleThumbUrl(run.sampleId) : null;
  const dims = result
    ? { w: result.input.width, h: result.input.height }
    : natural ?? run.dims;
  const aspect = dims && dims.w > 0 && dims.h > 0 ? dims.w / dims.h : 1;

  const goBack = () => {
    navigate('/', { replace: true });
    finishRun(!!result);
  };

  useEffect(() => {
    if (!tl.complete || !settings.autoReturnToWorkspace) return;
    const t = window.setTimeout(goBack, RETURN_DELAY_MS);
    return () => window.clearTimeout(t);
    // goBack only closes over stable callbacks
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tl.complete, settings.autoReturnToWorkspace]);

  const pct = Math.floor(tl.overall * 100);
  const scene = result?.scene;
  const meta = [scene?.satellite, scene?.date, scene?.tile_id].filter(Boolean).join('  ·  ');
  const status = tl.failed ? 'Failed' : tl.complete ? 'Complete' : 'Processing';

  return (
    <div className="min-h-screen w-full bg-page font-sans text-body antialiased">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 px-4 py-5 sm:px-6 lg:py-8">
        {/* Header */}
        <header className="rounded-2xl border border-line bg-card p-4 shadow-xs dark:shadow-none sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-extrabold tracking-tight text-ink sm:text-2xl">{status}</h1>
                {tl.complete && <Check className="h-5 w-5 text-accent-text" strokeWidth={2.5} />}
              </div>
              <p className="mt-0.5 truncate text-sm font-medium text-body">{run.label}</p>
              <p className="mt-0.5 min-h-4 font-mono text-[11px] text-faint">{meta}</p>
            </div>
            <div className="flex items-start gap-3">
              <ThemeToggle className="-mt-1" />
              <div className="text-right">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-faint">Elapsed</div>
              <div className="font-mono text-xl tabular-nums text-ink">{(tl.elapsedMs / 1000).toFixed(1)} s</div>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <div className="h-1.5 overflow-hidden rounded-full bg-sunken" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <div
                className={`h-full rounded-full ${tl.failed ? 'bg-slate-400' : 'bg-[#2563EB]'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-muted">
              <span className="font-mono tabular-nums text-ink">{pct}%</span>
              <span className="tabular-nums">
                {tl.failed
                  ? 'Stopped'
                  : tl.complete
                    ? 'Result ready'
                    : tl.held
                      ? 'Waiting for compute'
                      : `ETA ${Math.max(1, Math.ceil((tl.etaMs ?? 0) / 1000))} s`}
              </span>
            </div>
          </div>
        </header>

        <AnimatePresence initial={false}>
          {run.status === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              role="alert"
              className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-red-200 bg-red-50/60 p-4 dark:border-red-500/30 dark:bg-red-500/10"
            >
              <AlertTriangle className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
              <div className="min-w-0 flex-1 basis-40">
                <div className="text-sm font-semibold text-red-900 dark:text-red-200">Processing failed</div>
                <div className="break-words text-xs text-red-800/80 dark:text-red-300/80">{run.error}</div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={retry}
                  className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-card px-3 py-2 text-xs font-semibold text-red-800 transition-colors hover:bg-red-50 dark:border-red-500/30 dark:text-red-200 dark:hover:bg-red-500/10 cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Try again
                </button>
                <button
                  type="button"
                  onClick={goBack}
                  className="flex items-center gap-1.5 rounded-lg bg-[#2563EB] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#1D4ED8] cursor-pointer"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back to workspace
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Live tile and stages */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <section className="rounded-2xl border border-line bg-card p-4 shadow-xs dark:shadow-none lg:col-span-7">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-ink">Live tile</h2>
              <span className="font-mono text-[11px] text-faint">128 px patches, 32 px overlap</span>
            </div>
            <LiveTile
              outputSrc={result && tl.patches.some((p) => p !== 'queued') ? absUrl(result.output.png) : null}
              baseSrc={baseSrc}
              onBaseError={() => setThumbFailed(true)}
              onBaseSize={(w, h) => !result && w > 0 && h > 0 && setNatural({ w, h })}
              aspect={aspect}
              grid={tl.grid}
              patches={tl.patches}
              waiting={!result || tl.held}
              failed={tl.failed}
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-[11px] text-muted">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm border border-line-strong bg-card" />
                  Queued
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-blue-500/20 shadow-[inset_0_0_0_1.5px_#3B82F6]" />
                  Reconstructing
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-slate-700" />
                  Reconstructed
                </span>
              </div>
              <span className="font-mono tabular-nums">
                10 m input, 2.5 m output
              </span>
            </div>
          </section>

          <section className="rounded-2xl border border-line bg-card p-4 shadow-xs dark:shadow-none lg:col-span-5">
            <h2 className="mb-1 text-sm font-bold text-ink">Pipeline</h2>
            <StageList views={tl.stages} ctx={tl.ctx} held={tl.held} failed={tl.failed} />
          </section>
        </div>

        <Telemetry
          patchesDone={tl.patchesDone}
          patchTotal={tl.grid.count}
          stageTitle={STAGE_TITLES[tl.currentStage]}
          stageIndex={tl.currentStage}
          stageTotal={STAGE_COUNT}
          elapsedMs={tl.elapsedMs}
          waiting={tl.held}
          logs={tl.logs}
        />

        <AnimatePresence>
          {tl.complete && (
            <motion.div
              key="done"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="flex justify-end"
            >
              <button
                type="button"
                onClick={goBack}
                className="flex items-center gap-2 rounded-xl bg-[#2563EB] px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#1D4ED8] cursor-pointer"
              >
                View result
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
