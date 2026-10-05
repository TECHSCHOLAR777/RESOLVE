import { useMemo } from 'react';
import { Layers } from 'lucide-react';
import type { LayerInfo } from '../../api';
import Legend from './Legend';

const GROUP_ORDER = ['imagery', 'indices', 'maps', 'trust', 'model internals'];

function groupRank(g: string): number {
  const i = GROUP_ORDER.indexOf(g.trim().toLowerCase());
  return i === -1 ? GROUP_ORDER.length : i;
}

export function groupLayers(layers: LayerInfo[]): { group: string; layers: LayerInfo[] }[] {
  const map = new Map<string, LayerInfo[]>();
  for (const l of layers) {
    const g = l.group || 'Other';
    map.set(g, [...(map.get(g) ?? []), l]);
  }
  return [...map.entries()]
    .map(([group, ls]) => ({ group, layers: ls }))
    .sort((a, b) => groupRank(a.group) - groupRank(b.group));
}

interface Props {
  layers: LayerInfo[];
  selectedId: string;
  onSelect: (id: string) => void;
  opacity: number;
  onOpacity: (v: number) => void;
}

/** Grouped layer picker for the output panel, with legend and an opacity blend over the RGB output. */
export default function LayerSwitcher({ layers, selectedId, onSelect, opacity, onOpacity }: Props) {
  const groups = useMemo(() => groupLayers(layers), [layers]);
  const selected = layers.find((l) => l.id === selectedId) ?? layers[0];
  const activeGroup = groups.find((g) => g.layers.some((l) => l.id === selected.id)) ?? groups[0];
  const isBase = selected.id === 'rgb';

  return (
    <div className="rounded-xl border border-line bg-sunken/60 p-2.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <Layers className="h-3.5 w-3.5 shrink-0 text-faint" aria-hidden />
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-faint">Output layer</span>
        <div className="flex min-w-0 gap-0.5 overflow-x-auto [scrollbar-width:none] max-sm:basis-full sm:flex-1" role="tablist" aria-label="Layer groups">
          {groups.map((g) => (
            <button
              key={g.group}
              type="button"
              role="tab"
              aria-selected={g === activeGroup}
              onClick={() => onSelect(g.layers[0].id)}
              className={`shrink-0 cursor-pointer whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${
                g === activeGroup ? 'bg-raised text-accent-text shadow-2xs dark:shadow-none' : 'text-muted hover:text-ink'
              }`}
            >
              {g.group}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Layers">
        {activeGroup.layers.map((l) => {
          const on = l.id === selected.id;
          return (
            <button
              key={l.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onSelect(l.id)}
              className={`cursor-pointer rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                on
                  ? 'border-accent-line bg-accent-soft text-accent-text'
                  : 'border-line bg-card text-body hover:border-line-strong hover:text-ink'
              }`}
            >
              {l.name}
            </button>
          );
        })}
      </div>

      {!isBase && (
        <div className="mt-2.5 grid grid-cols-1 items-center gap-x-4 gap-y-2 sm:grid-cols-[minmax(0,1fr)_9.5rem]">
          {selected.legend ? <Legend legend={selected.legend} /> : <span />}
          <label className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-faint">
            Opacity
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(opacity * 100)}
              onChange={(e) => onOpacity(Number(e.target.value) / 100)}
              aria-label="Layer opacity"
              className="h-1 min-w-0 flex-1 cursor-pointer accent-[#2563EB]"
            />
            <span className="w-8 text-right font-mono tabular-nums text-muted">{Math.round(opacity * 100)}%</span>
          </label>
        </div>
      )}
    </div>
  );
}
