import {useEffect, useState, type ReactNode} from 'react';
import {health} from '../../api';
import Splash from './Splash';

const FLAG = 'resolve:splash-seen';
const MAX_MS = 8000;
const FIRST_MIN_MS = 1500;
const WARM_MIN_MS = 1000;
const COLD_THRESHOLD_MS = 300;

function seen(): boolean {
  try {
    return sessionStorage.getItem(FLAG) === '1';
  } catch {
    return false;
  }
}

function markSeen() {
  try {
    sessionStorage.setItem(FLAG, '1');
  } catch {
    // storage unavailable: splash may show again, harmless
  }
}

/** Renders children immediately and overlays the splash per the show rule. */
export default function SplashGate({children}: {children: ReactNode}) {
  const [visible, setVisible] = useState(() => !seen());

  useEffect(() => {
    const timers: number[] = [];
    let healthy = false;
    let closed = false;
    let shownAt = visible ? performance.now() : 0;
    let minMs = FIRST_MIN_MS;

    const close = () => {
      if (closed) return;
      closed = true;
      markSeen();
      setVisible(false);
    };

    if (visible) {
      timers.push(window.setTimeout(close, MAX_MS));
    } else {
      // Flag present: only show if the backend is slow to answer (cold start).
      timers.push(
        window.setTimeout(() => {
          if (healthy || closed) return;
          shownAt = performance.now();
          minMs = WARM_MIN_MS;
          setVisible(true);
          timers.push(window.setTimeout(close, MAX_MS));
        }, COLD_THRESHOLD_MS),
      );
    }

    health()
      .then(() => {
        healthy = true;
        if (shownAt) {
          const wait = Math.max(0, minMs - (performance.now() - shownAt));
          timers.push(window.setTimeout(close, wait));
        }
      })
      .catch(() => {});

    return () => timers.forEach(clearTimeout);
    // runs once at boot
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {children}
      <Splash visible={visible} />
    </>
  );
}
