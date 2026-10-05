import {useEffect, useRef, useState} from 'react';
import createGlobe from 'cobe';

const MARKERS: [number, number][] = [
  [30.8, 75.75], // Ludhiana
  [28.62, 77.21], // Delhi
  [26.95, 94.2], // Majuli
  [27.33, 88.61], // Gangtok
  [19.03, 72.84], // Mumbai
  [9.55, 76.4], // Alappuzha
  [26.3, 73.02], // Jodhpur
  [12.97, 77.59], // Bengaluru
  [22.57, 88.36], // Kolkata
];

// Initial rotation so India (~79 E) faces the viewer.
const INDIA_PHI = (194 * Math.PI) / 180;
const THETA = -0.1;

const STATIC_MARKERS: [number, number][] = [
  [215, 150],
  [225, 160],
  [262, 165],
  [245, 158],
  [205, 190],
  [210, 235],
  [212, 170],
];

function StaticGlobe() {
  return (
    <svg viewBox="0 0 400 400" className="w-full h-full" aria-hidden="true">
      <defs>
        <radialGradient id="sg-body" cx="38%" cy="35%" r="75%">
          <stop offset="0" stopColor="#1b3a6b" />
          <stop offset="0.6" stopColor="#0b1a36" />
          <stop offset="1" stopColor="#050b18" />
        </radialGradient>
        <radialGradient id="sg-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0.82" stopColor="#3b82f6" stopOpacity="0.35" />
          <stop offset="1" stopColor="#3b82f6" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="200" cy="200" r="198" fill="url(#sg-glow)" />
      <circle cx="200" cy="200" r="160" fill="url(#sg-body)" stroke="#3b82f6" strokeOpacity="0.35" />
      <g fill="none" stroke="#5b8cd6" strokeOpacity="0.18">
        <ellipse cx="200" cy="200" rx="160" ry="55" />
        <ellipse cx="200" cy="200" rx="160" ry="110" />
        <ellipse cx="200" cy="200" rx="55" ry="160" />
        <ellipse cx="200" cy="200" rx="110" ry="160" />
        <line x1="40" y1="200" x2="360" y2="200" />
        <line x1="200" y1="40" x2="200" y2="360" />
      </g>
      <g fill="#60a5fa">
        {STATIC_MARKERS.map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="3.5" />
        ))}
      </g>
    </svg>
  );
}

export default function SplashGlobe({reducedMotion}: {reducedMotion: boolean}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    let globe: ReturnType<typeof createGlobe> | null = null;
    let raf = 0;
    let phi = INDIA_PHI;
    let last = performance.now();
    let size = 0;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const build = () => {
      const w = Math.round(wrap.clientWidth);
      if (!w || w === size) return;
      size = w;
      globe?.destroy();
      globe = createGlobe(canvas, {
        devicePixelRatio: dpr,
        width: w * dpr,
        height: w * dpr,
        phi,
        theta: THETA,
        dark: 1,
        diffuse: 1.2,
        mapSamples: 16000,
        mapBrightness: 8,
        baseColor: [0.07, 0.12, 0.24],
        markerColor: [0.35, 0.65, 1],
        glowColor: [0.12, 0.28, 0.6],
        markers: MARKERS.map((location) => ({location, size: 0.03})),
      });
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(now - last, 100);
      last = now;
      phi += dt * 0.00018;
      globe?.update({phi});
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };
    const start = () => {
      if (raf || reducedMotion) return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };
    const onVisibility = () => (document.hidden ? stop() : start());

    let ro: ResizeObserver | null = null;
    try {
      build();
      if (!globe) throw new Error('no globe');
      ro = new ResizeObserver(build);
      ro.observe(wrap);
      document.addEventListener('visibilitychange', onVisibility);
      start();
    } catch {
      setFailed(true);
    }

    return () => {
      stop();
      ro?.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      globe?.destroy();
    };
  }, [reducedMotion]);

  return (
    <div ref={wrapRef} className="w-full h-full">
      {failed ? <StaticGlobe /> : <canvas ref={canvasRef} style={{width: '100%', height: '100%'}} />}
    </div>
  );
}
