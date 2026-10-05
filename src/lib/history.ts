import { useSyncExternalStore } from 'react';
import { absUrl, outputTifUrl, sampleThumbUrl, type SuperresResult } from '../api';

const KEY = 'resolve:history';
const EVENT = 'resolve:history-changed';
const MAX_ENTRIES = 50;

export interface HistoryScene {
  center: { lat: number; lon: number };
  date: string | null;
  satellite: string | null;
  tile_id: string | null;
  width: number;
  height: number;
}

export interface HistoryEntry {
  /** Backend result id. */
  id: string;
  name: string;
  kind: 'sample' | 'upload';
  sampleId?: string;
  createdAt: string;
  runtime_ms: number;
  scene?: HistoryScene;
  thumbUrl: string;
  outputUrl: string;
  tifUrl: string;
}

export interface RunMeta {
  name: string;
  kind: 'sample' | 'upload';
  sampleId?: string;
}

function isEntry(v: unknown): v is HistoryEntry {
  if (!v || typeof v !== 'object') return false;
  const e = v as Record<string, unknown>;
  return typeof e.id === 'string' && typeof e.name === 'string' && typeof e.createdAt === 'string' && typeof e.outputUrl === 'string';
}

function readRaw(): string {
  try {
    return localStorage.getItem(KEY) ?? '';
  } catch {
    return '';
  }
}

function parse(raw: string): HistoryEntry[] {
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    return Array.isArray(data) ? data.filter(isEntry) : [];
  } catch {
    return [];
  }
}

function write(entries: HistoryEntry[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch {
    /* storage unavailable or full: history just will not persist */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function listRuns(): HistoryEntry[] {
  return parse(readRaw());
}

export function addRun(result: SuperresResult, meta: RunMeta): HistoryEntry {
  const s = result.scene;
  const entry: HistoryEntry = {
    id: result.id,
    name: meta.name,
    kind: meta.kind,
    sampleId: meta.sampleId,
    createdAt: new Date().toISOString(),
    runtime_ms: result.runtime_ms,
    scene: s
      ? { center: s.center, date: s.date, satellite: s.satellite, tile_id: s.tile_id, width: s.width, height: s.height }
      : undefined,
    thumbUrl: meta.kind === 'sample' && meta.sampleId ? sampleThumbUrl(meta.sampleId) : absUrl(result.input.png),
    outputUrl: absUrl(result.output.png),
    tifUrl: outputTifUrl(result),
  };
  write([entry, ...listRuns().filter((e) => e.id !== entry.id)]);
  return entry;
}

export function removeRun(id: string) {
  write(listRuns().filter((e) => e.id !== id));
}

export function clearRuns() {
  write([]);
}

// useSyncExternalStore needs a stable snapshot, so cache the parsed list per raw string.
let cacheRaw: string | null = null;
let cacheList: HistoryEntry[] = [];

function getSnapshot(): HistoryEntry[] {
  const raw = readRaw();
  if (raw !== cacheRaw) {
    cacheRaw = raw;
    cacheList = parse(raw);
  }
  return cacheList;
}

function subscribe(cb: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === KEY) cb();
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(EVENT, cb);
  };
}

const EMPTY: HistoryEntry[] = [];

export function useHistory(): HistoryEntry[] {
  return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
}
