import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type SyntheticEvent } from 'react';
import {
  Columns,
  Maximize2,
  Minimize2,
  Map as MapIcon,
  PanelRight,
  RotateCcw,
  Sparkle,
  SplitSquareHorizontal,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { absUrl, type SuperresResult } from '../../api';
import LayerSwitcher from './LayerSwitcher';
import { useIsPhone } from './useBreakpoint';

interface ViewerProps {
  result: SuperresResult | null;
  imageName: string;
  initializing: boolean;
  /** When set, a header button opens the inspector (used where it is not shown inline). */
  onOpenInspector?: () => void;
}

const FALLBACK = '/assets/punjab.jpg';
const iconBtn =
  'flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-line text-muted transition-colors hover:bg-sunken hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 sm:h-7 sm:w-7';

export default function Viewer({ result, imageName, initializing, onOpenInspector }: ViewerProps) {
  const phone = useIsPhone();
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewMode, setViewMode] = useState<'split' | 'side-by-side'>('split');
  const [zoom, setZoom] = useState(1);
  const [splitPos, setSplitPos] = useState(50);
  const [dragging, setDragging] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [layerId, setLayerId] = useState('rgb');
  const [opacity, setOpacity] = useState(1);

  const inputSrc = result ? absUrl(result.input.png) : FALLBACK;
  const outputSrc = result ? absUrl(result.output.png) : FALLBACK;

  // Layers exist only on newer backends; without them the switcher is hidden and the output stays RGB.
  const layers = result?.layers && result.layers.length > 0 ? result.layers : null;
  const effective = layers ? (layers.find((l) => l.id === layerId) ?? layers.find((l) => l.id === 'rgb') ?? layers[0]) : null;
  const activeLayer = effective && effective.id !== 'rgb' ? effective : null;

  // Tile shape drives the layout: clearly portrait tiles go side by side, everything else stacks.
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const dims = result ? { w: result.input.width, h: result.input.height } : natural;
  const aspect = dims && dims.w > 0 && dims.h > 0 ? dims.w / dims.h : 1;
  const sideBySide = viewMode === 'side-by-side' && aspect < 0.8 && !phone;
  const onNatural = (e: SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
    if (w > 0 && h > 0) setNatural({ w, h });
  };

  useEffect(() => setZoom(1), [result]);

  useEffect(() => {
    const sync = () => setIsFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) containerRef.current?.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen().catch(() => {});
  };

  const moveSplit = (e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width > 0) setSplitPos(Math.max(3, Math.min(97, ((e.clientX - rect.left) / rect.width) * 100)));
  };
  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* synthetic or already-released pointer */
    }
    setDragging(true);
    moveSplit(e);
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => dragging && moveSplit(e);
  const onUp = () => setDragging(false);
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') setSplitPos((p) => Math.max(3, p - 3));
    else if (e.key === 'ArrowRight') setSplitPos((p) => Math.min(97, p + 3));
    else return;
    e.preventDefault();
  };

  const zoomBy = useCallback((d: number) => setZoom((z) => Math.min(4, Math.max(1, +(z + d).toFixed(2)))), []);
  const zoomStyle: CSSProperties = { transform: `scale(${zoom})` };
  const pixelated: CSSProperties = { ...zoomStyle, imageRendering: 'pixelated' };

  /** The OUTPUT panel: RGB with the selected layer blended over it. */
  const outputImages = (
    <>
      <img
        src={outputSrc}
        alt="Enhanced satellite scene"
        onLoad={onNatural}
        draggable={false}
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-100"
        style={zoomStyle}
      />
      {activeLayer && (
        <img
          key={activeLayer.id}
          src={absUrl(activeLayer.url)}
          alt={`${activeLayer.name} layer`}
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-100"
          style={{ ...zoomStyle, opacity }}
        />
      )}
    </>
  );

  const panelBase = 'relative overflow-hidden rounded-lg bg-slate-900';
  const panelStyle = (width: string): CSSProperties => ({ aspectRatio: String(aspect), width });
  const splitWidth = `min(100%, calc(52vh * ${aspect}))`;
  const rowWidth = `min(calc(50% - 4px), calc(62vh * ${aspect}))`;
  const colWidth = `min(100%, calc(38vh * ${aspect}))`;

  return (
    <div
      ref={containerRef}
      className="flex flex-col gap-3 overflow-y-auto rounded-2xl border border-line bg-card p-3 shadow-xs sm:p-4 dark:shadow-none"
    >
      <div className="flex items-center justify-between gap-2 border-b border-line-soft pb-3">
        <div className="flex min-w-0 items-center gap-2">
          <MapIcon className="h-4 w-4 shrink-0 text-faint" />
          <span className="truncate text-xs font-bold text-ink">{imageName}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" onClick={() => zoomBy(-0.5)} disabled={zoom <= 1} title="Zoom out" aria-label="Zoom out" className={iconBtn}>
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => zoomBy(0.5)} disabled={zoom >= 4} title="Zoom in" aria-label="Zoom in" className={iconBtn}>
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => setZoom(1)} title="Reset zoom" aria-label="Reset zoom" className={iconBtn}>
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={toggleFullscreen} title="Fullscreen" aria-label="Fullscreen" className={iconBtn}>
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
          {onOpenInspector && (
            <button
              type="button"
              onClick={onOpenInspector}
              className="ml-1 flex h-7 cursor-pointer items-center gap-1.5 rounded-lg border border-accent-line bg-accent-soft px-2.5 text-[11px] font-semibold text-accent-text transition-colors hover:bg-accent-soft-hover"
            >
              <PanelRight className="h-3.5 w-3.5" />
              <span>Inspector</span>
            </button>
          )}
        </div>
      </div>

      <div className="relative flex items-center justify-center rounded-xl bg-slate-950 p-1.5 sm:p-2">
        {viewMode === 'split' ? (
          <div
            role="slider"
            tabIndex={0}
            aria-label="Comparison divider"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(splitPos)}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            onKeyDown={onKey}
            className={`${panelBase} cursor-ew-resize touch-pan-y select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB]`}
            style={panelStyle(splitWidth)}
          >
            {outputImages}
            <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - splitPos}% 0 0)` }}>
              <img
                src={inputSrc}
                alt="Original satellite scene"
                draggable={false}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-100"
                style={pixelated}
              />
            </div>

            <div className="pointer-events-none absolute left-2 top-2 z-10 sm:left-3 sm:top-3">
              <div className="flex items-center gap-1.5 rounded-md border border-white/10 bg-black/65 px-2 py-1 text-[10px] font-medium text-white shadow-sm backdrop-blur-md sm:px-2.5 sm:text-[11px]">
                <span className="h-2 w-2 rounded-full bg-amber-400" />
                <span className="sm:hidden">Input 10 m</span>
                <span className="hidden sm:inline">Original Input (10 m GSD)</span>
              </div>
            </div>
            <div className="pointer-events-none absolute right-2 top-2 z-10 max-w-[48%] sm:right-3 sm:top-3">
              <div className="flex items-center gap-1.5 rounded-md border border-white/10 bg-[#2563EB]/90 px-2 py-1 text-[10px] font-semibold text-white shadow-sm backdrop-blur-md sm:px-2.5 sm:text-[11px]">
                <Sparkle className="h-3 w-3 shrink-0 fill-white" />
                <span className="truncate sm:hidden">{activeLayer ? activeLayer.name : 'Output 2.5 m'}</span>
                <span className="hidden truncate sm:inline">{activeLayer ? `${activeLayer.name} (2.5 m)` : 'Enhanced Output (2.5 m)'}</span>
              </div>
            </div>

            <div className="pointer-events-none absolute bottom-3 left-3 z-10 hidden sm:block">
              <span className="rounded bg-black/70 px-2 py-0.5 font-mono text-[10px] text-slate-200 shadow-sm backdrop-blur-md">Sentinel-2 L2A</span>
            </div>
            <div className="pointer-events-none absolute bottom-3 right-3 z-10 hidden sm:block">
              <span className="rounded bg-black/70 px-2 py-0.5 font-mono text-[10px] text-slate-200 shadow-sm backdrop-blur-md">4-Band Multispectral</span>
            </div>

            <div className="pointer-events-none absolute bottom-0 top-0 z-20 w-0.5 bg-white shadow-[0_0_8px_rgba(0,0,0,0.5)]" style={{ left: `${splitPos}%` }}>
              <div className="absolute top-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-slate-300 bg-white text-[10px] font-bold tracking-tighter text-slate-500 shadow-md">
                ‹›
              </div>
            </div>
          </div>
        ) : (
          <div className={`flex w-full justify-center gap-2 ${sideBySide ? 'flex-row' : 'flex-col items-center'}`}>
            <div className={panelBase} style={panelStyle(sideBySide ? rowWidth : colWidth)}>
              <img src={inputSrc} alt="Original" draggable={false} className="h-full w-full object-cover" style={pixelated} />
              <div className="absolute left-2 top-2 rounded bg-black/65 px-2 py-0.5 text-[10px] text-white">Original (10 m)</div>
            </div>
            <div className={panelBase} style={panelStyle(sideBySide ? rowWidth : colWidth)}>
              {outputImages}
              <div className="absolute left-2 top-2 max-w-[90%] truncate rounded bg-[#2563EB]/90 px-2 py-0.5 text-[10px] text-white">
                {activeLayer ? `${activeLayer.name} (2.5 m)` : 'Enhanced (2.5 m)'}
              </div>
            </div>
          </div>
        )}

        {initializing && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center rounded-xl bg-slate-900/60 text-white backdrop-blur-xs">
            <div className="mb-2 h-10 w-10 animate-spin rounded-full border-3 border-white/30 border-t-[#2563EB]" />
            <span className="text-xs font-semibold tracking-wide">Loading scene</span>
          </div>
        )}
      </div>

      {layers && effective && (
        <LayerSwitcher layers={layers} selectedId={effective.id} onSelect={setLayerId} opacity={opacity} onOpacity={setOpacity} />
      )}

      <div className="flex items-center justify-between gap-3">
        <div className="hidden items-center gap-1.5 text-xs text-faint sm:flex">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
          <span>Real-time High Fidelity Preview</span>
        </div>
        <div className="inline-flex rounded-lg border border-line bg-sunken p-0.5 max-sm:w-full">
          {(
            [
              ['split', 'Split', SplitSquareHorizontal],
              ['side-by-side', phone ? 'Stacked' : 'Side-by-Side', Columns],
            ] as const
          ).map(([mode, label, Icon]) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              className={`flex cursor-pointer items-center justify-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition-all max-sm:flex-1 sm:py-1 ${
                viewMode === mode ? 'bg-raised text-accent-text shadow-2xs dark:shadow-none' : 'text-muted hover:text-ink'
              }`}
            >
              <Icon className="h-3 w-3" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
