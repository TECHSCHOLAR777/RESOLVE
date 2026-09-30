import React from 'react';
import { Upload, RotateCcw, Compass, Layers, Sliders, Activity } from 'lucide-react';

interface TopNavProps {
  activeView: 'viewport' | 'catalog' | 'spectral' | 'radiometry';
  setActiveView: (view: 'viewport' | 'catalog' | 'spectral' | 'radiometry') => void;
  onOpenUpload: () => void;
  onResetView: () => void;
}

export const TopNav: React.FC<TopNavProps> = ({
  activeView,
  setActiveView,
  onOpenUpload,
  onResetView,
}) => {
  return (
    <header className="h-14 border-b border-[#0D2E68]/10 bg-[#FFFFFF] px-4 md:px-6 flex items-center justify-between z-30 select-none shadow-[0_1px_3px_rgba(13,46,104,0.04)]">
      {/* Zone 1: Single text element wordmark */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded bg-[#1254EB] flex items-center justify-center text-white shadow-sm">
          <Compass className="w-4 h-4 stroke-[2.2]" />
        </div>
        <a
          href="/"
          className="text-lg font-semibold tracking-tight text-[#0D2E68] font-display hover:text-[#1254EB] transition-colors"
        >
          Aero Orbit
        </a>
      </div>

      {/* Zone 2: Clean text navigation links / modes */}
      <nav className="hidden md:flex items-center gap-1 bg-[#F1F3FF] p-1 rounded-md border border-[#0D2E68]/8">
        <button
          onClick={() => setActiveView('viewport')}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
            activeView === 'viewport'
              ? 'bg-white text-[#1254EB] shadow-[0_1px_2px_rgba(13,46,104,0.06)]'
              : 'text-[#434655] hover:text-[#0D2E68]'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Raster Viewport</span>
        </button>

        <button
          onClick={() => setActiveView('catalog')}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
            activeView === 'catalog'
              ? 'bg-white text-[#1254EB] shadow-[0_1px_2px_rgba(13,46,104,0.06)]'
              : 'text-[#434655] hover:text-[#0D2E68]'
          }`}
        >
          <Compass className="w-3.5 h-3.5" />
          <span>Scene Catalog</span>
        </button>

        <button
          onClick={() => setActiveView('spectral')}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
            activeView === 'spectral'
              ? 'bg-white text-[#1254EB] shadow-[0_1px_2px_rgba(13,46,104,0.06)]'
              : 'text-[#434655] hover:text-[#0D2E68]'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Spectral Bands</span>
        </button>

        <button
          onClick={() => setActiveView('radiometry')}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
            activeView === 'radiometry'
              ? 'bg-white text-[#1254EB] shadow-[0_1px_2px_rgba(13,46,104,0.06)]'
              : 'text-[#434655] hover:text-[#0D2E68]'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Radiometry</span>
        </button>
      </nav>

      {/* Zone 3: Primary & Secondary Actions */}
      <div className="flex items-center gap-2.5">
        <button
          onClick={onResetView}
          title="Reset canvas transform and center"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#434655] bg-transparent hover:bg-[#F9ECC2]/45 hover:text-[#0D2E68] rounded border border-transparent hover:border-[#0D2E68]/10 transition-colors whitespace-nowrap"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Reset View</span>
        </button>

        <button
          onClick={onOpenUpload}
          className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-[#1254EB] hover:bg-[#003EBB] rounded shadow-sm focus:outline-none focus:ring-2 focus:ring-[#F9ECC2] transition-colors whitespace-nowrap"
        >
          <Upload className="w-3.5 h-3.5 stroke-[2.2]" />
          <span>Upload Imagery</span>
        </button>
      </div>
    </header>
  );
};
