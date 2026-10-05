import { useCallback, useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

const KEY = 'resolve:theme';
const THEME_EVENT = 'resolve:theme-changed';
type Theme = 'light' | 'dark';

const readClass = (): Theme => (document.documentElement.classList.contains('dark') ? 'dark' : 'light');

const systemTheme = (): Theme =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

function storedTheme(): Theme | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

function apply(theme: Theme, animate: boolean) {
  const root = document.documentElement;
  if (animate) {
    root.classList.add('theme-switching');
    window.setTimeout(() => root.classList.remove('theme-switching'), 220);
  }
  root.classList.toggle('dark', theme === 'dark');
  window.dispatchEvent(new Event(THEME_EVENT));
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(readClass);

  // Stay in sync with other writers (Settings page, other toggles).
  useEffect(() => {
    const sync = () => setTheme(readClass());
    window.addEventListener(THEME_EVENT, sync);
    sync();
    return () => window.removeEventListener(THEME_EVENT, sync);
  }, []);

  // Follow the OS while the user has not chosen explicitly.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if (storedTheme()) return;
      const next = systemTheme();
      apply(next, true);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const toggle = useCallback(() => {
    const next: Theme = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* storage unavailable: choice lasts for this page view only */
    }
    apply(next, true);
  }, []);

  return { theme, toggle };
}

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const label = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
  const Icon = theme === 'dark' ? Sun : Moon;
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-transparent text-muted transition-colors hover:border-line hover:bg-card hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] ${className}`}
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}
