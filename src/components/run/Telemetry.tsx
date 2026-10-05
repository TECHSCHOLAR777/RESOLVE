import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, Loader2, Terminal } from 'lucide-react';
import type { LogLine } from './useRunTimeline';

interface Props {
  patchesDone: number;
  patchTotal: number;
  stageTitle: string;
  stageIndex: number;
  stageTotal: number;
  elapsedMs: number;
  waiting: boolean;
  logs: LogLine[];
}

function Counter({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-faint">{label}</div>
      <div className="truncate font-mono text-[13px] tabular-nums text-ink">{value}</div>
    </div>
  );
}

export default function Telemetry({ patchesDone, patchTotal, stageTitle, stageIndex, stageTotal, elapsedMs, waiting, logs }: Props) {
  const [open, setOpen] = useState(() => (typeof window === 'undefined' ? true : window.innerWidth >= 768));
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs.length, open]);

  return (
    <section className="rounded-2xl border border-line bg-card p-4 shadow-xs dark:shadow-none">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="grid flex-1 grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
          <Counter label="Patches" value={`${patchesDone} / ${patchTotal}`} />
          <div className="col-span-2 sm:col-span-1">
            <Counter label="Stage" value={`${String(stageIndex + 1).padStart(2, '0')}/${stageTotal} ${stageTitle}`} />
          </div>
          <Counter label="Elapsed" value={`${(elapsedMs / 1000).toFixed(1)} s`} />
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-faint">Compute</div>
            <div className="flex items-center gap-1.5 text-[13px] text-ink">
              {waiting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-accent-text" />
                  <span>Allocating compute</span>
                </>
              ) : (
                <span>Ready</span>
              )}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-body transition-colors hover:bg-sunken cursor-pointer"
        >
          <Terminal className="h-3.5 w-3.5" />
          <span>Log</span>
          <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="log"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div ref={scroller} className="mt-4 h-36 select-text overflow-y-auto rounded-lg bg-sunken px-3 py-2.5 font-mono text-[11px] leading-5 text-muted">
              {logs.map((l, i) => (
                <div key={i} className="flex gap-3">
                  <span className="shrink-0 tabular-nums text-faint">+{(l.at / 1000).toFixed(2)}s</span>
                  <span className="min-w-0 break-words">{l.text}</span>
                </div>
              ))}
              {waiting && (
                <div className="flex items-center gap-3">
                  <Loader2 className="my-1 h-3 w-3 animate-spin text-faint" />
                  <span>allocating compute</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
