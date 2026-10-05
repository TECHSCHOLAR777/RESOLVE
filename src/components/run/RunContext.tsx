import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { absUrl, listSamples, superresSample, superresUpload, type Sample, type SuperresResult } from '../../api';

export interface RecentItem {
  id: string;
  title: string;
  timeAgo: string;
  badge: string;
  imgUrl: string;
  sampleId?: string;
}

export const DEFAULT_RECENT_ITEMS: RecentItem[] = [
  { id: 'punjab-farmlands', title: 'Punjab Farmlands', timeAgo: '2 hours ago', badge: '4×', imgUrl: '/assets/punjab.jpg', sampleId: '01_punjab' },
  { id: 'narmada-river', title: 'Narmada River & Surrou...', timeAgo: '5 hours ago', badge: '4×', imgUrl: '/assets/narmada.jpg', sampleId: '02_narmada' },
  { id: 'forest-region', title: 'Forest Region', timeAgo: '1 day ago', badge: '4×', imgUrl: '/assets/forest.jpg', sampleId: '03_forest' },
  { id: 'ahmedabad-urban', title: 'Ahmedabad Urban Area', timeAgo: '2 days ago', badge: '4×', imgUrl: '/assets/ahmedabad.jpg', sampleId: '04_ahmedabad' },
];

const DEFAULT_SCENE_NAME = 'Agricultural Farmland & Road Corridor Scene';

export interface RunState {
  seq: number;
  label: string;
  sampleId?: string;
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
  recentItems: RecentItem[];
  samples: Sample[];
  /** True while the silent first scene load or an active run is in flight. */
  isBusy: boolean;
  initializing: boolean;
  startSample: (sample: { id: string; name: string }) => void;
  startUpload: (file: File) => void;
  retry: () => void;
  finishRun: () => void;
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
  const [recentItems, setRecentItems] = useState<RecentItem[]>(DEFAULT_RECENT_ITEMS);
  const [initializing, setInitializing] = useState(true);
  const seqRef = useRef(0);
  const runRef = useRef<RunState | null>(null);
  runRef.current = run;

  const commit = useCallback((res: SuperresResult, label: string) => {
    setResult(res);
    setImageName(label);
    setRecentItems((prev) => [
      { id: res.id, title: label, timeAgo: 'Just now', badge: '4×', imgUrl: absUrl(res.output.png) },
      ...prev.filter((item) => item.title !== label),
    ].slice(0, 8));
  }, []);

  // The request lives here, above the router outlet, so changing pages never cancels it.
  const launch = useCallback(
    (label: string, job: () => Promise<SuperresResult>, extra: { sampleId?: string; dims: { w: number; h: number } | null }) => {
      const seq = ++seqRef.current;
      setInitializing(false);
      setRun({ seq, label, job, startedAt: Date.now(), status: 'pending', result: null, error: null, ...extra });
      navigate('/run');
      job().then(
        (res) => {
          if (seq !== seqRef.current) return;
          commit(res, label);
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

  const retry = useCallback(() => {
    const r = runRef.current;
    if (r) launch(r.label, r.job, { sampleId: r.sampleId, dims: r.dims });
  }, [launch]);

  const finishRun = useCallback(() => setRun(null), []);

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
        const initial: RecentItem[] = list.map((s, idx) => ({
          id: s.id,
          title: s.name || `Scene ${s.id}`,
          timeAgo: `${(idx + 1) * 2} hours ago`,
          badge: '4×',
          imgUrl: absUrl(`/api/samples/${encodeURIComponent(s.id)}/input.png`),
          sampleId: s.id,
        }));
        setRecentItems(initial.length >= 4 ? initial : [...initial, ...DEFAULT_RECENT_ITEMS.slice(initial.length)]);
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
      recentItems,
      samples,
      isBusy: initializing || run?.status === 'pending',
      initializing,
      startSample,
      startUpload,
      retry,
      finishRun,
    }),
    [run, result, imageName, recentItems, samples, initializing, startSample, startUpload, retry, finishRun],
  );

  return <RunContext.Provider value={value}>{children}</RunContext.Provider>;
}
