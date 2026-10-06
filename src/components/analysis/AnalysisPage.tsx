import { useRef, useState } from 'react';
import { ArrowLeft, Calendar, FileText, Hash, MapPin, Satellite, Shapes } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { InspectorPanel } from '../inspector';
import { fmtLat, fmtLon } from '../inspector/ui';
import { useRun } from '../run/RunContext';
import ExportMenu from '../workspace/ExportMenu';
import Viewer from '../workspace/Viewer';
import { useHistory } from '../../lib/history';
import { useSettings } from '../../lib/settings';
import LayerGallery from './LayerGallery';
import TrustStrip from './TrustStrip';

function Chip({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-line bg-card px-2.5 py-1 text-[11px] font-medium text-body">
      <span className="shrink-0 text-faint">{icon}</span>
      <span className="truncate">{children}</span>
    </span>
  );
}

export default function AnalysisPage() {
  const navigate = useNavigate();
  const { result, imageName, samples, initializing, isBusy } = useRun();
  const history = useHistory();
  const { settings } = useSettings();
  const [layerId, setLayerId] = useState(settings.defaultLayer);
  const [exportError, setExportError] = useState<string | null>(null);
  const viewerRef = useRef<HTMLDivElement>(null);

  if (!result) {
    if (initializing || isBusy) return <div className="flex-1" aria-busy="true" />;
    return <Navigate to="/" replace state={{ notice: 'Run a scene first, then open its full analysis.' }} />;
  }

  const layers = result.layers && result.layers.length > 0 ? result.layers : null;
  const selectedId = layers ? (layers.find((l) => l.id === layerId) ?? layers.find((l) => l.id === 'rgb') ?? layers[0]).id : 'rgb';

  const src = result.source_scene;
  const scene = result.scene;
  const satellite = src?.satellite ?? scene?.satellite;
  const date = src?.date ?? scene?.date;
  const tile = src?.tile_id ?? scene?.tile_id;
  const centre = scene?.center;
  const origin = src ? 'Map area' : (history.find((e) => e.id === result.id)?.kind ?? (samples.some((s) => s.name === imageName) ? 'sample' : null));
  const originLabel = origin === 'area' ? 'Map area' : origin === 'sample' ? 'Sample' : origin === 'upload' ? 'Upload' : origin;

  const select = (id: string) => {
    setLayerId(id);
    viewerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <main className="mx-auto flex w-full max-w-[1500px] flex-1 flex-col gap-5 px-4 pb-10 pt-4 lg:pt-0 sm:px-6 xl:px-8">
      <div className="flex flex-col gap-3">
        <Link
          to="/"
          className="inline-flex w-fit items-center gap-1.5 rounded text-xs font-semibold text-muted transition-colors hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to overview
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
          <div className="min-w-0 flex-1 basis-72">
            <h1 className="truncate text-xl font-extrabold tracking-tight text-ink sm:text-2xl xl:text-3xl" title={imageName}>
              {imageName}
            </h1>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {satellite && <Chip icon={<Satellite className="h-3 w-3" aria-hidden />}>{satellite}</Chip>}
              {date && <Chip icon={<Calendar className="h-3 w-3" aria-hidden />}>{date}</Chip>}
              {tile && <Chip icon={<Hash className="h-3 w-3" aria-hidden />}>Tile {tile}</Chip>}
              {centre && (
                <Chip icon={<MapPin className="h-3 w-3" aria-hidden />}>
                  {fmtLat(centre.lat)}, {fmtLon(centre.lon)}
                </Chip>
              )}
              {originLabel && <Chip icon={<Shapes className="h-3 w-3" aria-hidden />}>{originLabel}</Chip>}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 max-sm:w-full [&>*]:max-sm:flex-1">
            <ExportMenu result={result} name={imageName} layerId={selectedId} onError={setExportError} />
            <button
              type="button"
              onClick={() => navigate('/report')}
              className="flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-line bg-card px-3.5 py-2.5 text-xs font-semibold text-body shadow-2xs transition-all hover:border-line-strong hover:text-ink active:scale-98 dark:shadow-none"
            >
              <FileText className="h-4 w-4" aria-hidden />
              <span>Report</span>
            </button>
          </div>
        </div>
        {exportError && (
          <p role="alert" className="text-xs text-red-600 dark:text-red-400">
            {exportError}
          </p>
        )}
      </div>

      <TrustStrip result={result} />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_21.5rem] xl:gap-x-6">
        <div ref={viewerRef} className="min-w-0 scroll-mt-16 xl:col-start-1 xl:row-start-1">
          <Viewer result={result} imageName={imageName} initializing={false} layerId={layerId} onLayerChange={setLayerId} />
        </div>
        <div className="xl:sticky xl:top-2 xl:col-start-2 xl:row-span-2 xl:row-start-1 xl:max-h-[calc(100dvh-1rem)] xl:overflow-y-auto xl:pr-1">
          <InspectorPanel result={result} sceneName={imageName} />
        </div>
        {layers && (
          <div className="min-w-0 pt-2 xl:col-start-1 xl:row-start-2">
            <LayerGallery layers={layers} selectedId={selectedId} onSelect={select} />
          </div>
        )}
      </div>
    </main>
  );
}
