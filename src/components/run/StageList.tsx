import {
  AlertCircle,
  AudioWaveform,
  Check,
  Cpu,
  Filter,
  Globe,
  Grid3x3,
  Lock,
  PackageCheck,
  Satellite,
  ShieldCheck,
  SlidersHorizontal,
  type LucideIcon,
} from 'lucide-react';
import { motion } from 'motion/react';
import { BACKBONE, stageDescription, type SceneCtx, type StageView } from './timeline';

const STAGES: { title: string; icon: LucideIcon; doneNote?: string }[] = [
  { title: 'Sentinel-2 ingest', icon: Satellite },
  { title: 'Reflectance normalisation', icon: SlidersHorizontal },
  { title: 'AlphaEarth context', icon: Globe },
  { title: 'Sensor-matched patching', icon: Grid3x3 },
  { title: 'AlphaEarth change gate', icon: Filter },
  { title: 'Wavelet texture branch', icon: AudioWaveform },
  { title: 'Mamba backbone', icon: Cpu },
  { title: 'Measurement lock', icon: Lock, doneNote: 'consistency verified' },
  { title: 'Trust layer', icon: ShieldCheck },
  { title: 'Products', icon: PackageCheck },
];

interface Props {
  views: StageView[];
  ctx: SceneCtx;
  held: boolean;
  failed: boolean;
}

export default function StageList({ views, ctx, held, failed }: Props) {
  return (
    <ol className="divide-y divide-line-soft">
      {STAGES.map((stage, i) => {
        const v = views[i];
        const Icon = stage.icon;
        const running = v.status === 'running';
        const done = v.status === 'done';
        const waiting = running && i === BACKBONE && held;
        const errored = running && failed;
        return (
          <li
            key={stage.title}
            className={`grid grid-cols-[2rem_1fr_auto] items-start gap-3 px-1 py-2.5 transition-opacity duration-200 ${
              v.status === 'queued' ? 'opacity-55' : 'opacity-100'
            }`}
          >
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-colors duration-200 ${
                errored
                  ? 'border-red-200 bg-red-50 text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400'
                  : running
                    ? 'border-blue-200 bg-blue-50 text-accent-text dark:border-blue-400/30 dark:bg-blue-500/15'
                    : done
                      ? 'border-line bg-card text-body'
                      : 'border-line bg-sunken text-faint'
              }`}
            >
              <Icon className="h-4 w-4" strokeWidth={1.75} />
            </div>

            <div className="min-w-0">
              <div className={`text-[13px] font-semibold leading-5 ${running ? 'text-ink' : 'text-body'}`}>{stage.title}</div>
              <div className="text-xs leading-[18px] text-muted">
                {done && stage.doneNote ? `${stageDescription(i, ctx)}, ${stage.doneNote}` : stageDescription(i, ctx)}
              </div>
              {running && (
                <div className="mt-1.5 h-[3px] overflow-hidden rounded-full bg-sunken">
                  {waiting ? (
                    <div className="relative h-full w-full overflow-hidden">
                      <motion.div
                        className="absolute inset-y-0 w-1/3 bg-[#2563EB]/70"
                        initial={{ left: '-35%' }}
                        animate={{ left: '100%' }}
                        transition={{ duration: 1.6, ease: 'easeInOut', repeat: Infinity }}
                      />
                    </div>
                  ) : (
                    <div className="h-full rounded-full bg-[#2563EB]" style={{ width: `${Math.round(v.progress * 100)}%` }} />
                  )}
                </div>
              )}
              {waiting && <div className="mt-1 text-[11px] text-muted">Waiting for compute</div>}
            </div>

            <div className="flex h-5 items-center justify-end gap-1.5 pt-0.5 text-[11px]">
              {errored ? (
                <>
                  <AlertCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                  <span className="text-red-600 dark:text-red-400">Failed</span>
                </>
              ) : done ? (
                <>
                  <Check className="h-3.5 w-3.5 text-accent-text" strokeWidth={2.5} />
                  <span className="font-mono tabular-nums text-muted">{v.durationMs} ms</span>
                </>
              ) : running ? (
                <span className="font-mono tabular-nums text-accent-text">{waiting ? 'waiting' : `${Math.round(v.progress * 100)}%`}</span>
              ) : (
                <span className="text-faint">Queued</span>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
