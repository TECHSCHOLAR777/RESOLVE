import {AnimatePresence, motion, useReducedMotion} from 'motion/react';
import SplashGlobe from './SplashGlobe';

const STARS = Array.from({length: 70}, (_, i) => {
  const r = (n: number) => {
    const x = Math.sin(i * 9301 + n * 49297) * 233280;
    return x - Math.floor(x);
  };
  return {x: r(1) * 100, y: r(2) * 100, s: 0.6 + r(3) * 1.4, o: 0.15 + r(4) * 0.5};
});

function Dot({index, still}: {index: number; still: boolean}) {
  return (
    <motion.span
      className="block w-1.5 h-1.5 rounded-full bg-sky-300"
      initial={{opacity: still ? 0.7 : 0.25, scale: 1}}
      animate={still ? undefined : {opacity: [0.25, 1, 0.25], scale: [0.8, 1.3, 0.8]}}
      transition={{duration: 1.2, repeat: Infinity, ease: 'easeInOut', delay: index * 0.2}}
    />
  );
}

export default function Splash({visible}: {visible: boolean}) {
  const reduced = !!useReducedMotion();

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="splash"
          role="status"
          aria-label="Loading RESOLVE"
          className="fixed inset-0 z-[9999] overflow-hidden flex flex-col items-center justify-center"
          style={{background: 'radial-gradient(ellipse at 50% 40%, #0b1730 0%, #050a17 55%, #02050d 100%)'}}
          initial={{opacity: 1}}
          exit={{opacity: 0, scale: reduced ? 1 : 1.04}}
          transition={{duration: 0.4, ease: 'easeOut'}}
        >
          <svg className="absolute inset-0 w-full h-full" aria-hidden="true">
            {STARS.map((s, i) => (
              <circle key={i} cx={`${s.x}%`} cy={`${s.y}%`} r={s.s} fill="#cfe0ff" opacity={s.o} />
            ))}
          </svg>

          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 aspect-square w-[150vw] sm:w-[min(105vmin,1000px)]"
            style={{opacity: 0.9}}
          >
            <SplashGlobe reducedMotion={reduced} />
          </div>
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'radial-gradient(ellipse 38% 34% at 50% 50%, rgba(3,7,16,0.6) 0%, rgba(3,7,16,0.3) 55%, transparent 100%)',
            }}
          />

          <motion.div
            className="relative flex flex-col items-center px-6 text-center"
            initial={{opacity: 0, y: reduced ? 0 : 8}}
            animate={{opacity: 1, y: 0}}
            transition={{duration: 0.7, ease: 'easeOut'}}
          >
            <img
              src="/assets/logo_earth.png"
              alt=""
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover mb-5 ring-1 ring-sky-400/30 shadow-[0_0_40px_rgba(56,130,246,0.35)]"
              draggable={false}
            />
            <h1 className="font-display font-bold text-4xl sm:text-6xl tracking-[0.28em] pl-[0.28em] text-white">
              RESOLVE
            </h1>
            <p className="mt-3 text-xs sm:text-sm tracking-[0.12em] text-sky-100/70 max-w-[16rem] text-balance sm:max-w-none">
              Satellite Super-Resolution for Sharper Earth Insights
            </p>
            <div className="mt-8 flex gap-2.5" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <Dot key={i} index={i} still={reduced} />
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
