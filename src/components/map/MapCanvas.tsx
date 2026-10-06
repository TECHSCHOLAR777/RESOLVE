import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, Marker, Rectangle, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Layers, LocateFixed, Minus, Plus } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import { clampLat, fmtCentre, sideKm, squareBounds, wrapLon, type LatLon, type SizePx } from './geo';
import type { MapState } from '../../lib/mapState';

export type Basemap = MapState['basemap'];

export interface FlyRequest {
  id: number;
  /** [south, west, north, east] of a searched place, when it has one. */
  bbox: [number, number, number, number] | null;
  point: LatLon;
}

interface Props {
  centre: LatLon;
  size: SizePx;
  basemap: Basemap;
  onBasemap: (b: Basemap) => void;
  initialView: MapState['view'];
  fly: FlyRequest | null;
  /** `final` is false while the square is being dragged and true when the gesture ends or the map is clicked. */
  onMove: (c: LatLon, final: boolean) => void;
  onView: (view: MapState['view']) => void;
}

const EOX_URL = 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2023_3857/default/g/{z}/{y}/{x}.jpg';
const EOX_ATTRIBUTION =
  'Sentinel-2 cloudless - <a href="https://s2maps.eu" target="_blank" rel="noreferrer">https://s2maps.eu</a> by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2023)';
const OSM_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors';
// Only the street map is darkened; inverting satellite imagery would falsify what the user is selecting.
const OSM_DARK_FILTER = '[filter:invert(1)_hue-rotate(180deg)_brightness(0.92)_contrast(0.88)_saturate(0.7)]';

const SAT_MAX_ZOOM = 16;
const OSM_MAX_ZOOM = 19;
const TINY_PX = 12;

