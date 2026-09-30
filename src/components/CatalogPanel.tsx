import React from 'react';
import { SatelliteScene } from '../types';
import { Compass, Upload, Check, Globe } from 'lucide-react';

interface CatalogPanelProps {
  scenes: SatelliteScene[];
  activeSceneId: string;
  onSelectScene: (scene: SatelliteScene) => void;
  onOpenUpload: () => void;
}

export const CatalogPanel: React.FC<CatalogPanelProps> = ({
  scenes,
  activeSceneId,
  onSelectScene,
  onOpenUpload,
}) => {
  return (
    <div className="bg-[#FFFFFF] border border-[#0D2E68]/10 rounded-lg p-4 shadow-[0_2px_8px_-2px_rgba(13,46,104,0.06)] h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-[#0D2E68] font-display">
            Earth Observation Catalog
          </h2>
          <p className="text-xs text-[#5A6070] mt-0.5">
            Select a satellite scene or upload new imagery
          </p>
        </div>

        <button
          onClick={onOpenUpload}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#1254EB] hover:bg-[#003EBB] rounded shadow-xs transition-colors"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Upload Image</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {scenes.map((scene) => {
          const isActive = scene.id === activeSceneId;
          return (
            <div
              key={scene.id}
              onClick={() => onSelectScene(scene)}
              className={`border rounded-lg overflow-hidden cursor-pointer transition-all flex flex-col ${
                isActive
                  ? 'border-[#1254EB] ring-2 ring-[#1254EB]/20 bg-[#F1F3FF]'
                  : 'border-[#0D2E68]/10 hover:border-[#1254EB]/60 bg-[#FBFBF7] hover:bg-white'
              }`}
            >
              {/* Thumbnail image */}
              <div className="h-36 w-full bg-[#151B29] relative overflow-hidden group">
                <img
                  src={scene.imageUrl}
                  alt={scene.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute top-2 left-2 bg-[#0D2E68]/85 text-white text-[10px] font-mono px-2 py-0.5 rounded backdrop-blur-xs">
                  {scene.resolution}
                </div>
                {isActive && (
                  <div className="absolute top-2 right-2 bg-[#1254EB] text-white p-1 rounded-full shadow-md">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>

              {/* Information */}
              <div className="p-3 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="text-xs font-semibold text-[#0D2E68] font-display line-clamp-1">
                    {scene.name}
                  </h3>
                  <div className="flex items-center gap-1 text-[11px] text-[#5A6070] mt-1">
                    <Globe className="w-3 h-3 text-[#1254EB]" />
                    <span className="truncate">{scene.location}</span>
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-[#0D2E68]/6 flex items-center justify-between text-[10px] font-mono text-[#737687]">
                  <span>{scene.sensor.split('·')[0]}</span>
                  <span>{scene.acquisitionDate}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
