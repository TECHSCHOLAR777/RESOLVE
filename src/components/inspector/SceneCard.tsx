import { useState } from 'react';
import { Check, Copy, MapPin } from 'lucide-react';
import type { SuperresResult } from '../../api';
import { Card, NA, Skeleton, fmtLat, fmtLon } from './ui';

function truncateMiddle(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, Math.ceil((max - 1) / 2))}…${s.slice(s.length - Math.floor((max - 1) / 2))}`;
}

function Row({ label, value }: { label: string; value: string }) {
  const missing = value === NA;
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="shrink-0 text-xs text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className={`min-w-0 break-words text-right text-sm tabular-nums ${missing ? 'text-slate-400 dark:text-slate-500' : 'font-medium text-slate-900 dark:text-slate-100'}`}>
        {value}
      </dd>
    </div>
  );
}

export default function SceneCard({ result, sceneName, loading }: { result: SuperresResult | null; sceneName: string; loading?: boolean }) {
  const [copied, setCopied] = useState(false);
  const [itemCopied, setItemCopied] = useState(false);
  const src = result?.source_scene ?? null;
  const copyItem = async () => {
    if (!src) return;
    try {
      await navigator.clipboard.writeText(src.item_id);
      setItemCopied(true);
      setTimeout(() => setItemCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };
  const scene = result?.scene ?? null;
  const center = scene?.center ?? null;
  const coords = center ? `${fmtLat(center.lat)}, ${fmtLon(center.lon)}` : NA;

  const copy = async () => {
    if (!center) return;
    try {
      await navigator.clipboard.writeText(`${center.lat.toFixed(5)}, ${center.lon.toFixed(5)}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  const pixel = scene?.pixel_size_m;
  const km = scene && pixel ? (scene.width * pixel) / 1000 : null;
  const kmH = scene && pixel ? (scene.height * pixel) / 1000 : null;
  const tile = scene && scene.width > 0 ? `${scene.width} × ${scene.height} px${km != null && kmH != null ? ` (${km.toFixed(2)} × ${kmH.toFixed(2)} km)` : ''}` : NA;

  return (
    <Card
      title="Scene"
      icon={<MapPin size={13} aria-hidden />}
      action={
        <button
          type="button"
          onClick={copy}
          disabled={!center}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-blue-600 transition-colors hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-blue-400 dark:hover:bg-slate-800"
        >
          {copied ? <Check size={12} aria-hidden /> : <Copy size={12} aria-hidden />}
          {copied ? 'Copied' : 'Copy coordinates'}
        </button>
      }
    >
      <p className="mb-2 truncate text-base font-semibold text-slate-900 dark:text-slate-100" title={sceneName}>
        {sceneName || NA}
      </p>
      {loading && !result ? (
        <div className="space-y-2.5">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
      ) : (
        <dl className="divide-y divide-slate-100 dark:divide-slate-800">
          <Row label="Satellite" value={src?.satellite ?? scene?.satellite ?? NA} />
          <Row label="Acquired" value={src?.date ?? scene?.date ?? NA} />
          <Row label="Tile ID" value={scene?.tile_id ?? NA} />
          <Row label="CRS" value={scene?.crs ?? result?.crs ?? NA} />
          <Row label="Pixel size" value={pixel ? `${pixel} m → ${pixel / 4} m` : NA} />
          <Row label="Tile size" value={tile} />
          <Row label="Centre" value={coords} />
          {result?.alphaearth && (
            <Row
              label="AlphaEarth"
              value={result.alphaearth.available ? `Available${result.alphaearth.year ? `, ${result.alphaearth.year}` : ''}` : 'Unavailable'}
            />
          )}
        </dl>
      )}
      {src && (
        <>
          <h4 className="mb-1 mt-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Source scene</h4>
          <dl className="divide-y divide-slate-100 dark:divide-slate-800">
            <div className="flex items-baseline justify-between gap-3 py-1.5">
              <dt className="shrink-0 text-xs text-slate-500 dark:text-slate-400">Item ID</dt>
              <dd className="flex min-w-0 items-center gap-1.5 text-right text-sm font-medium tabular-nums text-slate-900 dark:text-slate-100">
                <span className="truncate font-mono text-xs" title={src.item_id}>
                  {truncateMiddle(src.item_id, 24)}
                </span>
                <button
                  type="button"
                  onClick={copyItem}
                  aria-label="Copy item ID"
                  title="Copy item ID"
                  className="inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                >
                  {itemCopied ? <Check size={12} aria-hidden /> : <Copy size={12} aria-hidden />}
                </button>
              </dd>
            </div>
            <Row label="Scene cloud cover" value={`${src.cloud_cover.toFixed(1)} %`} />
            <Row label="Cloud in window" value={`${(src.window_cloud_fraction * 100).toFixed(1)} %`} />
            {src.processing_baseline && <Row label="Baseline" value={src.processing_baseline} />}
            {src.relaxed_cloud && <Row label="Cloud limit" value="Relaxed" />}
          </dl>
        </>
      )}
    </Card>
  );
}
