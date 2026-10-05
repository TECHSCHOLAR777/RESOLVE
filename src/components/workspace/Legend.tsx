import type { LayerLegend } from '../../api';

/** CSS approximations of the backend colormaps, left (min) to right (max). */
const GRADIENTS: Record<string, string> = {
  viridis: 'linear-gradient(to right, #440154, #3b528b, #21918c, #5ec962, #fde725)',
  magma: 'linear-gradient(to right, #000004, #3b0f70, #8c2981, #de4968, #fe9f6d, #fcfdbf)',
  rdylgn: 'linear-gradient(to right, #a50026, #f46d43, #fee08b, #a6d96a, #1a9850, #006837)',
  blues: 'linear-gradient(to right, #f7fbff, #c6dbef, #6baed6, #2171b5, #08306b)',
  greens: 'linear-gradient(to right, #f7fcf5, #c7e9c0, #74c476, #238b45, #00441b)',
};
const FALLBACK = 'linear-gradient(to right, #111827, #6b7280, #f9fafb)';

export function gradientFor(colormap: string): string {
  return GRADIENTS[colormap.toLowerCase().replace(/[^a-z]/g, '')] ?? FALLBACK;
}

export default function Legend({ legend }: { legend: LayerLegend }) {
  if (legend.type === 'ramp') {
    return (
      <div className="min-w-0">
        <div
          className="h-2 w-full rounded-full border border-line"
          style={{ background: gradientFor(legend.colormap) }}
          role="img"
          aria-label={`Colour scale from ${legend.min_label} to ${legend.max_label}`}
        />
        <div className="mt-1 flex justify-between gap-2 font-mono text-[10px] text-muted">
          <span className="truncate">{legend.min_label}</span>
          <span className="truncate text-right">{legend.max_label}</span>
        </div>
      </div>
    );
  }
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1">
      {legend.classes.map((c) => (
        <li key={c.label} className="flex items-center gap-1.5 text-[11px] text-body">
          <span className="h-2.5 w-2.5 shrink-0 rounded-sm border border-black/15 dark:border-white/20" style={{ backgroundColor: c.color }} />
          {c.label}
        </li>
      ))}
    </ul>
  );
}
