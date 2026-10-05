import { useEffect, useState } from 'react';

export type Layout = 'mobile' | 'laptop' | 'desktop';

function read(): Layout {
  if (typeof window === 'undefined') return 'desktop';
  if (window.matchMedia('(min-width: 1280px)').matches) return 'desktop';
  if (window.matchMedia('(min-width: 1024px)').matches) return 'laptop';
  return 'mobile';
}

/** mobile < 1024 (tabs), laptop 1024-1279 (two columns + drawer), desktop >= 1280 (three panels). */
export function useLayout(): Layout {
  const [layout, setLayout] = useState<Layout>(read);
  useEffect(() => {
    const queries = [window.matchMedia('(min-width: 1280px)'), window.matchMedia('(min-width: 1024px)')];
    const update = () => setLayout(read());
    queries.forEach((q) => q.addEventListener('change', update));
    return () => queries.forEach((q) => q.removeEventListener('change', update));
  }, []);
  return layout;
}

export function useIsPhone(): boolean {
  const [phone, setPhone] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches);
  useEffect(() => {
    const q = window.matchMedia('(max-width: 639px)');
    const update = () => setPhone(q.matches);
    q.addEventListener('change', update);
    return () => q.removeEventListener('change', update);
  }, []);
  return phone;
}
