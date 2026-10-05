const rtf = typeof Intl !== 'undefined' && 'RelativeTimeFormat' in Intl ? new Intl.RelativeTimeFormat('en', { numeric: 'auto' }) : null;

export function relativeTime(iso: string, now = Date.now()): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const sec = Math.round((t - now) / 1000);
  const abs = Math.abs(sec);
  if (abs < 45) return 'just now';
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['minute', 60],
    ['hour', 3600],
    ['day', 86400],
    ['week', 604800],
    ['month', 2592000],
    ['year', 31536000],
  ];
  let unit: Intl.RelativeTimeFormatUnit = 'minute';
  let size = 60;
  for (const [u, s] of units) {
    if (abs >= s) {
      unit = u;
      size = s;
    }
  }
  const value = Math.round(sec / size);
  return rtf ? rtf.format(value, unit) : `${Math.abs(value)} ${unit}s ago`;
}
