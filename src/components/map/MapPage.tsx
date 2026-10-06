import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapPinned } from 'lucide-react';
import { useRun } from '../run/RunContext';
import { useLayout } from '../workspace/useBreakpoint';
import { loadMapState, saveMapState, type MapState } from '../../lib/mapState';
import AreaPanel, { todayIso, type AreaSettings } from './AreaPanel';
import { clampLat, wrapLon, type LatLon } from './geo';
import type { FlyRequest } from './MapCanvas';
import { reversePlace, type Place } from './nominatim';
import SearchBox from './SearchBox';

const MapCanvas = lazy(() => import('./MapCanvas'));

const REVERSE_DEBOUNCE_MS = 900;

function MapFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-sunken text-muted" aria-busy="true">
      <div className="flex flex-col items-center gap-2">
        <MapPinned className="h-6 w-6 animate-pulse" aria-hidden />
        <span className="text-xs">Loading map</span>
      </div>
    </div>
  );
}

export default function MapPage() {
  const layout = useLayout();
  const sheet = layout === 'mobile';
  const { run, startArea } = useRun();

  // Restored once; later changes are written back below.
  const [initial] = useState<MapState>(loadMapState);
  const [centre, setCentre] = useState<LatLon>(initial.centre);
  const [name, setName] = useState<string | null>(initial.name);
  const [naming, setNaming] = useState(false);
  const [settings, setSettings] = useState<AreaSettings>({
    size: initial.size,
    dateMode: initial.dateMode,
    dateFrom: initial.dateFrom,
    dateTo: initial.dateTo,
    maxCloud: initial.maxCloud,
  });
  const [basemap, setBasemap] = useState<MapState['basemap']>(initial.basemap);
  const [fly, setFly] = useState<FlyRequest | null>(null);
  const [expanded, setExpanded] = useState(false);
  const flyId = useRef(0);

  // Reverse geocoding: debounced, one request at a time, stale answers dropped.
  const reverseTimer = useRef<number | undefined>(undefined);
  const reverseAbort = useRef<AbortController | null>(null);
  const scheduleReverse = useCallback((c: LatLon) => {
    window.clearTimeout(reverseTimer.current);
    reverseAbort.current?.abort();
    setNaming(true);
    reverseTimer.current = window.setTimeout(() => {
      const ctrl = new AbortController();
      reverseAbort.current = ctrl;
      reversePlace(c.lat, c.lon, ctrl.signal).then(
        (n) => {
          if (ctrl.signal.aborted) return;
          setName(n);
          setNaming(false);
        },
        () => {
          if (ctrl.signal.aborted) return;
          setName(null);
          setNaming(false);
        },
      );
    }, REVERSE_DEBOUNCE_MS);
  }, []);

  useEffect(() => {
    if (!initial.name) scheduleReverse(initial.centre);
    return () => {
      window.clearTimeout(reverseTimer.current);
      reverseAbort.current?.abort();
    };
  }, [initial, scheduleReverse]);

  const onMove = useCallback(
    (c: LatLon, final: boolean) => {
      setCentre(c);
      if (final) scheduleReverse(c);
      else {
        window.clearTimeout(reverseTimer.current);
        reverseAbort.current?.abort();
        setName(null);
        setNaming(false);
      }
    },
    [scheduleReverse],
  );

  const goTo = useCallback((c: LatLon, bbox: FlyRequest['bbox'], placeName: string | null) => {
    const point = { lat: clampLat(c.lat), lon: wrapLon(c.lon) };
    window.clearTimeout(reverseTimer.current);
    reverseAbort.current?.abort();
    setCentre(point);
    setFly({ id: ++flyId.current, bbox, point });
    if (placeName) {
      setName(placeName);
      setNaming(false);
    } else {
      scheduleReverse(point);
    }
  }, [scheduleReverse]);

  const onPlace = useCallback((p: Place) => goTo({ lat: p.lat, lon: p.lon }, p.bbox, p.name), [goTo]);
  const onPoint = useCallback((pt: LatLon) => goTo(pt, null, null), [goTo]);

  const patchSettings = useCallback((patch: Partial<AreaSettings>) => setSettings((s) => ({ ...s, ...patch })), []);

  // Persist the selection (debounced) and the map view (from the canvas).
  useEffect(() => {
    const t = window.setTimeout(
      () => saveMapState({ centre, name, basemap, size: settings.size, dateMode: settings.dateMode, dateFrom: settings.dateFrom, dateTo: settings.dateTo, maxCloud: settings.maxCloud }),
      250,
    );
    return () => window.clearTimeout(t);
  }, [centre, name, basemap, settings]);
  const onView = useCallback((view: MapState['view']) => saveMapState({ view }), []);

  const blocked = useMemo(() => {
    if (run?.status === 'pending') return 'Another enhancement is still running.';
    if (settings.dateMode === 'range') {
      const { dateFrom: f, dateTo: t } = settings;
      if (!f || !t) return 'Choose both dates, or switch to the latest clear image.';
      if (f > t) return 'The start date must not be after the end date.';
      if (t > todayIso()) return 'The end date cannot be in the future.';
    }
    return null;
  }, [run?.status, settings]);

  const submit = () => {
    if (blocked) return;
    const range = settings.dateMode === 'range';
    startArea({
      lat: Number(centre.lat.toFixed(5)),
      lon: Number(centre.lon.toFixed(5)),
      size_px: settings.size,
      date_from: range ? settings.dateFrom : null,
      date_to: range ? settings.dateTo : null,
      max_cloud: settings.maxCloud,
      name,
    });
  };

  const panel = (
    <AreaPanel
      {...settings}
      centre={centre}
      name={name}
      naming={naming}
      onChange={patchSettings}
      onSubmit={submit}
      blocked={blocked}
      sheet={sheet}
      expanded={expanded}
      onToggle={() => setExpanded((e) => !e)}
    />
  );

  return (
    <div className={`flex min-h-0 flex-1 ${sheet ? 'flex-col' : 'flex-row'} ${sheet ? 'min-h-[480px]' : 'min-h-[560px]'}`}>
      <div className={`relative min-h-0 flex-1 ${sheet ? "min-h-[200px]" : ""}`}>
        <Suspense fallback={<MapFallback />}>
          <MapCanvas
            centre={centre}
            size={settings.size}
            basemap={basemap}
            onBasemap={setBasemap}
            initialView={initial.view}
            fly={fly}
            onMove={onMove}
            onView={onView}
          />
        </Suspense>
        <div className="rs-ui absolute inset-x-3 top-3 z-[1000] sm:right-auto sm:w-[360px]">
          <SearchBox onPlace={onPlace} onPoint={onPoint} />
        </div>
      </div>

      {sheet ? (
        <section aria-label="Selection" className="z-10 shrink-0 rounded-t-2xl border-t border-line bg-card px-4 pb-4 pt-3 shadow-[0_-8px_24px_rgba(15,23,42,0.12)] dark:shadow-none">
          {panel}
        </section>
      ) : (
        <aside aria-label="Selection" className="w-[340px] shrink-0 border-l border-line bg-card">
          {panel}
        </aside>
      )}
    </div>
  );
}
