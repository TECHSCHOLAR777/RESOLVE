import React, { useState, useRef, useEffect, useCallback } from 'react';
import { SatelliteScene, SpectralBand } from '../types';
import { ZoomIn, ZoomOut, Maximize2, Minimize2, Crosshair, Navigation, RefreshCw } from 'lucide-react';

interface ViewportCanvasProps {
  scene: SatelliteScene;
  band: SpectralBand;
  opacity: number;
  contrast: number;
  brightness: number;
  showGrid: boolean;
  showReticle: boolean;
  onOpenUpload: () => void;
}

export const ViewportCanvas: React.FC<ViewportCanvasProps> = ({
  scene,
  band,
  opacity,
  contrast,
  brightness,
  showGrid,
  showReticle,
  onOpenUpload,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number>(1);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [imgLoaded, setImgLoaded] = useState<boolean>(false);
  const [imgError, setImgError] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Reset zoom & pan when scene changes
  useEffect(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
    setImgLoaded(false);
    setImgError(false);
  }, [scene.id]);

  // Handle Wheel zoom centered on mouse
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
    setScale((prev) => Math.min(6, Math.max(0.25, prev * zoomFactor)));
  };

  // Pan drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left button
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setMousePos({ x, y });

    if (isDragging) {
      setOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleZoomIn = () => setScale((prev) => Math.min(6, prev * 1.25));
  const handleZoomOut = () => setScale((prev) => Math.max(0.25, prev * 0.8));
  const handleResetZoom = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Calculate live geographical coordinates under mouse reticle
  const currentCoords = useCallback(() => {
    if (!mousePos || !containerRef.current) {
      return {
        lat: scene.coordinates.lat.toFixed(5),
        lng: scene.coordinates.lng.toFixed(5),
        elevation: '320 m',
        dnValue: 142,
      };
    }
    const rect = containerRef.current.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;

    // Relative offset from image center in normalized coordinates
    const dx = (mousePos.x - (cx + offset.x)) / (rect.width * scale);
    const dy = (mousePos.y - (cy + offset.y)) / (rect.height * scale);

    const lat = (scene.coordinates.lat - dy * 0.08).toFixed(5);
    const lng = (scene.coordinates.lng + dx * 0.08).toFixed(5);

    // Simulated elevation & DN based on coordinates
    const elev = Math.round(280 + Math.abs(dx * 450) + Math.abs(dy * 200));
    const dn = Math.min(255, Math.max(0, Math.round(135 + dx * 80 - dy * 60)));

    return { lat, lng, elevation: `${elev} m`, dnValue: dn };
  }, [mousePos, offset, scale, scene]);

  const coords = currentCoords();

  // Band visual filter classes
  const getBandFilterStyle = () => {
    let filterStr = `contrast(${contrast}%) brightness(${brightness}%)`;

    switch (band) {
      case 'nir':
        // False color infrared (vegetation shows up in deep reds/magentas)
        filterStr += ' saturate(160%) hue-rotate(-45deg) sepia(20%)';
        break;
      case 'ndvi':
        // Normalized difference vegetation index (green/gold pseudocolor)
        filterStr += ' saturate(200%) hue-rotate(55deg) contrast(140%)';
        break;
      case 'swir':
        // Shortwave infrared (soil moisture and minerals)
        filterStr += ' saturate(140%) hue-rotate(185deg) contrast(130%)';
        break;
      case 'pan':
        // Panchromatic grayscale
        filterStr += ' grayscale(100%) contrast(150%)';
        break;
      case 'rgb':
      default:
        // True color
        break;
    }

    return {
      filter: filterStr,
      opacity: opacity / 100,
    };
  };

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => {
        handleMouseUp();
        setMousePos(null);
      }}
      className="relative w-full h-full bg-[#151B29] overflow-hidden select-none cursor-crosshair flex items-center justify-center"
      style={{ minHeight: '480px' }}
    >
      {/* Background Cartographic Coordinate Grid */}
      {showGrid && (
        <div className="absolute inset-0 pointer-events-none z-10 opacity-30">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern
                id="utm-grid"
                width="80"
                height="80"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 80 0 L 0 0 0 80"
                  fill="none"
                  stroke="#F9ECC2"
                  strokeWidth="0.75"
                  strokeDasharray="2,3"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#utm-grid)" />
          </svg>

          {/* Coordinate Rulers */}
          <div className="absolute top-1 left-2 text-[10px] font-mono text-[#F9ECC2]/70">
            UTM 1000m ZONE 28N
          </div>
          <div className="absolute bottom-1 right-2 text-[10px] font-mono text-[#F9ECC2]/70">
            WGS84 ELLIPSOID
          </div>
        </div>
      )}

      {/* Main Image Canvas Viewport with Pan and Zoom */}
      <div
        className="transition-transform duration-75 ease-out will-change-transform flex items-center justify-center"
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
        }}
      >
        {!imgError ? (
          <img
            src={scene.imageUrl}
            alt={scene.name}
            referrerPolicy="no-referrer"
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
            className="max-w-none rounded shadow-2xl transition-all duration-150 pointer-events-none"
            style={{
              maxHeight: '75vh',
              maxWidth: '85vw',
              objectFit: 'contain',
              ...getBandFilterStyle(),
            }}
          />
        ) : (
          /* High-fidelity CSS/SVG Fallback Container per skill instructions */
          <div
            className="w-[720px] h-[480px] bg-gradient-to-br from-[#1254EB]/20 via-[#0D2E68] to-[#151B29] border border-[#1254EB]/40 rounded-lg p-8 flex flex-col items-center justify-center text-center text-white relative shadow-2xl"
          >
            <div className="w-16 h-16 rounded-full bg-[#1254EB]/20 border border-[#1254EB]/50 flex items-center justify-center mb-4 text-[#F9ECC2]">
              <Crosshair className="w-8 h-8" />
            </div>
            <div className="text-lg font-semibold font-display text-white">
              {scene.name}
            </div>
            <div className="text-xs font-mono text-[#C3C5D8] mt-1">
              Synthetic Topographic Contour Map
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={onOpenUpload}
                className="px-3 py-1.5 text-xs font-medium bg-[#1254EB] hover:bg-[#003EBB] text-white rounded transition-colors"
              >
                Upload New Image
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Center Reticle Crosshairs HUD (Tracking Cursor) */}
      {showReticle && mousePos && (
        <div
          className="absolute pointer-events-none z-20 flex flex-col items-center"
          style={{
            left: `${mousePos.x}px`,
            top: `${mousePos.y}px`,
            transform: 'translate(-50%, -50%)',
          }}
        >
          {/* Subtle Reticle Target */}
          <div className="relative w-8 h-8 flex items-center justify-center">
            <div className="absolute w-full h-[1px] bg-[#1254EB]/80" />
            <div className="absolute h-full w-[1px] bg-[#1254EB]/80" />
            <div className="w-2.5 h-2.5 rounded-full border border-[#1254EB] bg-[#F9ECC2]/40" />
          </div>

          {/* Floating Reticle Telemetry Chip */}
          <div
            className="mt-2 bg-[#FAF6E8]/90 backdrop-blur-xs border border-[#1254EB]/30 rounded px-2.5 py-1 text-[10px] font-mono text-[#0D2E68] shadow-md flex items-center gap-2 whitespace-nowrap"
          >
            <span className="font-semibold text-[#1254EB]">{coords.lat}° N</span>
            <span className="text-[#737687]">|</span>
            <span className="font-semibold text-[#1254EB]">{coords.lng}° W</span>
            <span className="text-[#737687]">|</span>
            <span>{coords.elevation}</span>
          </div>
        </div>
      )}

      {/* Persistent Viewport Overlay Controls (Top Right) */}
      <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
        <div className="bg-[#FAF6E8]/95 backdrop-blur-xs border border-[#0D2E68]/12 rounded-lg p-1 shadow-lg flex flex-col gap-1">
          <button
            onClick={handleZoomIn}
            title="Zoom In (+)"
            className="p-2 rounded hover:bg-[#F9ECC2] text-[#0D2E68] transition-colors"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <button
            onClick={handleZoomOut}
            title="Zoom Out (-)"
            className="p-2 rounded hover:bg-[#F9ECC2] text-[#0D2E68] transition-colors"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          <button
            onClick={handleResetZoom}
            title="Fit to Frame (100%)"
            className="p-2 rounded hover:bg-[#F9ECC2] text-[#0D2E68] transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <div className="h-[1px] bg-[#0D2E68]/10 my-0.5" />

          <button
            onClick={toggleFullscreen}
            title="Toggle Fullscreen"
            className="p-2 rounded hover:bg-[#F9ECC2] text-[#0D2E68] transition-colors"
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Current Zoom Readout */}
        <div className="bg-[#FAF6E8]/90 border border-[#0D2E68]/10 rounded px-2 py-1 text-center font-mono text-[10px] text-[#0D2E68] font-medium shadow-sm">
          {Math.round(scale * 100)}%
        </div>
      </div>

      {/* Top Left Compass & Status Bar */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
        <div className="bg-[#FAF6E8]/95 backdrop-blur-xs border border-[#0D2E68]/12 rounded-lg px-3 py-1.5 shadow-md flex items-center gap-2.5">
          <div className="w-5 h-5 rounded-full bg-[#1254EB] text-white flex items-center justify-center">
            <Navigation className="w-3 h-3 rotate-45" />
          </div>
          <div>
            <div className="text-[10px] font-mono text-[#737687] leading-none">
              ORIENTATION
            </div>
            <div className="text-xs font-mono font-semibold text-[#0D2E68] leading-tight">
              TRUE NORTH (000°)
            </div>
          </div>
        </div>

        {/* Quick Hotlink / Upload Trigger Button */}
        <button
          onClick={onOpenUpload}
          className="bg-[#1254EB] hover:bg-[#003EBB] text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-md transition-colors flex items-center gap-1.5"
        >
          <span>Change / Upload Image</span>
        </button>
      </div>

      {/* Bottom Bar: Scale bar & Permanent Coordinates Display */}
      <div className="absolute bottom-4 left-4 right-4 z-20 flex items-end justify-between pointer-events-none">
        {/* Scale Bar */}
        <div className="pointer-events-auto bg-[#FAF6E8]/95 backdrop-blur-xs border border-[#0D2E68]/12 rounded-lg px-3 py-2 shadow-md">
          <div className="flex items-center justify-between text-[10px] font-mono text-[#0D2E68] mb-1">
            <span>0</span>
            <span>500 m</span>
            <span>1 km</span>
          </div>
          <div className="w-32 h-1.5 bg-[#0D2E68]/20 rounded-full overflow-hidden flex">
            <div className="w-1/2 h-full bg-[#1254EB]" />
            <div className="w-1/2 h-full bg-[#F9ECC2]" />
          </div>
          <div className="text-[9px] font-mono text-[#737687] mt-1 text-center">
            1 px = {scene.resolution}
          </div>
        </div>

        {/* Live Active Crosshair Telemetry Card */}
        <div className="pointer-events-auto bg-[#FAF6E8]/95 backdrop-blur-xs border border-[#0D2E68]/12 rounded-lg px-3.5 py-2 shadow-md flex items-center gap-4">
          <div>
            <div className="text-[9px] font-mono text-[#737687] uppercase">LATITUDE</div>
            <div className="text-xs font-mono font-semibold text-[#0D2E68] tabular-nums">
              {coords.lat}° N
            </div>
          </div>
          <div className="h-6 w-[1px] bg-[#0D2E68]/10" />
          <div>
            <div className="text-[9px] font-mono text-[#737687] uppercase">LONGITUDE</div>
            <div className="text-xs font-mono font-semibold text-[#0D2E68] tabular-nums">
              {coords.lng}° W
            </div>
          </div>
          <div className="h-6 w-[1px] bg-[#0D2E68]/10" />
          <div>
            <div className="text-[9px] font-mono text-[#737687] uppercase">SURFACE DN</div>
            <div className="text-xs font-mono font-semibold text-[#1254EB] tabular-nums">
              {coords.dnValue}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