function useIsDark(): boolean {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => {
    const el = document.documentElement;
    const obs = new MutationObserver(() => setDark(el.classList.contains('dark')));
    obs.observe(el, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

const ctrlBtn =
  'flex size-8 cursor-pointer items-center justify-center bg-card text-body transition-colors hover:bg-sunken hover:text-ink';

/** Zoom, recentre and basemap controls, kept above the map and out of its click handling. */
function Controls({ centre, size, basemap, onBasemap }: Pick<Props, 'centre' | 'size' | 'basemap' | 'onBasemap'>) {
  const map = useMap();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    L.DomEvent.disableClickPropagation(ref.current);
    L.DomEvent.disableScrollPropagation(ref.current);
  }, []);
  const recentre = () => {
    const b = squareBounds(centre, size);
    map.flyToBounds(b, { padding: [60, 60], maxZoom: 15 });
  };
  return (
    <div
      ref={ref}
      className="rs-ui absolute right-3 top-[8.5rem] z-[1000] flex select-none flex-col items-end gap-2 sm:top-3"
    >
      <div className="flex flex-col overflow-hidden rounded-lg border border-line bg-card shadow-md dark:shadow-none">
        <button type="button" aria-label="Zoom in" onClick={() => map.zoomIn()} className={`${ctrlBtn} border-b border-line`}>
          <Plus size={15} aria-hidden />
        </button>
        <button type="button" aria-label="Zoom out" onClick={() => map.zoomOut()} className={`${ctrlBtn} border-b border-line`}>
          <Minus size={15} aria-hidden />
        </button>
        <button type="button" aria-label="Zoom to selection" title="Zoom to selection" onClick={recentre} className={ctrlBtn}>
          <LocateFixed size={15} aria-hidden />
        </button>
      </div>
      <div
        role="group"
        aria-label="Basemap"
        className="flex items-center gap-0.5 rounded-lg border border-line bg-card p-0.5 text-[11px] font-semibold shadow-md dark:shadow-none"
      >
        <Layers size={13} aria-hidden className="mx-1.5 text-faint" />
        {(
          [
            ['satellite', 'Satellite'],
            ['osm', 'Map'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={basemap === key}
            onClick={() => onBasemap(key)}
            className={`h-7 cursor-pointer rounded-md px-2.5 transition-colors ${
              basemap === key ? 'bg-accent-soft text-accent-text' : 'text-muted hover:text-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Keeps Leaflet's size in sync when the layout changes (bottom sheet, window resize). */
function ResizeSync() {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    const ro = new ResizeObserver(() => map.invalidateSize({ pan: false }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [map]);
  return null;
}

/** Clamps zoom to the basemap's range. */
function ZoomLimit({ basemap }: { basemap: Basemap }) {
  const map = useMap();
  useEffect(() => {
    const max = basemap === 'satellite' ? SAT_MAX_ZOOM : OSM_MAX_ZOOM;
    map.setMaxZoom(max);
    if (map.getZoom() > max) map.setZoom(max);
  }, [map, basemap]);
  return null;
}

function ViewReporter({ onView }: { onView: Props['onView'] }) {
  const map = useMapEvents({
    moveend: () => {
      const c = map.getCenter();
      onView({ lat: c.lat, lon: c.lng, zoom: map.getZoom() });
    },
  });
  return null;
}

function FlyHandler({ fly, size }: { fly: FlyRequest | null; size: SizePx }) {
  const map = useMap();
  const lastId = useRef<number | null>(null);
  useEffect(() => {
    if (!fly || fly.id === lastId.current) return;
    lastId.current = fly.id;
    if (fly.bbox) {
      const [s, w, n, e] = fly.bbox;
      const b = L.latLngBounds([s, w], [n, e]);
      const z = Math.min(14, Math.max(11, map.getBoundsZoom(b, false, L.point(40, 40))));
      map.flyTo([fly.point.lat, fly.point.lon], z, { duration: 0.9 });
    } else {
      // Zoom so the whole square fits with room around it, whatever the screen size.
      const fit = map.getBoundsZoom(L.latLngBounds(squareBounds(fly.point, size)), false, L.point(70, 70));
      map.flyTo([fly.point.lat, fly.point.lon], Math.min(15, Math.max(11, fit)), { duration: 0.9 });
    }
  }, [fly, map, size]);
  return null;
}

const pinSvg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="34" viewBox="0 0 26 34" fill="none"><path d="M13 33C13 33 24 21.5 24 13A11 11 0 0 0 2 13C2 21.5 13 33 13 33Z" fill="#2563EB" stroke="#fff" stroke-width="2"/><circle cx="13" cy="13" r="4" fill="#fff"/></svg>';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);

/** The draggable square: rectangle, crosshair, corner label, and pin when too small to see. */
function SquareLayer({ centre, size, onMove }: Pick<Props, 'centre' | 'size' | 'onMove'>) {
  const map = useMap();
  const dark = useIsDark();
  const bounds = useMemo(() => squareBounds(centre, size), [centre, size]);
  const [tiny, setTiny] = useState(false);

  const live = useRef({ centre, size, onMove });
  live.current = { centre, size, onMove };

  const measure = useCallback(() => {
    const b = squareBounds(live.current.centre, live.current.size);
    const sw = map.latLngToContainerPoint(b[0]);
    const ne = map.latLngToContainerPoint(b[1]);
    setTiny(Math.abs(ne.x - sw.x) < TINY_PX);
  }, [map]);

  useEffect(measure, [measure, centre, size]);
  useMapEvents({ zoom: measure, zoomend: measure, moveend: measure });

  // Dragging the square itself. Handled at the container in the capture phase so the map's own pan never starts.
  useEffect(() => {
    const el = map.getContainer();
    el.style.touchAction = 'none';
    let drag: { dLat: number; dLon: number; startX: number; startY: number; moved: boolean } | null = null;
    let suppressClick = false;
    let raf = 0;
    let pending: LatLon | null = null;
    let last: LatLon | null = null;

    const hit = (e: PointerEvent): boolean => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const b = squareBounds(live.current.centre, live.current.size);
      const sw = map.latLngToContainerPoint(b[0]);
      const ne = map.latLngToContainerPoint(b[1]);
      const cx = (sw.x + ne.x) / 2;
      const cy = (sw.y + ne.y) / 2;
      const hx = Math.max(Math.abs(ne.x - sw.x) / 2, 16);
      const hy = Math.max(Math.abs(sw.y - ne.y) / 2, 16);
      return Math.abs(x - cx) <= hx && Math.abs(y - cy) <= hy;
    };

    const toCentre = (e: PointerEvent): LatLon => {
      const ll = map.mouseEventToLatLng(e);
      return { lat: clampLat(ll.lat + drag!.dLat), lon: wrapLon(ll.lng + drag!.dLon) };
    };

    const flush = () => {
      raf = 0;
      if (pending) live.current.onMove(pending, false);
      pending = null;
    };

    const onMoveDoc = (e: PointerEvent) => {
      if (!drag) return;
      if (!drag.moved && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > 3) drag.moved = true;
      if (!drag.moved) return;
      pending = last = toCentre(e);
      if (!raf) raf = requestAnimationFrame(flush);
    };

    const end = (cancelled: boolean) => {
      if (!drag) return;
      const d = drag;
      drag = null;
      document.removeEventListener('pointermove', onMoveDoc);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onCancel);
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      pending = null;
      el.classList.remove('rs-dragging');
      if (d.moved && !cancelled) {
        suppressClick = true;
        window.setTimeout(() => (suppressClick = false), 80);
        if (last) live.current.onMove(last, true);
      }
      map.dragging.enable();
    };
    const onUp = () => end(false);
    const onCancel = () => end(true);

    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const t = e.target as HTMLElement;
      if (t.closest('.leaflet-control, .rs-ui')) return;
      if (!hit(e)) return;
      const ll = map.mouseEventToLatLng(e);
      const c = live.current.centre;
      last = null;
      drag = { dLat: c.lat - ll.lat, dLon: c.lon - ll.lng, startX: e.clientX, startY: e.clientY, moved: false };
      map.dragging.disable();
      el.classList.add('rs-dragging');
      document.addEventListener('pointermove', onMoveDoc);
      document.addEventListener('pointerup', onUp);
      document.addEventListener('pointercancel', onCancel);
    };

    const onHover = (e: PointerEvent) => {
      if (drag || e.pointerType !== 'mouse') return;
      el.classList.toggle('rs-over-square', hit(e));
    };

    const onClick = (e: L.LeafletMouseEvent) => {
      if (suppressClick) return;
      live.current.onMove({ lat: clampLat(e.latlng.lat), lon: wrapLon(e.latlng.lng) }, true);
    };

    el.addEventListener('pointerdown', onDown, true);
    el.addEventListener('pointermove', onHover);
    map.on('click', onClick);
    return () => {
      el.removeEventListener('pointerdown', onDown, true);
      el.removeEventListener('pointermove', onHover);
      map.off('click', onClick);
      document.removeEventListener('pointermove', onMoveDoc);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onCancel);
      if (raf) cancelAnimationFrame(raf);
      map.dragging.enable();
    };
  }, [map]);

  const color = dark ? '#60A5FA' : '#2563EB';
  const km = sideKm(size);

  const crossIcon = useMemo(
    () => L.divIcon({ className: 'rs-cross', html: '<span></span>', iconSize: [28, 28], iconAnchor: [14, 14] }),
    [],
  );
  const labelIcon = useMemo(
    () =>
      L.divIcon({
        className: 'rs-label-wrap',
        iconSize: [0, 0],
        html: `<div class="rs-label"><b>${km} km × ${km} km</b><span>${esc(fmtCentre(centre))}</span></div>`,
      }),
    [km, centre],
  );
  const pinIcon = useMemo(
    () =>
      L.divIcon({
        className: 'rs-pin-wrap',
        iconSize: [0, 0],
        html: `<div class="rs-pin">${pinSvg}</div><div class="rs-hint">Zoom in to see the selection</div>`,
      }),
    [],
  );

  return (
    <>
      {!tiny && (
        <Rectangle
          bounds={bounds}
          interactive={false}
          pathOptions={{ color, weight: 2, fillColor: color, fillOpacity: dark ? 0.16 : 0.12, lineJoin: 'miter' }}
        />
      )}
      {tiny ? (
        <Marker position={[centre.lat, centre.lon]} icon={pinIcon} interactive={false} keyboard={false} />
      ) : (
        <>
          <Marker position={[centre.lat, centre.lon]} icon={crossIcon} interactive={false} keyboard={false} />
          <Marker position={[bounds[1][0], bounds[0][1]]} icon={labelIcon} interactive={false} keyboard={false} />
        </>
      )}
    </>
  );
}

export default function MapCanvas({ centre, size, basemap, onBasemap, initialView, fly, onMove, onView }: Props) {
  const dark = useIsDark();
  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={[initialView.lat, initialView.lon]}
        zoom={initialView.zoom}
        minZoom={3}
        maxZoom={basemap === 'satellite' ? SAT_MAX_ZOOM : OSM_MAX_ZOOM}
        zoomControl={false}
        className="rs-map h-full w-full"
      >
        {basemap === 'satellite' ? (
          <TileLayer key="eox" url={EOX_URL} attribution={EOX_ATTRIBUTION} maxNativeZoom={15} maxZoom={SAT_MAX_ZOOM} />
        ) : (
          <TileLayer
            key={dark ? 'osm-dark' : 'osm'}
            url={OSM_URL}
            attribution={OSM_ATTRIBUTION}
            maxZoom={OSM_MAX_ZOOM}
            className={dark ? OSM_DARK_FILTER : ''}
          />
        )}
        <ResizeSync />
        <ZoomLimit basemap={basemap} />
        <ViewReporter onView={onView} />
        <FlyHandler fly={fly} size={size} />
        <SquareLayer centre={centre} size={size} onMove={onMove} />
        <Controls centre={centre} size={size} basemap={basemap} onBasemap={onBasemap} />
      </MapContainer>
    </div>
  );
}
