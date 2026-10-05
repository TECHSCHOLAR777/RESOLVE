import { useEffect, useState } from 'react';
import { MapContainer, Rectangle, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Minus, Plus, LocateFixed } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

export interface MapProps {
  bounds: [number, number, number, number]; // w, s, e, n
}

const LIGHT = {
  url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
};
// CARTO's dark_all tiles now require an API key (they render a watermark without one), so the dark theme
// reuses the OSM tiles and darkens them with a CSS filter instead.
const DARK_FILTER = '[filter:invert(1)_hue-rotate(180deg)_brightness(0.92)_contrast(0.88)_saturate(0.7)]';

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

const btn =
  'flex size-8 items-center justify-center bg-white text-slate-700 transition-colors hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800';

function Controls({ latLngBounds }: { latLngBounds: L.LatLngBounds }) {
  const map = useMap();
  const recenter = () => map.fitBounds(latLngBounds, { padding: [28, 28], maxZoom: 14 });
  return (
    <div className="absolute right-2 top-2 z-[1000] flex flex-col overflow-hidden rounded-lg border border-slate-200 shadow-sm dark:border-slate-700">
      <button type="button" aria-label="Zoom in" onClick={() => map.zoomIn()} className={`${btn} border-b border-slate-200 dark:border-slate-700`}>
        <Plus size={15} />
      </button>
      <button type="button" aria-label="Zoom out" onClick={() => map.zoomOut()} className={`${btn} border-b border-slate-200 dark:border-slate-700`}>
        <Minus size={15} />
      </button>
      <button type="button" aria-label="Recenter on tile" title="Recenter" onClick={recenter} className={btn}>
        <LocateFixed size={15} />
      </button>
    </div>
  );
}

export default function LeafletMap({ bounds }: MapProps) {
  const dark = useIsDark();
  const lb = L.latLngBounds([bounds[1], bounds[0]], [bounds[3], bounds[2]]);
  const color = dark ? '#60A5FA' : '#2563EB';
  return (
    <div className="relative h-full w-full">
      <MapContainer
        bounds={lb}
        boundsOptions={{ padding: [28, 28], maxZoom: 14 }}
        zoomControl={false}
        scrollWheelZoom={false}
        className="h-full w-full"
      >
        <TileLayer key={dark ? 'dark' : 'light'} url={LIGHT.url} attribution={LIGHT.attribution} maxZoom={19} className={dark ? DARK_FILTER : ''} />
        <Rectangle bounds={lb} pathOptions={{ color, weight: 2, fillColor: color, fillOpacity: 0.15 }} />
        <Controls latLngBounds={lb} />
      </MapContainer>
    </div>
  );
}
