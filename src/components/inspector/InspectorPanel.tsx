import type { SuperresResult } from '../../api';
import SceneCard from './SceneCard';
import MapCard from './MapCard';
import MetricsCard from './MetricsCard';
import PipelineCard from './PipelineCard';

export interface InspectorPanelProps {
  result: SuperresResult | null;
  sceneName: string;
  loading?: boolean;
}

/** Two columns on tablets (scene + pipeline, map + metrics), one stacked column on desktop and phones. */
export default function InspectorPanel({ result, sceneName, loading = false }: InspectorPanelProps) {
  return (
    <aside
      aria-label="Inspector"
      className="grid w-full items-start gap-3 bg-transparent text-slate-900 md:grid-cols-2 xl:flex xl:flex-col xl:items-stretch dark:text-slate-100"
    >
      <div className="contents md:flex md:flex-col md:gap-3 xl:contents">
        <div className="xl:order-1">
          <SceneCard result={result} sceneName={sceneName} loading={loading} />
        </div>
        <div className="max-md:order-4 xl:order-4">
          <PipelineCard result={result} loading={loading} />
        </div>
      </div>
      <div className="contents md:flex md:flex-col md:gap-3 xl:contents">
        <div className="xl:order-2">
          <MapCard result={result} loading={loading} />
        </div>
        <div className="xl:order-3">
          <MetricsCard result={result} loading={loading} />
        </div>
      </div>
    </aside>
  );
}
