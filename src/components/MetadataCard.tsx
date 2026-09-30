import React from 'react';
import { SatelliteScene } from '../types';
import { Globe, Calendar, Cloud, Scan, Copy, Check } from 'lucide-react';

interface MetadataCardProps {
  scene: SatelliteScene;
}

export const MetadataCard: React.FC<MetadataCardProps> = ({ scene }) => {
  const [copied, setCopied] = React.useState(false);

  const copyCoordinates = () => {
    const text = `${scene.coordinates.lat.toFixed(5)}, ${scene.coordinates.lng.toFixed(5)}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-[#FFFFFF] border border-[#0D2E68]/10 rounded-lg p-3.5 shadow-[0_2px_8px_-2px_rgba(13,46,104,0.06)]">
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div>
          <h3 className="text-sm font-semibold text-[#0D2E68] font-display leading-tight">
            {scene.name}
          </h3>
          <p className="text-xs text-[#5A6070] mt-0.5 flex items-center gap-1.5">
            <Globe className="w-3 h-3 text-[#1254EB]" />
            <span>{scene.location}</span>
          </p>
        </div>

        <button
          onClick={copyCoordinates}
          title="Copy Center Coordinates"
          className="p-1.5 rounded hover:bg-[#F9ECC2]/45 text-[#5A6070] hover:text-[#0D2E68] transition-colors"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-emerald-600" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {/* Primary Technical Metrics */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-[#F1F3FF] border border-[#0D2E68]/8 rounded p-2">
          <div className="flex items-center gap-1 text-[10px] font-mono uppercase text-[#737687]">
            <Scan className="w-3 h-3 text-[#1254EB]" />
            <span>Resolution</span>
          </div>
          <div className="text-xs font-mono font-semibold text-[#0D2E68] mt-0.5 tabular-nums">
            {scene.resolution}
          </div>
        </div>

        <div className="bg-[#F1F3FF] border border-[#0D2E68]/8 rounded p-2">
          <div className="flex items-center gap-1 text-[10px] font-mono uppercase text-[#737687]">
            <Cloud className="w-3 h-3 text-[#1254EB]" />
            <span>Cloud Cover</span>
          </div>
          <div className="text-xs font-mono font-semibold text-[#0D2E68] mt-0.5 tabular-nums">
            {scene.cloudCover}
          </div>
        </div>
      </div>

      {/* Sensor & Acquisition Details */}
      <div className="space-y-1.5 text-xs border-t border-[#0D2E68]/6 pt-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[#737687]">Sensor Payload:</span>
          <span className="font-mono text-[#0D2E68] text-[11px] truncate max-w-[170px]" title={scene.sensor}>
            {scene.sensor}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[#737687]">Acquisition Date:</span>
          <span className="font-mono text-[#0D2E68] text-[11px] flex items-center gap-1">
            <Calendar className="w-3 h-3 text-[#737687]" />
            {scene.acquisitionDate}
          </span>
        </div>

        {scene.dimensions && (
          <div className="flex items-center justify-between">
            <span className="text-[#737687]">Raster Raster Grid:</span>
            <span className="font-mono text-[#0D2E68] text-[11px]">
              {scene.dimensions} px
            </span>
          </div>
        )}

        {scene.fileSize && (
          <div className="flex items-center justify-between">
            <span className="text-[#737687]">Payload Size:</span>
            <span className="font-mono text-[#0D2E68] text-[11px]">
              {scene.fileSize}
            </span>
          </div>
        )}
      </div>

      {/* Spatial Bounding Box */}
      <div className="mt-3 pt-2.5 border-t border-[#0D2E68]/6">
        <div className="text-[10px] font-mono uppercase text-[#737687] mb-1.5">
          Spatial Extent (WGS84)
        </div>
        <div className="bg-[#FAF6E8] border border-[#0D2E68]/8 rounded px-2.5 py-1.5 text-[11px] font-mono text-[#0D2E68] space-y-0.5">
          <div className="flex justify-between">
            <span className="text-[#737687]">N / S:</span>
            <span>{scene.bounds.north} · {scene.bounds.south}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#737687]">E / W:</span>
            <span>{scene.bounds.east} · {scene.bounds.west}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
