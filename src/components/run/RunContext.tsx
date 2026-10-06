import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { listSamples, superresArea, superresSample, superresUpload, type AreaParams, type Sample, type SuperresResult } from '../../api';
import { addRun, type HistoryEntry, type RunMeta } from '../../lib/history';
import { saveMapState } from '../../lib/mapState';

const DEFAULT_SCENE_NAME = 'Agricultural Farmland & Road Corridor Scene';

export interface RunState {
  seq: number;
  label: string;
  sampleId?: string;
  /** Set for map-area runs. */
  area?: AreaParams;
  /** Native size of the scene when known up front (bundled samples). */
  dims: { w: number; h: number } | null;
  startedAt: number;
  status: 'pending' | 'done' | 'error';
  result: SuperresResult | null;
  error: string | null;
  job: () => Promise<SuperresResult>;
}

interface RunContextValue {
  run: RunState | null;
  result: SuperresResult | null;
  imageName: string;
  samples: Sample[];
  /** True while the silent first scene load or an active run is in flight. */
  isBusy: boolean;
  initializing: boolean;
  startSample: (sample: { id: string; name: string }) => void;
  startUpload: (file: File) => void;
  startArea: (params: AreaParams) => void;
  retry: () => void;
  /** Close the run view. `to` is where a RunPage that is still mounted should redirect (default: the workspace). */
  finishRun: (completed?: boolean, to?: string) => void;
  exitPath: () => string;
  /** Open a stored run: current result, a sample re-run, or an upload rebuilt from its URLs. Resolves false when the images are gone. */
  openEntry: (entry: HistoryEntry, to?: string) => Promise<boolean>;
  /** Where a finished run should return to (default '/'); resets after being read. */
  consumeReturnPath: () => string;
  /** True once after a finished run returned to the workspace, so it can open on the viewer. */
  consumeFromRun: () => boolean;
}

const RunContext = createContext<RunContextValue | null>(null);

export function useRun(): RunContextValue {
  const ctx = useContext(RunContext);
  if (!ctx) throw new Error('useRun must be used inside RunProvider');
  return ctx;
}

