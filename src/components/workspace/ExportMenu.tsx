import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Download } from 'lucide-react';
import type { SuperresResult } from '../../api';
import { downloadInputTif, downloadMetadataJson, downloadPng, downloadTif } from '../../lib/exports';

interface Props {
  result: SuperresResult | null;
  name: string;
  /** Layer currently shown in the viewer; 'rgb' means no layer is blended over the output. */
  layerId: string;
  onError: (message: string | null) => void;
}

export default function ExportMenu({ result, name, layerId, onError }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const layer = result?.layers?.find((l) => l.id === layerId && l.id !== 'rgb');

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        rootRef.current?.querySelector('button')?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const run = (job: () => Promise<void> | void) => {
    setOpen(false);
    onError(null);
    Promise.resolve()
      .then(job)
      .catch((err: unknown) => onError(err instanceof Error ? err.message : String(err)));
  };

  const items: { label: string; hint: string; disabled?: boolean; action: () => Promise<void> | void }[] = result
    ? [
        { label: 'GeoTIFF', hint: '2.5 m, georeferenced', action: () => downloadTif(result, name) },
        { label: 'PNG, output', hint: 'Enhanced image', action: () => downloadPng(result, 'output', name) },
        {
          label: 'PNG, current layer',
          hint: layer ? layer.name : 'Select a layer first',
          disabled: !layer,
          action: () => downloadPng(result, layerId, name),
        },
        ...(result.source_scene
          ? [{ label: 'Input GeoTIFF (10 m)', hint: 'Sentinel-2 source crop', action: () => downloadInputTif(result, name) }]
          : []),
        { label: 'Metadata JSON', hint: 'Scene, metrics, stages', action: () => downloadMetadataJson(result, name) },
      ]
    : [];

  return (
    <div ref={rootRef} className="relative max-sm:flex-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={!result}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-line bg-card px-3.5 py-2.5 text-xs font-semibold text-body shadow-2xs transition-all hover:border-line-strong hover:text-ink active:scale-98 disabled:cursor-not-allowed disabled:opacity-50 dark:shadow-none"
      >
        <Download className="h-4 w-4" aria-hidden />
        <span>Export</span>
        <ChevronDown className="h-3.5 w-3.5" aria-hidden />
      </button>
      {open && (
        <div role="menu" aria-label="Export" className="absolute right-0 top-full z-40 mt-2 w-60 overflow-hidden rounded-xl border border-line bg-raised p-1 shadow-lg dark:shadow-none">
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              disabled={it.disabled}
              onClick={() => run(it.action)}
              className="flex w-full cursor-pointer flex-col items-start rounded-lg px-3 py-2 text-left transition-colors hover:bg-sunken disabled:cursor-not-allowed disabled:opacity-45"
            >
              <span className="text-xs font-semibold text-ink">{it.label}</span>
              <span className="text-[11px] text-muted">{it.hint}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
