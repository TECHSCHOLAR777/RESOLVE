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

export default function InspectorPanel({ result, sceneName, loading = false }: InspectorPanelProps) {
  return (
    <aside
      aria-label="Inspector"
      className="flex w-full flex-col gap-3 bg-transparent text-slate-900 dark:text-slate-100"
    >
      <SceneCard result={result} sceneName={sceneName} loading={loading} />
      <MapCard result={result} loading={loading} />
      <MetricsCard result={result} loading={loading} />
      <PipelineCard result={result} loading={loading} />
    </aside>
  );
}
