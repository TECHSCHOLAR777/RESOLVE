import {useEffect, useState, type ReactNode} from 'react';
import {health} from '../../api';
import Splash from './Splash';

/** The splash is part of the experience, so every full page load shows it for at least this long. */
const MIN_MS = 4000;
/** Never hold the app longer than this, even if the backend is still waking up. */
const MAX_MS = 8000;

/**
 * Renders children immediately and overlays the splash on every full page load.
 * It closes once MIN_MS has passed and the backend health check has settled, capped at MAX_MS.
 * Mounted once at boot, so in-app navigation never shows it again.
 */
export default function SplashGate({children}: {children: ReactNode}) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let minElapsed = false;
    let healthSettled = false;
    const close = () => setVisible(false);
    const maybeClose = () => {
      if (minElapsed && healthSettled) close();
    };

    const timers = [
      window.setTimeout(() => {
        minElapsed = true;
        maybeClose();
      }, MIN_MS),
      window.setTimeout(close, MAX_MS),
    ];

    health()
      .catch(() => {})
      .finally(() => {
        healthSettled = true;
        maybeClose();
      });

    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <>
      {children}
      <Splash visible={visible} />
    </>
  );
}
