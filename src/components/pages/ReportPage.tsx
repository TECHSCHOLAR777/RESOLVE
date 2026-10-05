import type { ReactNode } from 'react';
import { ArrowLeft, Printer } from 'lucide-react';
import { absUrl, type SuperresResult } from '../../api';
import { fmtLat, fmtLon } from '../inspector/ui';
import { focusRing } from './PageHeader';

export interface ReportPageProps {
  result: SuperresResult;
  name: string;
  /** Back button handler. Defaults to history.back(). */
  onBack?: () => void;
}

const LAYER_IDS = ['confidence', 'landcover', 'ndvi', 'uncertainty'];

const NA = 'Not available';

const PRINT_CSS = `
.rp-sheet { background:#fff; color:#0f172a; font-family: var(--font-sans); }
.rp-sheet h1, .rp-sheet h2 { font-family: var(--font-display); }
.rp-sheet table { border-collapse: collapse; width: 100%; font-variant-numeric: tabular-nums; }
.rp-sheet th, .rp-sheet td { padding: 3px 0; font-size: 11px; text-align: left; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
.rp-sheet th { font-weight: 500; color: #64748b; width: 46%; }
.rp-sheet td { text-align: right; color: #0f172a; }
.rp-sheet figure, .rp-sheet img, .rp-sheet table, .rp-sheet section { break-inside: avoid; page-break-inside: avoid; }
@page { size: A4 portrait; margin: 12mm; }
@media print {
  html, body { background: #fff !important; color: #0f172a !important; }
  .rp-noprint { display: none !important; }
  .rp-wrap { padding: 0 !important; background: #fff !important; }
  .rp-sheet { width: auto !important; min-height: 0 !important; padding: 0 !important; box-shadow: none !important; border: 0 !important; border-radius: 0 !important; }
  * { box-shadow: none !important; text-shadow: none !important; }
  img { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
}
`;

function Table({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <section>
      <h2 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{title}</h2>
      <table>
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k}>
              <th scope="row">{k}</th>
              <td style={v === NA ? { color: '#94a3b8' } : undefined}>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Footprint({ bounds }: { bounds: [number, number, number, number] }) {
  const [w, s, e, n] = bounds;
  const lonSpan = e - w;
  const latSpan = n - s;
  // Equirectangular with cos(lat) correction so the box keeps its true proportions.
  const k = Math.cos((((s + n) / 2) * Math.PI) / 180);
  const bw = lonSpan * k;
  const bh = latSpan;
  const W = 160;
  const H = 124;
  const scale = Math.min((W - 40) / bw, (H - 30) / bh);
  const rw = bw * scale;
  const rh = bh * scale;
  const x = (W - rw) / 2;
  const y = (H - rh) / 2;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Scene footprint" className="w-full" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
      <defs>
        <pattern id="rp-grid" width="10" height="10" patternUnits="userSpaceOnUse">
          <path d="M10 0H0V10" fill="none" stroke="#e2e8f0" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width={W} height={H} fill="url(#rp-grid)" />
      <rect x={x} y={y} width={rw} height={rh} fill="rgba(37,99,235,0.15)" stroke="#2563eb" strokeWidth="1.2" />
      <g fontSize="5.5" fill="#475569" fontFamily="monospace">
        <text x={x} y={y - 3}>{`${n.toFixed(4)}° N`}</text>
        <text x={x} y={y + rh + 8}>{`${s.toFixed(4)}° N`}</text>
        <text x={x - 2} y={H - 3} textAnchor="start">{`${w.toFixed(4)}° E`}</text>
        <text x={x + rw + 2} y={H - 3} textAnchor="end">{`${e.toFixed(4)}° E`}</text>
      </g>
    </svg>
  );
}

function Img({ src, caption, className = '' }: { src: string; caption: ReactNode; className?: string }) {
  return (
    <figure className={className}>
      <img src={src} alt={typeof caption === 'string' ? caption : ''} className="block w-full" style={{ imageRendering: 'pixelated', border: '1px solid #e2e8f0' }} />
      <figcaption className="mt-1 text-[10px] font-medium text-slate-600">{caption}</figcaption>
    </figure>
  );
}

