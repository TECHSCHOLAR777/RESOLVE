import React, { useMemo } from 'react';
import { SpectralBand } from '../types';

interface HistogramViewerProps {
  band: SpectralBand;
  brightness: number;
  contrast: number;
}

export const HistogramViewer: React.FC<HistogramViewerProps> = ({
  band,
  brightness,
  contrast,
}) => {
  // Generate a realistic radiometric distribution curve based on band and stretch
  const { points, areaPath, minDn, maxDn, meanDn, p95 } = useMemo(() => {
    // Generate 64 bins
    const bins = 64;
    const values: number[] = [];

    // Base distribution shape per band
    const centerOffset = (brightness - 100) * 0.4;
    const spreadMultiplier = (contrast / 100);

    let peak1 = 24 + centerOffset;
    let peak2 = 42 + centerOffset;

    if (band === 'nir') {
      peak1 = 34 + centerOffset;
      peak2 = 50 + centerOffset;
    } else if (band === 'ndvi') {
      peak1 = 18 + centerOffset;
      peak2 = 46 + centerOffset;
    } else if (band === 'pan') {
      peak1 = 28 + centerOffset;
      peak2 = 36 + centerOffset;
    }

    for (let i = 0; i < bins; i++) {
      const x = i;
      // Dual-gaussian satellite radiometric histogram simulation
      const g1 = Math.exp(-Math.pow((x - peak1) / (8 * spreadMultiplier), 2));
      const g2 = 0.7 * Math.exp(-Math.pow((x - peak2) / (12 * spreadMultiplier), 2));
      const noise = 0.05 * Math.sin(i * 0.7);
      const val = Math.max(0, Math.min(1, (g1 + g2) * 0.6 + noise));
      values.push(val);
    }

    // Convert to SVG points for a 240x80 box
    const width = 240;
    const height = 70;
    const pts = values.map((v, i) => {
      const x = (i / (bins - 1)) * width;
      const y = height - v * (height - 8);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    const pathLine = `M ${pts.join(' L ')}`;
    const pathArea = `M 0,${height} L ${pts.join(' L ')} L ${width},${height} Z`;

    const minVal = Math.max(0, Math.round(12 + (brightness - 100) * 0.2));
    const maxVal = Math.min(255, Math.round(238 + (contrast - 100) * 0.15));
    const meanVal = Math.round((minVal + maxVal) / 2);

    return {
      points: pathLine,
      areaPath: pathArea,
      minDn: minVal,
      maxDn: maxVal,
      meanDn: meanVal,
      p95: Math.min(255, Math.round(maxVal * 0.94)),
    };
  }, [band, brightness, contrast]);

  return (
    <div className="bg-[#FFFFFF] border border-[#0D2E68]/10 rounded-lg p-3.5 shadow-[0_2px_8px_-2px_rgba(13,46,104,0.06)]">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-semibold text-[#0D2E68] font-display tracking-tight">
          Radiometric Histogram
        </div>
        <div className="text-[11px] font-mono text-[#5A6070] uppercase">
          Band: <span className="text-[#1254EB] font-medium">{band.toUpperCase()}</span>
        </div>
      </div>

      {/* SVG Radiometric Chart */}
      <div className="relative w-full h-[76px] bg-[#FBFBF7] border border-[#0D2E68]/6 rounded overflow-hidden">
        {/* Subtle grid lines */}
        <div className="absolute inset-0 flex justify-between pointer-events-none px-2 opacity-30">
          <div className="border-r border-[#0D2E68]/15 h-full w-0" />
          <div className="border-r border-[#0D2E68]/15 h-full w-0" />
          <div className="border-r border-[#0D2E68]/15 h-full w-0" />
        </div>

        <svg
          viewBox="0 0 240 70"
          preserveAspectRatio="none"
          className="w-full h-full"
        >
          {/* Buttercup fill under curve */}
          <path
            d={areaPath}
            fill="#F9ECC2"
            fillOpacity="0.85"
          />
          {/* Royal blue curve line */}
          <path
            d={points}
            fill="none"
            stroke="#1254EB"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        {/* Dynamic min/max indicator line */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#1254EB]/15" />
      </div>

      {/* Telemetry Readouts in JetBrains Mono */}
      <div className="grid grid-cols-4 gap-1 mt-2.5 pt-2 border-t border-[#0D2E68]/6">
        <div>
          <div className="text-[10px] font-mono text-[#737687]">MIN DN</div>
          <div className="text-xs font-mono font-medium text-[#0D2E68] tabular-nums">
            {minDn}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-mono text-[#737687]">MEAN</div>
          <div className="text-xs font-mono font-medium text-[#0D2E68] tabular-nums">
            {meanDn}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-mono text-[#737687]">MAX DN</div>
          <div className="text-xs font-mono font-medium text-[#0D2E68] tabular-nums">
            {maxDn}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-mono text-[#737687]">P95</div>
          <div className="text-xs font-mono font-medium text-[#1254EB] tabular-nums">
            {p95}
          </div>
        </div>
      </div>
    </div>
  );
};
