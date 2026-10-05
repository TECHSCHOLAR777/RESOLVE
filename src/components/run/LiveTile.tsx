import { motion } from 'motion/react';
import type { Grid, PatchState } from './timeline';

interface Props {
  /** Sharp reconstruction, available once the response has arrived. */
  outputSrc: string | null;
  /** Input preview (from the response), or the early sample thumbnail. */
  baseSrc: string | null;
  onBaseError: () => void;
  onBaseSize: (w: number, h: number) => void;
  aspect: number;
  grid: Grid;
  patches: PatchState[];
  /** Waiting for the backend: show the scan-line sweep. */
  waiting: boolean;
  failed: boolean;
}

const pct = (n: number) => `${Math.round(n * 1000) / 10}%`;

export default function LiveTile({ outputSrc, baseSrc, onBaseError, onBaseSize, aspect, grid, patches, waiting, failed }: Props) {
  const { cols, rows } = grid;
  const cell = (i: number) => ({ r: Math.floor(i / cols), c: i % cols });

  return (
    <div
      className="relative mx-auto overflow-hidden rounded-lg border border-slate-200 bg-slate-100"
      style={{ aspectRatio: String(aspect), width: `min(100%, calc(56vh * ${aspect}))` }}
    >
      {/* Skeleton while no imagery exists yet */}
      {!baseSrc && (
        <div className="absolute inset-0 bg-gradient-to-br from-slate-200 via-slate-100 to-slate-200">
          {!failed && (
            <motion.div
              className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/60 to-transparent"
              initial={{ left: '-35%' }}
              animate={{ left: '105%' }}
              transition={{ duration: 2.2, ease: 'linear', repeat: Infinity }}
            />
          )}
        </div>
      )}

      {baseSrc && (
        <motion.img
          key={baseSrc}
          src={baseSrc}
          alt=""
          draggable={false}
          onError={onBaseError}
          onLoad={(e) => onBaseSize(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25 }}
          className="absolute inset-0 h-full w-full object-fill"
          style={{ imageRendering: 'pixelated' }}
        />
      )}

      {/* Reconstructed patches: clip the sharp output over the input */}
      {outputSrc &&
        patches.map((state, i) => {
          if (state !== 'done') return null;
          const { r, c } = cell(i);
          const top = (r / rows) * 100;
          const left = (c / cols) * 100;
          const bottom = Math.max(0, 100 - ((r + 1) / rows) * 100 - 0.15);
          const right = Math.max(0, 100 - ((c + 1) / cols) * 100 - 0.15);
          return (
            <motion.img
              key={i}
              src={outputSrc}
              alt=""
              draggable={false}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.22 }}
              className="absolute inset-0 h-full w-full object-fill"
              style={{ clipPath: `inset(${top}% ${right}% ${bottom}% ${left}%)` }}
            />
          );
        })}

      {/* Patch grid */}
      <div className="pointer-events-none absolute inset-0">
        {Array.from({ length: cols - 1 }, (_, i) => (
          <div
            key={`v${i}`}
            className="absolute inset-y-0 w-px bg-white/70 shadow-[0_0_0_0.5px_rgba(15,23,42,0.22)]"
            style={{ left: pct((i + 1) / cols) }}
          />
        ))}
        {Array.from({ length: rows - 1 }, (_, i) => (
          <div
            key={`h${i}`}
            className="absolute inset-x-0 h-px bg-white/70 shadow-[0_0_0_0.5px_rgba(15,23,42,0.22)]"
            style={{ top: pct((i + 1) / rows) }}
          />
        ))}
      </div>

      {/* Active patch outline and shimmer */}
      {patches.map((state, i) => {
        if (state !== 'active') return null;
        const { r, c } = cell(i);
        return (
          <div
            key={`a${i}`}
            className="pointer-events-none absolute overflow-hidden bg-blue-500/10 shadow-[inset_0_0_0_1.5px_#2563EB]"
            style={{ left: pct(c / cols), top: pct(r / rows), width: pct(1 / cols), height: pct(1 / rows) }}
          >
            <motion.div
              className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-blue-400/40 to-transparent"
              initial={{ left: '-50%' }}
              animate={{ left: '100%' }}
              transition={{ duration: 0.8, ease: 'linear', repeat: Infinity }}
            />
          </div>
        );
      })}

      {/* Scan-line sweep while the request is in flight */}
      {waiting && !failed && (
        <motion.div
          className="pointer-events-none absolute inset-x-0 h-16 border-b border-blue-500/70 bg-gradient-to-b from-transparent to-blue-500/15"
          initial={{ top: '-4rem' }}
          animate={{ top: '100%' }}
          transition={{ duration: 2.4, ease: 'linear', repeat: Infinity }}
        />
      )}
    </div>
  );
}
