import { useEffect, useMemo, useRef, useState } from 'react';
import type { RunState } from './RunContext';
import {
  PRE_END,
  buildEvents,
  buildPlan,
  deriveGrid,
  nativeSize,
  patchStates,
  stageViews,
  type Grid,
  type PatchState,
  type Plan,
  type SceneCtx,
  type StageView,
} from './timeline';

export interface LogLine {
  at: number;
  text: string;
}

export interface TimelineView {
  plan: Plan;
  grid: Grid;
  ctx: SceneCtx;
  stages: StageView[];
  patches: PatchState[];
  /** Backbone reached but the backend response (or its images) has not arrived yet. */
  held: boolean;
  /** Animation finished and the real result is in. */
  complete: boolean;
  failed: boolean;
  overall: number;
  elapsedMs: number;
  etaMs: number | null;
  logs: LogLine[];
  patchesDone: number;
  currentStage: number;
}

interface Clock {
  vt: number;
  elapsed: number;
  logs: LogLine[];
}

/**
 * Drives the staged animation on a virtual clock. The clock advances in real time but is
 * capped at the start of the Mamba backbone until the backend response (and its images) are
 * ready, so nothing after it can finish early and nothing visibly jumps when data arrives.
 */
export function useRunTimeline(run: RunState, assetsReady: boolean): TimelineView {
  const result = run.result;
  const ready = run.status === 'done' && assetsReady;
  const failed = run.status === 'error';

  const grid = useMemo(() => deriveGrid(result, run.dims), [result, run.dims]);
  const plan = useMemo(() => buildPlan(grid.count), [grid.count]);
  const ctx = useMemo<SceneCtx>(() => ({ result, grid, size: nativeSize(result, run.dims) }), [result, grid, run.dims]);
  const events = useMemo(() => buildEvents(plan), [plan]);

  const live = useRef({ ready, failed, plan, events, ctx, error: run.error });
  live.current = { ready, failed, plan, events, ctx, error: run.error };

  const [clock, setClock] = useState<Clock>({ vt: 0, elapsed: 0, logs: [] });

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let lastPaint = 0;
    let vt = 0;
    let idx = 0;
    let heldMs = 0;
    let nextWait = 5000;
    let errorLogged = false;
    const logs: LogLine[] = [];
    let logView: LogLine[] = [];
    const startedAt = run.startedAt;

    const tick = (now: number) => {
      const s = live.current;
      const dt = Math.min(now - last, 1500);
      last = now;
      const elapsed = Date.now() - startedAt;

      if (s.failed) {
        if (!errorLogged) {
          errorLogged = true;
          logs.push({ at: elapsed, text: `[error] ${s.error ?? 'request failed'}` });
        }
        logView = [...logs];
        setClock({ vt, elapsed, logs: logView });
        return;
      }

      vt = Math.min(vt + dt, s.ready ? s.plan.total : PRE_END);
      const held = !s.ready && vt >= PRE_END;
      let changed = false;
      while (idx < s.events.length && s.events[idx].t <= vt) {
        logs.push({ at: elapsed, text: s.events[idx].text(s.ctx) });
        idx++;
        changed = true;
      }
      if (held) {
        heldMs += dt;
        if (heldMs >= nextWait) {
          logs.push({ at: elapsed, text: `[mamba] waiting for compute (${Math.round(elapsed / 1000)} s)` });
          nextWait += 6000;
          changed = true;
        }
      }

      const done = s.ready && vt >= s.plan.total;
      if (done || changed || now - lastPaint >= 33) {
        lastPaint = now;
        if (changed) logView = [...logs];
        setClock({ vt, elapsed, logs: logView });
      }
      if (!done) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run.startedAt, run.seq]);

  const { vt } = clock;
  const held = !ready && !failed && vt >= PRE_END;
  const runtimeMs = result ? result.runtime_ms : null;
  const stages = useMemo(() => stageViews(plan, vt, runtimeMs), [plan, vt, runtimeMs]);
  const patches = useMemo(() => patchStates(plan, vt, held), [plan, vt, held]);
  const complete = ready && vt >= plan.total;

  return {
    plan,
    grid,
    ctx,
    stages,
    patches,
    held,
    complete,
    failed,
    overall: Math.min(1, vt / plan.total),
    elapsedMs: clock.elapsed,
    etaMs: held || failed ? null : Math.max(0, plan.total - vt),
    logs: clock.logs,
    patchesDone: patches.filter((p) => p === 'done').length,
    currentStage: Math.min(
      stages.findIndex((s) => s.status !== 'done') === -1 ? stages.length - 1 : stages.findIndex((s) => s.status !== 'done'),
      stages.length - 1,
    ),
  };
}
