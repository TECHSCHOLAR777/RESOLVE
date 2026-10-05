import { Suspense, lazy } from 'react';
import { Map as MapIcon } from 'lucide-react';
import type { SuperresResult } from '../../api';
import { Card, Skeleton } from './ui';

const LeafletMap = lazy(() => import('./LeafletMap'));

export default function MapCard({ result, loading }: { result: SuperresResult | null; loading?: boolean }) {
  const bounds = result?.scene?.bounds ?? null;
  return (
    <Card title="Location" icon={<MapIcon size={13} aria-hidden />}>
      <div className="h-56 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950">
        {bounds ? (
          <Suspense fallback={<Skeleton className="h-full w-full rounded-none" />}>
            <LeafletMap bounds={bounds} />
          </Suspense>
        ) : loading ? (
          <Skeleton className="h-full w-full rounded-none" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-400 dark:text-slate-500">
            <MapIcon size={22} aria-hidden />
            <span className="text-xs">Map not available for this scene</span>
          </div>
        )}
      </div>
    </Card>
  );
}
