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
          className="fixed inset-0 z-[9999] overflow-hidden flex flex-col items-center justify-start pt-[14vh] sm:pt-[12vh]"
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

          <div className="absolute inset-0">
            <SplashGlobe reducedMotion={reduced} />
          </div>
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'linear-gradient(to bottom, rgba(2,5,13,0.78) 0%, rgba(2,5,13,0.45) 32%, rgba(2,5,13,0) 55%), radial-gradient(ellipse 120% 70% at 50% 120%, transparent 55%, rgba(2,5,13,0.55) 100%)',
            }}
          />

          <motion.div
            className="relative flex flex-col items-center px-6 text-center"
            initial={{opacity: 0, y: reduced ? 0 : 8}}
            animate={{opacity: 1, y: 0}}
            transition={{duration: 0.7, ease: 'easeOut'}}
          >
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
