import { useCallback, useSyncExternalStore } from 'react';

const KEY = 'resolve:settings';
const EVENT = 'resolve:settings-changed';
const THEME_KEY = 'resolve:theme';

export type ViewMode = 'auto' | 'split';
export type ThemePreference = 'light' | 'dark' | 'system';

export interface Settings {
  /** 'auto' = stacked or side by side depending on the viewport; 'split' = swipe slider. */
  viewMode: ViewMode;
  /** Layer id shown first after a run ('output' = the 2.5 m image). */
  defaultLayer: string;
  showCornerLabels: boolean;
  autoReturnToWorkspace: boolean;
  telemetryExpanded: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  viewMode: 'auto',
  defaultLayer: 'output',
  showCornerLabels: true,
  autoReturnToWorkspace: true,
  telemetryExpanded: false,
};

function parse(raw: string): Settings {
  if (!raw) return DEFAULT_SETTINGS;
  try {
    const d = JSON.parse(raw) as Partial<Settings>;
    return {
      viewMode: d.viewMode === 'split' ? 'split' : 'auto',
      defaultLayer: typeof d.defaultLayer === 'string' && d.defaultLayer.trim() ? d.defaultLayer.trim() : DEFAULT_SETTINGS.defaultLayer,
      showCornerLabels: typeof d.showCornerLabels === 'boolean' ? d.showCornerLabels : DEFAULT_SETTINGS.showCornerLabels,
      autoReturnToWorkspace: typeof d.autoReturnToWorkspace === 'boolean' ? d.autoReturnToWorkspace : DEFAULT_SETTINGS.autoReturnToWorkspace,
      telemetryExpanded: typeof d.telemetryExpanded === 'boolean' ? d.telemetryExpanded : DEFAULT_SETTINGS.telemetryExpanded,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function readRaw(): string {
  try {
    return localStorage.getItem(KEY) ?? '';
  } catch {
    return '';
  }
}

let cacheRaw: string | null = null;
let cache: Settings = DEFAULT_SETTINGS;

export function getSettings(): Settings {
  const raw = readRaw();
  if (raw !== cacheRaw) {
    cacheRaw = raw;
    cache = parse(raw);
  }
  return cache;
}

export function updateSettings(patch: Partial<Settings>) {
  const next = { ...getSettings(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable: keep the change in memory for this page view */
    cacheRaw = null;
    cache = next;
  }
  window.dispatchEvent(new Event(EVENT));
}

export function resetSettings() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  cacheRaw = null;
  cache = DEFAULT_SETTINGS;
  window.dispatchEvent(new Event(EVENT));
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

export function useSettings() {
  const settings = useSyncExternalStore(subscribe, getSettings, () => DEFAULT_SETTINGS);
  const update = useCallback((patch: Partial<Settings>) => updateSettings(patch), []);
  return { settings, update, reset: resetSettings };
}

/* Theme preference. theme.tsx stores only 'light' | 'dark' under resolve:theme and treats a missing
   value as "follow the OS". These helpers use the same key, so 'system' = key removed. */

export function getThemePreference(): ThemePreference {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

/** Persist the choice and apply the .dark class immediately. */
export function setThemePreference(pref: ThemePreference) {
  const dark = pref === 'dark' || (pref === 'system' && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  try {
    if (pref === 'system') localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, pref);
  } catch {
    /* applies for this page view only */
  }
  const root = document.documentElement;
  root.classList.add('theme-switching');
  window.setTimeout(() => root.classList.remove('theme-switching'), 220);
  root.classList.toggle('dark', dark);
  window.dispatchEvent(new Event('resolve:theme-changed'));
}
