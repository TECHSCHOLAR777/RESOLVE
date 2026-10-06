import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Crosshair, Loader2, MapPin, Search, X } from 'lucide-react';
import { parseCoords, type LatLon } from './geo';
import { searchPlaces, type Place } from './nominatim';

const DEBOUNCE_MS = 650;
const MIN_CHARS = 3;

interface Props {
  onPlace: (place: Place) => void;
  onPoint: (point: LatLon) => void;
}

export default function SearchBox({ onPlace, onPoint }: Props) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [locating, setLocating] = useState(false);

  const coords = parseCoords(q);

  // Debounced search; every keystroke aborts the previous request so stale answers never land.
  useEffect(() => {
    const text = q.trim();
    setActive(-1);
    if (text.length < MIN_CHARS || parseCoords(text)) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    const t = window.setTimeout(() => {
      searchPlaces(text, ctrl.signal).then(
        (r) => {
          if (ctrl.signal.aborted) return;
          setResults(r);
          setError(null);
          setLoading(false);
        },
        (e: unknown) => {
          if (ctrl.signal.aborted) return;
          setError(e instanceof Error ? e.message : 'Search failed');
          setResults([]);
          setLoading(false);
        },
      );
    }, DEBOUNCE_MS);
    return () => {
      window.clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const pick = useCallback(
    (p: Place) => {
      setQ(p.name);
      setOpen(false);
      setResults([]);
      setLoading(false);
      onPlace(p);
      inputRef.current?.blur();
    },
    [onPlace],
  );

  const jump = useCallback(
    (pt: LatLon) => {
      setOpen(false);
      onPoint(pt);
      inputRef.current?.blur();
    },
    [onPoint],
  );

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (results.length === 0) return;
      e.preventDefault();
      setOpen(true);
      const n = results.length;
      setActive((i) => (e.key === 'ArrowDown' ? (i + 1) % n : (i - 1 + n) % n));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (coords) jump(coords);
      else if (active >= 0 && results[active]) pick(results[active]);
      else if (results.length > 0) pick(results[0]);
    } else if (e.key === 'Escape') {
      if (open) {
        e.preventDefault();
        setOpen(false);
      } else if (q) setQ('');
    }
  };

  const locate = () => {
    setOpen(true);
    if (!navigator.geolocation) {
      setError('Geolocation is not available in this browser');
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setQ('');
        setOpen(false);
        onPoint({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      },
      (err) => {
        setLocating(false);
        setError(err.code === err.PERMISSION_DENIED ? 'Location permission was denied' : 'Could not determine your location');
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  };

  const typed = q.trim().length >= MIN_CHARS;
  const showList = open && (results.length > 0 || loading || !!error || !!coords || typed);
  const noResults = !loading && !error && !coords && results.length === 0 && typed;

  return (
    <div ref={rootRef} className="rounded-xl border border-line bg-card/95 shadow-lg backdrop-blur dark:shadow-none">
      <div className="flex items-center gap-1 p-1.5">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" aria-hidden />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={showList}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
            aria-label="Search for a place or enter coordinates"
            autoComplete="off"
            spellCheck={false}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
              setError(null);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKey}
            placeholder="Search a place or 28.61, 77.21"
            className="h-9 w-full select-text rounded-lg bg-transparent pl-8 pr-8 text-sm text-ink placeholder:text-faint focus-visible:outline-offset-0"
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin text-faint" aria-label="Searching" />
            ) : q ? (
              <button
                type="button"
                onClick={() => {
                  setQ('');
                  inputRef.current?.focus();
                }}
                aria-label="Clear search"
                className="flex h-5 w-5 cursor-pointer items-center justify-center rounded text-muted hover:text-ink"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            ) : null}
          </span>
        </div>
        <button
          type="button"
          onClick={locate}
          disabled={locating}
          aria-label="Use my location"
          title="Use my location"
          className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-line text-body transition-colors hover:bg-sunken hover:text-ink disabled:cursor-wait disabled:opacity-60"
        >
          {locating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Crosshair className="h-4 w-4" aria-hidden />}
        </button>
      </div>

      {showList && (
        <div className="border-t border-line">
          <ul id={listId} role="listbox" aria-label="Search results" className="max-h-[min(50dvh,320px)] overflow-y-auto p-1">
            {coords && (
              <li role="option" aria-selected id={`${listId}-coords`}>
                <button
                  type="button"
                  onClick={() => jump(coords)}
                  className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg bg-sunken px-2.5 py-2 text-left"
                >
                  <MapPin className="h-4 w-4 shrink-0 text-accent-text" aria-hidden />
                  <span className="min-w-0 text-sm text-ink">
                    Go to{' '}
                    <span className="font-mono tabular-nums">
                      {coords.lat.toFixed(4)}, {coords.lon.toFixed(4)}
                    </span>
                  </span>
                </button>
              </li>
            )}
            {results.map((p, i) => (
              <li key={p.id} role="option" id={`${listId}-${i}`} aria-selected={i === active}>
                <button
                  type="button"
                  onClick={() => pick(p)}
                  onMouseEnter={() => setActive(i)}
                  className={`flex w-full cursor-pointer items-start gap-2.5 rounded-lg px-2.5 py-2 text-left ${i === active ? 'bg-sunken' : ''}`}
                >
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-faint" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-ink">{p.name}</span>
                      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-faint">{p.kind}</span>
                    </span>
                    <span className="block truncate text-xs text-muted">{p.context}</span>
                  </span>
                </button>
              </li>
            ))}
            {loading && results.length === 0 && <li className="px-2.5 py-2 text-xs text-muted">Searching</li>}
            {noResults && <li className="px-2.5 py-2 text-xs text-muted">No places found</li>}
            {error && (
              <li role="alert" className="px-2.5 py-2 text-xs text-red-600 dark:text-red-400">
                {error}
              </li>
            )}
          </ul>
        </div>
      )}
      <div className="border-t border-line-soft px-3 py-1 text-[10px] text-faint">
        Search by{' '}
        <a href="https://nominatim.org" target="_blank" rel="noreferrer" className="underline decoration-dotted underline-offset-2 hover:text-muted">
          OpenStreetMap Nominatim
        </a>
      </div>
    </div>
  );
}
