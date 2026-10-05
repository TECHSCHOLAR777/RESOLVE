import { useEffect, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  side: 'left' | 'right';
  title: string;
  /** Hide the built-in title bar (the content brings its own chrome). */
  bare?: boolean;
  widthClass?: string;
  children: ReactNode;
}

const DURATION_MS = 220;

/** Slide-over panel with overlay, close button and Esc to close. */
export default function Drawer({ open, onClose, side, title, bare = false, widthClass = 'w-[360px]', children }: DrawerProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  // `mounted` keeps the panel in the DOM while it slides out; `shown` drives the CSS transition.
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const id = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
      return () => cancelAnimationFrame(id);
    }
    setShown(false);
    const t = window.setTimeout(() => setMounted(false), DURATION_MS);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [open, mounted, onClose]);

  if (!mounted) return null;

  const hidden = side === 'right' ? 'translate-x-full' : '-translate-x-full';
  return (
    <div className="fixed inset-0 z-50">
      <div
        className={`absolute inset-0 bg-slate-950/55 transition-opacity duration-200 ${shown ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`absolute inset-y-0 ${side === 'right' ? 'right-0 border-l' : 'left-0 border-r'} flex max-w-full flex-col border-line bg-page shadow-2xl transition-transform duration-200 ease-out ${shown ? 'translate-x-0' : hidden} ${widthClass}`}
      >
        {bare ? (
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={`Close ${title}`}
            className="absolute right-3 top-3 z-20 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-white/20 bg-white/15 text-white backdrop-blur transition-colors hover:bg-white/25"
          >
            <X className="h-4 w-4" />
          </button>
        ) : (
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-line px-4">
            <h2 className="text-sm font-bold text-ink">{title}</h2>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label={`Close ${title}`}
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-line text-muted transition-colors hover:bg-sunken hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
