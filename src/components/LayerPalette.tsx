import React from 'react';
import { SpectralBand } from '../types';
import { Layers, Eye, EyeOff, Sliders, Grid3X3, Crosshair, Plus } from 'lucide-react';

interface LayerPaletteProps {
  band: SpectralBand;
  setBand: (b: SpectralBand) => void;
  opacity: number;
  setOpacity: (val: number) => void;
  contrast: number;
  setContrast: (val: number) => void;
  brightness: number;
  setBrightness: (val: number) => void;
  showGrid: boolean;
  setShowGrid: (val: boolean) => void;
  showReticle: boolean;
  setShowReticle: (val: boolean) => void;
  onOpenUpload: () => void;
  sceneName: string;
}

const BANDS: { id: SpectralBand; label: string; desc: string; color: string }[] = [
  { id: 'rgb', label: 'True Color (RGB)', desc: 'B4-B3-B2 Visible Daylight', color: '#1254EB' },
  { id: 'nir', label: 'Color Infrared (NIR)', desc: 'B8-B4-B3 Veg. Biomass', color: '#E11D48' },
  { id: 'ndvi', label: 'Vegetation Index', desc: 'Normalized (NIR-Red)/(NIR+Red)', color: '#16A34A' },
  { id: 'swir', label: 'Shortwave IR (SWIR)', desc: 'B12-B8-B4 Moisture & Mineral', color: '#D97706' },
  { id: 'pan', label: 'Panchromatic (B8A)', desc: 'High-Res Structural Sharpness', color: '#4B5563' },
];

export const LayerPalette: React.FC<LayerPaletteProps> = ({
  band,
  setBand,
  opacity,
  setOpacity,
  contrast,
  setContrast,
  brightness,
  setBrightness,
  showGrid,
  setShowGrid,
  showReticle,
  setShowReticle,
  onOpenUpload,
  sceneName,
}) => {
  const [layerVisible, setLayerVisible] = React.useState(true);

  return (
    <div className="bg-[#FFFFFF] border border-[#0D2E68]/10 rounded-lg p-3.5 shadow-[0_2px_8px_-2px_rgba(13,46,104,0.06)] space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-[#0D2E68] font-display">
          <Layers className="w-3.5 h-3.5 text-[#1254EB]" />
          <span>Raster & Band Controls</span>
        </div>
        <button
          onClick={onOpenUpload}
          className="flex items-center gap-1 text-[11px] font-semibold text-[#1254EB] hover:text-[#003EBB] bg-[#F1F3FF] hover:bg-[#E9EDFF] px-2 py-1 rounded transition-colors"
        >
          <Plus className="w-3 h-3" />
          <span>New Imagery</span>
        </button>
      </div>

      {/* Layer Tree */}
      <div className="border border-[#0D2E68]/8 rounded bg-[#FBFBF7] p-2 space-y-1.5">
        <div className="text-[10px] font-mono uppercase text-[#737687]">Active Raster Layers</div>

        <div className="flex items-center justify-between bg-white border border-[#0D2E68]/8 rounded px-2.5 py-1.5 shadow-xs">
          <div className="flex items-center gap-2 truncate pr-2">
            <button
              onClick={() => setLayerVisible(!layerVisible)}
              className="text-[#1254EB] hover:opacity-80 transition-opacity"
              title={layerVisible ? 'Hide Layer' : 'Show Layer'}
            >
              {layerVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 text-[#737687]" />}
            </button>
            <span className="text-xs font-medium text-[#0D2E68] truncate">
              {sceneName}
            </span>
          </div>
          <span className="text-[10px] font-mono text-[#1254EB] bg-[#F1F3FF] px-1.5 py-0.5 rounded">
            {band.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Spectral Band Selector */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-semibold text-[#0D2E68]">Spectral Band Preset</span>
          <span className="text-[10px] font-mono text-[#5A6070]">{band.toUpperCase()} Selected</span>
        </div>

        <div className="grid grid-cols-1 gap-1">
          {BANDS.map((item) => {
            const isActive = band === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setBand(item.id)}
                className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition-all flex items-center justify-between ${
                  isActive
                    ? 'bg-[#F9ECC2]/60 text-[#0D2E68] border border-[#1254EB]/30 shadow-xs'
                    : 'bg-[#FBFBF7] hover:bg-[#F1F3FF] text-[#434655] border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <div className="truncate">
                    <div className="font-medium text-[11px] leading-tight text-[#0D2E68]">{item.label}</div>
                    <div className="text-[10px] font-mono text-[#737687]">{item.desc}</div>
                  </div>
                </div>
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#1254EB] shrink-0 ml-2" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Radiometric Adjustments */}
      <div className="space-y-3 pt-2 border-t border-[#0D2E68]/6">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-[#0D2E68]">
          <Sliders className="w-3.5 h-3.5 text-[#1254EB]" />
          <span>Radiometric Stretches</span>
        </div>

        {/* Opacity Slider */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[#5A6070]">Layer Opacity</span>
            <span className="font-mono text-[#0D2E68] tabular-nums">{opacity}%</span>
          </div>
          <input
            type="range"
            min="10"
            max="100"
            value={opacity}
            onChange={(e) => setOpacity(Number(e.target.value))}
            className="w-full h-1.5 bg-[#DDE2F5] rounded-lg appearance-none cursor-pointer accent-[#1254EB]"
          />
        </div>

        {/* Contrast Slider */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[#5A6070]">Contrast Stretch</span>
            <span className="font-mono text-[#0D2E68] tabular-nums">{contrast}%</span>
          </div>
          <input
            type="range"
            min="60"
            max="160"
            value={contrast}
            onChange={(e) => setContrast(Number(e.target.value))}
            className="w-full h-1.5 bg-[#DDE2F5] rounded-lg appearance-none cursor-pointer accent-[#1254EB]"
          />
        </div>

        {/* Brightness Slider */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[#5A6070]">Sensor Gain (Brightness)</span>
            <span className="font-mono text-[#0D2E68] tabular-nums">{brightness}%</span>
          </div>
          <input
            type="range"
            min="70"
            max="140"
            value={brightness}
            onChange={(e) => setBrightness(Number(e.target.value))}
            className="w-full h-1.5 bg-[#DDE2F5] rounded-lg appearance-none cursor-pointer accent-[#1254EB]"
          />
        </div>
      </div>

      {/* Cartographic Overlays */}
      <div className="pt-2 border-t border-[#0D2E68]/6 space-y-2">
        <div className="text-[10px] font-mono uppercase text-[#737687]">Overlays & Reticle</div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-[#0D2E68]">
            <Grid3X3 className="w-3.5 h-3.5 text-[#5A6070]" />
            <span>UTM 1000m Grid</span>
          </div>
          <button
            onClick={() => setShowGrid(!showGrid)}
            className={`w-9 h-5 rounded-full transition-colors relative p-0.5 ${
              showGrid ? 'bg-[#1254EB]' : 'bg-[#DDE2F5]'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white transition-transform ${
                showGrid ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-[#0D2E68]">
            <Crosshair className="w-3.5 h-3.5 text-[#5A6070]" />
            <span>Reticle Crosshair HUD</span>
          </div>
          <button
            onClick={() => setShowReticle(!showReticle)}
            className={`w-9 h-5 rounded-full transition-colors relative p-0.5 ${
              showReticle ? 'bg-[#1254EB]' : 'bg-[#DDE2F5]'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white transition-transform ${
                showReticle ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
};
