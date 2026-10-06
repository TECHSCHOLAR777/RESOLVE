import type { SizePx } from '../components/map/geo';

const KEY = 'resolve:map';

export type DateMode = 'latest' | 'range';

export interface MapState {
  view: { lat: number; lon: number; zoom: number };
  centre: { lat: number; lon: number };
  size: SizePx;
  dateMode: DateMode;
  dateFrom: string;
  dateTo: string;
  maxCloud: number;
  basemap: 'satellite' | 'osm';
  /** Place name of the centre, when known. */
  name: string | null;
}

// Delhi: a recognisable default that always has Sentinel-2 coverage.
export const DEFAULT_MAP_STATE: MapState = {
  view: { lat: 28.6139, lon: 77.209, zoom: 12 },
  centre: { lat: 28.6139, lon: 77.209 },
  size: 256,
  dateMode: 'latest',
  dateFrom: '',
  dateTo: '',
  maxCloud: 20,
  basemap: 'satellite',
  name: null,
};

const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const str = (v: unknown) => (typeof v === 'string' ? v : '');

export function loadMapState(): MapState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_MAP_STATE;
    const o = JSON.parse(raw) as Record<string, any>;
    const d = DEFAULT_MAP_STATE;
    return {
      view: { lat: num(o.view?.lat, d.view.lat), lon: num(o.view?.lon, d.view.lon), zoom: Math.min(18, Math.max(2, num(o.view?.zoom, d.view.zoom))) },
      centre: { lat: num(o.centre?.lat, d.centre.lat), lon: num(o.centre?.lon, d.centre.lon) },
      size: o.size === 512 ? 512 : 256,
      dateMode: o.dateMode === 'range' ? 'range' : 'latest',
      dateFrom: str(o.dateFrom),
      dateTo: str(o.dateTo),
      maxCloud: Math.min(60, Math.max(0, num(o.maxCloud, d.maxCloud))),
      basemap: o.basemap === 'osm' ? 'osm' : 'satellite',
      name: typeof o.name === 'string' ? o.name : null,
    };
  } catch {
    return DEFAULT_MAP_STATE;
  }
}

export function saveMapState(patch: Partial<MapState>) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...loadMapState(), ...patch }));
  } catch {
    /* storage unavailable: the selection just will not be restored */
  }
}
