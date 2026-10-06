import { useMemo } from 'react';
import type { LayerInfo } from '../../api';
import { absUrl } from '../../api';
import Legend from '../workspace/Legend';
import { groupLayers } from '../workspace/LayerSwitcher';

interface Props {
  layers: LayerInfo[];
  selectedId: string;
  onSelect: (id: string) => void;
}

/** Every product layer as a small card, grouped. Selecting one shows it in the main viewer. */
export default function LayerGallery({ layers, selectedId, onSelect }: Props) {
  const groups = useMemo(() => groupLayers(layers), [layers]);
  return (
    <section aria-label="Layer gallery" className="flex flex-col gap-5">
      <div>
        <h2 className="text-base font-bold text-ink">All layers</h2>
        <p className="mt-0.5 text-xs text-muted">{layers.length} pixel-aligned layers. Select one to view it above.</p>
      </div>
      {groups.map((g) => (
        <div key={g.group}>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-faint">{g.group}</h3>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-3 min-[1400px]:grid-cols-4">
            {g.layers.map((l) => {
              const on = l.id === selectedId;
              return (
                <li key={l.id} className="min-w-0">
                  <button
                    type="button"
                    onClick={() => onSelect(l.id)}
                    aria-pressed={on}
                    className={`flex h-full w-full cursor-pointer flex-col overflow-hidden rounded-xl border bg-card text-left shadow-2xs transition-all hover:border-line-strong dark:shadow-none ${
                      on ? 'border-accent-text ring-2 ring-accent-text/30' : 'border-line'
                    }`}
                  >
                    <div className="aspect-[4/3] w-full overflow-hidden bg-sunken">
                      <img src={absUrl(l.url)} alt="" loading="lazy" draggable={false} className="h-full w-full object-cover" />
                    </div>
                    <div className="flex flex-1 flex-col gap-1.5 p-2.5">
                      <span className={`truncate text-xs font-bold ${on ? 'text-accent-text' : 'text-ink'}`}>{l.name}</span>
                      {l.legend && <Legend legend={l.legend} compact />}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}