const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`;

export default function ReportPage({ result, name, onBack }: ReportPageProps) {
  const scene = result.scene ?? null;
  const generated = new Date().toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' });

  const sceneRows: [string, string][] = [
    ['Satellite', scene?.satellite ?? NA],
    ['Acquisition date', scene?.date ?? NA],
    ['Tile', scene?.tile_id ?? NA],
    ['Centre', scene ? `${fmtLat(scene.center.lat)}, ${fmtLon(scene.center.lon)}` : NA],
    ['CRS', scene?.crs ?? result.crs ?? NA],
    ['Input pixel size', scene ? `${scene.pixel_size_m} m` : NA],
    ['Input size', scene ? `${scene.width} × ${scene.height} px` : `${result.input.width} × ${result.input.height} px`],
  ];

  const metricRows: [string, string][] = [
    ['Runtime', result.runtime_ms >= 1000 ? `${(result.runtime_ms / 1000).toFixed(1)} s` : `${Math.round(result.runtime_ms)} ms`],
    ['Output size', `${result.output.width} × ${result.output.height} px (2.5 m)`],
    ['Patches', result.patches ? `${result.patches.cols} × ${result.patches.rows} (${result.patches.count}), ${result.patches.tile} px tiles` : NA],
    ['Mean confidence', result.confidence ? fmtPct(result.confidence.mean) : NA],
    ['High-confidence share', result.confidence ? fmtPct(result.confidence.high_fraction) : NA],
    [
      'Lock consistency',
      result.lock ? `${result.lock.consistency_before.toFixed(3)} before, ${result.lock.consistency_after.toFixed(3)} after` : NA,
    ],
    ['Model', result.model],
  ];

  const layers = LAYER_IDS.map((id) => result.layers?.find((l) => l.id === id)).filter((l): l is NonNullable<typeof l> => !!l);

  return (
    <div className="rp-wrap min-h-full bg-sunken px-4 py-6 sm:px-6">
      <style>{PRINT_CSS}</style>

      <div className="rp-noprint mx-auto mb-4 flex max-w-[210mm] items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack ?? (() => window.history.back())}
          className={`inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-card px-3 text-sm font-medium text-body hover:text-ink ${focusRing}`}
        >
          <ArrowLeft size={15} aria-hidden /> Back
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className={`inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-[#2563EB] px-4 text-sm font-semibold text-white hover:bg-[#1d4ed8] ${focusRing}`}
        >
          <Printer size={15} aria-hidden /> Print / Save as PDF
        </button>
      </div>

      <article className="rp-sheet mx-auto w-full max-w-[210mm] rounded-sm border border-slate-200 p-6 shadow-md sm:min-h-[297mm] sm:p-[12mm]">
        <header className="flex items-end justify-between gap-4 border-b-2 border-slate-900 pb-3">
          <div className="min-w-0">
            <p className="font-display text-sm font-bold uppercase tracking-[0.2em]" style={{ color: '#2563eb' }}>
              RESOLVE
            </p>
            <h1 className="mt-1 break-words text-xl font-semibold leading-tight">{name}</h1>
          </div>
          <p className="shrink-0 text-right text-[10px] leading-snug text-slate-500">
            Generated
            <br />
            <span className="tabular-nums text-slate-800">{generated}</span>
          </p>
        </header>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <Img src={absUrl(result.input.png)} caption="Input, Sentinel-2 10 m" />
          <Img src={absUrl(result.output.png)} caption="Output, enhanced 2.5 m" />
        </div>

        <div className="mt-5 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
          <Table title="Scene" rows={sceneRows} />
          <Table title="Processing" rows={metricRows} />
        </div>

        <div className="mt-5 grid grid-cols-1 items-start gap-4 sm:grid-cols-[1fr_2fr]">
          <section>
            <h2 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Footprint</h2>
            {scene?.bounds ? <Footprint bounds={scene.bounds} /> : <p className="text-[11px] text-slate-400">{NA}</p>}
          </section>
          {layers.length > 0 && (
            <section>
              <h2 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Layers</h2>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {layers.map((l) => (
                  <Img key={l.id} src={absUrl(l.url)} caption={l.name} />
                ))}
              </div>
            </section>
          )}
        </div>

        <footer className="mt-6 border-t border-slate-200 pt-2 text-[9px] leading-snug text-slate-500">
          Contains modified Copernicus Sentinel data. Enhanced pixels are model estimates; read them together with the confidence and uncertainty layers.
          AlphaEarth Foundations Satellite Embedding dataset, Google, CC-BY 4.0. Map data © OpenStreetMap contributors (ODbL). SEN2SR (ESA OpenSR) weights, CC0.
        </footer>
      </article>
    </div>
  );
}
