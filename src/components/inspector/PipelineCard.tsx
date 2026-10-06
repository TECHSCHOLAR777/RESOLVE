import { Check, ListChecks } from 'lucide-react';
import type { SuperresResult } from '../../api';
import { SEARCH_TITLE, STAGE_TITLES, mapStageMs, searchMs } from '../run/stageTimings';
import { Card } from './ui';

export const PIPELINE_STAGES = STAGE_TITLES;

export default function PipelineCard({ result, loading }: { result: SuperresResult | null; loading?: boolean }) {
  const done = !!result;
  const area = !!result?.source_scene;
  const stages = area ? [SEARCH_TITLE, ...PIPELINE_STAGES] : PIPELINE_STAGES;
  const ms = area ? [searchMs(result?.stages), ...mapStageMs(result?.stages)] : mapStageMs(result?.stages);
  return (
    <Card
      title="Pipeline"
      icon={<ListChecks size={13} aria-hidden />}
      action={
        <span className="text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
          {done ? stages.length : 0}/{stages.length}
        </span>
      }
    >
      <ol className="space-y-1.5">
        {stages.map((name, i) => (
          <li key={name} className="flex items-center gap-2.5 text-sm">
            <span
              className={`flex size-4 shrink-0 items-center justify-center rounded-full ${
                done ? 'bg-blue-600 text-white dark:bg-blue-500' : `border border-slate-300 dark:border-slate-700 ${loading ? 'animate-pulse' : ''}`
              }`}
            >
              {done && <Check size={10} strokeWidth={3} aria-hidden />}
            </span>
            <span className={`min-w-0 flex-1 ${done ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500'}`}>{name}</span>
            {done && ms[i] != null && (
              <span className="font-mono text-[11px] tabular-nums text-slate-500 dark:text-slate-400">{Math.round(ms[i]!).toLocaleString('en-US')} ms</span>
            )}
          </li>
        ))}
      </ol>
    </Card>
  );
}
