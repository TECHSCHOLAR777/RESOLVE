import {lazy, Suspense, useEffect, useState} from 'react';

type SceneProps = {reducedMotion: boolean; onReady: () => void; onError: () => void};

/** Stand-in used when the lazy chunk fails to load (offline, blocked). */
function ChunkFailed({onError}: SceneProps) {
  useEffect(onError, [onError]);
  return <></>;
}

const EarthScene = lazy(() => import('./EarthScene').catch(() => ({default: ChunkFailed})));

/** Static Earth used when WebGL or the textures are unavailable. */
function StaticEarth() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div
        className="absolute left-1/2 rounded-full"
        style={{
          width: 'max(116vw, 160vh)',
          aspectRatio: '1',
          top: '50%',
          transform: 'translateX(-50%)',
          backgroundImage: 'url(/assets/earth/earth_day_1024.jpg)',
          backgroundSize: '200% 100%',
          backgroundPosition: '66% 50%',
          boxShadow:
            'inset -90px -60px 140px rgba(2,6,16,0.85), inset 20px 20px 80px rgba(120,170,255,0.18), 0 0 120px 20px rgba(60,130,255,0.35)',
        }}
      />
    </div>
  );
}

export default function SplashGlobe({reducedMotion}: {reducedMotion: boolean}) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  if (failed) return <StaticEarth />;

  return (
    <div
      className="absolute inset-0 transition-opacity duration-1000 ease-out"
      style={{opacity: ready ? 1 : 0}}
    >
      <Suspense fallback={null}>
        <EarthScene reducedMotion={reducedMotion} onReady={() => setReady(true)} onError={() => setFailed(true)} />
      </Suspense>
    </div>
  );
}
