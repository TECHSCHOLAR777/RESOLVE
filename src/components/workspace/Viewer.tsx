import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type SyntheticEvent } from 'react';
import {
  Columns,
  Maximize2,
  Minimize2,
  Map as MapIcon,
  RotateCcw,
  Sparkle,
  SplitSquareHorizontal,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { absUrl, type SuperresResult } from '../../api';
import { useSettings } from '../../lib/settings';
import LayerSwitcher from './LayerSwitcher';
import { useIsPhone } from './useBreakpoint';

interface ViewerProps {
  result: SuperresResult | null;
  imageName: string;
  initializing: boolean;
  /** Selected output layer. Passing it together with `onLayerChange` turns on the layer switcher and legend. */
  layerId?: string;
  onLayerChange?: (id: string) => void;
}

const FALLBACK = '/assets/punjab.jpg';
const iconBtn =
  'flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-line text-muted transition-colors hover:bg-sunken hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 sm:h-7 sm:w-7';
const cornerTag =
  'pointer-events-none absolute left-2 top-2 z-10 flex max-w-[calc(100%-1rem)] items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-medium text-white shadow-sm backdrop-blur-md sm:left-2.5 sm:top-2.5 sm:text-[11px]';
const bottomTag =
  'pointer-events-none absolute bottom-2.5 z-10 hidden rounded bg-black/65 px-2 py-0.5 font-mono text-[10px] text-slate-200 shadow-sm backdrop-blur-md sm:block';
const imgFill = 'absolute inset-0 h-full w-full object-cover transition-transform duration-100';

export default function Viewer({ result, imageName, initializing, layerId, onLayerChange }: ViewerProps) {
  const phone = useIsPhone();
  const { settings } = useSettings();
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewMode, setViewMode] = useState<'split' | 'side-by-side'>(settings.viewMode === 'split' ? 'split' : 'side-by-side');
  const [zoom, setZoom] = useState(1);
  const [splitPos, setSplitPos] = useState(50);
  const [dragging, setDragging] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [opacity, setOpacity] = useState(1);

  const inputSrc = result ? absUrl(result.input.png) : FALLBACK;
  const outputSrc = result ? absUrl(result.output.png) : FALLBACK;

  // Layers exist only on newer backends; without them the switcher is hidden and the output stays RGB.
  const layers = onLayerChange && result?.layers && result.layers.length > 0 ? result.layers : null;
  const effective = layers ? (layers.find((l) => l.id === layerId) ?? layers.find((l) => l.id === 'rgb') ?? layers[0]) : null;
  const activeLayer = effective && effective.id !== 'rgb' ? effective : null;
  const labels = settings.showCornerLabels;

  // Tile shape drives the layout (see .tiles in index.css): tall scenes pair up early, very wide ones later.
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const dims = result ? { w: result.input.width, h: result.input.height } : natural;
  const aspect = dims && dims.w > 0 && dims.h > 0 ? dims.w / dims.h : 1;
  const shape = aspect < 0.8 ? 'tiles-tall' : aspect > 1.8 ? 'tiles-wide' : '';
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
  const frameVars = { '--a': aspect } as CSSProperties;

  const outputName = activeLayer ? activeLayer.name : 'Enhanced output';
  const inputTag = (
    <div className={`${cornerTag} border border-white/10 bg-black/65`}>
      <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" />
      <span className="truncate">
        <span className="sm:hidden">Input 10 m</span>
        <span className="hidden sm:inline">Original input 10 m</span>
      </span>
    </div>
  );
  const outputTag = (
    <div className={`${cornerTag} border border-white/10 bg-[#2563EB]/90 font-semibold`}>
      <Sparkle className="h-3 w-3 shrink-0 fill-white" />
      <span className="truncate">
        <span className="sm:hidden">{activeLayer ? activeLayer.name : 'Output 2.5 m'}</span>
        <span className="hidden sm:inline">{outputName} 2.5 m</span>
      </span>
    </div>
  );

  /** The OUTPUT image: RGB with the selected layer blended over it. */
  const outputImages = (
    <>
      <img src={outputSrc} alt="Enhanced satellite scene" onLoad={onNatural} draggable={false} className={imgFill} style={zoomStyle} />
      {activeLayer && (
        <img
          key={activeLayer.id}
          src={absUrl(activeLayer.url)}
          alt={`${activeLayer.name} layer`}
          draggable={false}
          className={imgFill}
          style={{ ...zoomStyle, opacity }}
        />
      )}
    </>
  );

  return (
    <div
      ref={containerRef}
      className="flex flex-col gap-3 overflow-y-auto rounded-2xl border border-line bg-card p-3 shadow-xs sm:p-4 dark:shadow-none"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <MapIcon className="h-4 w-4 shrink-0 text-faint" aria-hidden />
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
        </div>
      </div>

      <div className={`tiles relative ${shape}`} style={frameVars}>
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
            className="tile tile-solo cursor-ew-resize touch-pan-y select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB]"
          >
            {outputImages}
            <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - splitPos}% 0 0)` }}>
              <img src={inputSrc} alt="Original satellite scene" draggable={false} className={imgFill} style={pixelated} />
            </div>

            {labels && (
              <>
                {inputTag}
                <div className="pointer-events-none absolute right-2 top-2 z-10 max-w-[48%] sm:right-2.5 sm:top-2.5">
                  <div className="flex items-center gap-1.5 rounded-md border border-white/10 bg-[#2563EB]/90 px-2 py-1 text-[10px] font-semibold text-white shadow-sm backdrop-blur-md sm:text-[11px]">
                    <Sparkle className="h-3 w-3 shrink-0 fill-white" />
                    <span className="truncate sm:hidden">{activeLayer ? activeLayer.name : 'Output 2.5 m'}</span>
                    <span className="hidden truncate sm:inline">{outputName} 2.5 m</span>
                  </div>
                </div>
                <span className={`${bottomTag} left-2.5`}>Sentinel-2 L2A</span>
                <span className={`${bottomTag} right-2.5`}>4-band multispectral</span>
              </>
            )}

            <div className="pointer-events-none absolute bottom-0 top-0 z-20 w-0.5 bg-white shadow-[0_0_8px_rgba(0,0,0,0.5)]" style={{ left: `${splitPos}%` }}>
              <div className="absolute top-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-slate-300 bg-white text-[10px] font-bold tracking-tighter text-slate-500 shadow-md">
                ‹›
              </div>
            </div>
          </div>
        ) : (
          <div className="tiles-row">
            <div className="tile">
              <img src={inputSrc} alt="Original satellite scene" draggable={false} className={imgFill} style={pixelated} />
              {labels && (
                <>
                  {inputTag}
                  <span className={`${bottomTag} left-2.5`}>Sentinel-2 L2A</span>
                </>
              )}
            </div>
            <div className="tile">
              {outputImages}
              {labels && (
                <>
                  {outputTag}
                  <span className={`${bottomTag} left-2.5`}>4-band multispectral</span>
                </>
              )}
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

      {layers && effective && onLayerChange && (
        <LayerSwitcher layers={layers} selectedId={effective.id} onSelect={onLayerChange} opacity={opacity} onOpacity={setOpacity} />
      )}

      <div className="flex items-center justify-between gap-3">
        <div className="hidden items-center gap-1.5 text-xs text-faint sm:flex">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
          <span>Input 10 m, output 2.5 m</span>
        </div>
        <div className="inline-flex rounded-lg border border-line bg-sunken p-0.5 max-sm:w-full">
          {(
            [
              ['split', 'Split', SplitSquareHorizontal],
              ['side-by-side', phone ? 'Tiles' : 'Side by side', Columns],
            ] as const
          ).map(([mode, label, Icon]) => (
            <button
              key={mode}
              type="button"
              aria-pressed={viewMode === mode}
              onClick={() => setViewMode(mode)}
              className={`flex cursor-pointer items-center justify-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition-all max-sm:flex-1 sm:py-1 ${
                viewMode === mode ? 'bg-raised text-accent-text shadow-2xs dark:shadow-none' : 'text-muted hover:text-ink'
              }`}
            >
              <Icon className="h-3 w-3" aria-hidden />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