export function RunProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [run, setRun] = useState<RunState | null>(null);
  const [result, setResult] = useState<SuperresResult | null>(null);
  const [imageName, setImageName] = useState(DEFAULT_SCENE_NAME);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [initializing, setInitializing] = useState(true);
  const seqRef = useRef(0);
  const runRef = useRef<RunState | null>(null);
  runRef.current = run;

  /** Show a result in the workspace. Only real runs (with meta) are recorded in history. */
  const commit = useCallback((res: SuperresResult, label: string, meta?: RunMeta) => {
    setResult(res);
    setImageName(label);
    if (meta) addRun(res, meta);
  }, []);

  // The request lives here, above the router outlet, so changing pages never cancels it.
  const launch = useCallback(
    (label: string, job: () => Promise<SuperresResult>, extra: { sampleId?: string; area?: AreaParams; dims: { w: number; h: number } | null }) => {
      const seq = ++seqRef.current;
      returnRef.current = '/';
      setInitializing(false);
      setRun({ seq, label, job, startedAt: Date.now(), status: 'pending', result: null, error: null, ...extra });
      navigate('/run');
      job().then(
        (res) => {
          if (seq !== seqRef.current) return;
          commit(res, label, {
            name: label,
            kind: extra.area ? 'area' : extra.sampleId ? 'sample' : 'upload',
            sampleId: extra.sampleId,
            area: extra.area,
          });
          setRun((r) => (r && r.seq === seq ? { ...r, status: 'done', result: res } : r));
        },
        (err: unknown) => {
          if (seq !== seqRef.current) return;
          const message = err instanceof Error ? err.message : String(err);
          setRun((r) => (r && r.seq === seq ? { ...r, status: 'error', error: message } : r));
        },
      );
    },
    [commit, navigate],
  );

  const startSample = useCallback(
    (sample: { id: string; name: string }) => {
      const meta = samples.find((s) => s.id === sample.id);
      launch(sample.name, () => superresSample(sample.id), {
        sampleId: sample.id,
        dims: meta && meta.width > 0 ? { w: meta.width, h: meta.height } : null,
      });
    },
    [launch, samples],
  );

  const startUpload = useCallback(
    (file: File) => launch(file.name.replace(/\.[^/.]+$/, ''), () => superresUpload(file), { dims: null }),
    [launch],
  );

  const startArea = useCallback(
    (params: AreaParams) => {
      const label = params.name?.trim() || `${params.lat.toFixed(4)}, ${params.lon.toFixed(4)}`;
      // Keep the selection so "Back to map" lands on the same square.
      saveMapState({
        centre: { lat: params.lat, lon: params.lon },
        size: params.size_px,
        maxCloud: params.max_cloud,
        dateMode: params.date_from || params.date_to ? 'range' : 'latest',
        dateFrom: params.date_from ?? '',
        dateTo: params.date_to ?? '',
        name: params.name,
        view: { lat: params.lat, lon: params.lon, zoom: params.size_px === 512 ? 13 : 14 },
      });
      launch(label, () => superresArea({ ...params, name: label }), { area: params, dims: { w: params.size_px, h: params.size_px } });
    },
    [launch],
  );

  const retry = useCallback(() => {
    const r = runRef.current;
    if (r) launch(r.label, r.job, { sampleId: r.sampleId, area: r.area, dims: r.dims });
  }, [launch]);

  const fromRunRef = useRef(false);
  const returnRef = useRef('/');
  const consumeReturnPath = useCallback(() => {
    const v = returnRef.current;
    returnRef.current = '/';
    return v;
  }, []);
  const exitRef = useRef('/');
  const finishRun = useCallback((completed = false, to = '/') => {
    fromRunRef.current = completed;
    exitRef.current = to;
    setRun(null);
  }, []);
  const exitPath = useCallback(() => exitRef.current, []);
  const consumeFromRun = useCallback(() => {
    const v = fromRunRef.current;
    fromRunRef.current = false;
    return v;
  }, []);

  const resultId = result?.id;
  const openEntry = useCallback(
    async (entry: HistoryEntry, to = '/'): Promise<boolean> => {
      if (entry.id === resultId) {
        fromRunRef.current = true;
        navigate(to);
        return true;
      }
      if (entry.area) {
        // Area results are re-run from their parameters when the stored result is gone.
        const probe = await new Promise<boolean>((resolve) => {
          const img = new Image();
          img.onload = () => resolve(true);
          img.onerror = () => resolve(false);
          img.src = entry.outputUrl;
        });
        if (!probe) {
          startArea(entry.area);
          returnRef.current = to;
          return true;
        }
      } else if (entry.kind === 'sample' && entry.sampleId) {
        startSample({ id: entry.sampleId, name: samples.find((s) => s.id === entry.sampleId)?.name ?? entry.name });
        returnRef.current = to;
        return true;
      }
      // Uploads cannot be re-run without the file, so show the stored result if the server still has it.
      const size = await new Promise<{ w: number; h: number } | null>((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
        img.onerror = () => resolve(null);
        img.src = entry.outputUrl;
      });
      if (!size) return false;
      const rebuilt: SuperresResult = {
        id: entry.id,
        input: { width: size.w, height: size.h, png: entry.thumbUrl },
        output: { width: size.w, height: size.h, png: entry.outputUrl },
        runtime_ms: entry.runtime_ms,
        model: 'RESOLVE',
        crs: null,
        notes: [],
        scene: null,
      };
      commit(rebuilt, entry.name);
      fromRunRef.current = true;
      navigate(to);
      return true;
    },
    [resultId, startSample, startArea, samples, commit, navigate],
  );

  // Silent first load: fetch the sample list and show the first scene in the workspace.
  useEffect(() => {
    let cancelled = false;
    const seq = seqRef.current;
    (async () => {
      try {
        const list = await listSamples();
        if (cancelled) return;
        setSamples(list);
        if (list.length === 0) return;
        const first = list[0];
        const res = await superresSample(first.id);
        if (cancelled || seq !== seqRef.current) return;
        commit(res, first.name || DEFAULT_SCENE_NAME);
      } catch (err) {
        if (!cancelled) console.warn('Backend offline, running in visual mode:', err);
      } finally {
        if (!cancelled && seq === seqRef.current) setInitializing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [commit]);

  const value = useMemo<RunContextValue>(
    () => ({
      run,
      result,
      imageName,
      samples,
      isBusy: initializing || run?.status === 'pending',
      initializing,
      startSample,
      startUpload,
      startArea,
      retry,
      finishRun,
      exitPath,
      consumeFromRun,
      consumeReturnPath,
      openEntry,
    }),
    [run, result, imageName, samples, initializing, startSample, startUpload, startArea, retry, finishRun, exitPath, consumeFromRun, openEntry],
  );

  return <RunContext.Provider value={value}>{children}</RunContext.Provider>;
}
