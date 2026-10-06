export const PIXEL_M = 10;
export type SizePx = 256 | 512;

export interface LatLon {
  lat: number;
  lon: number;
}

/** Metres per degree of latitude / longitude at a latitude (WGS84 series). */
export function metresPerDegree(lat: number): { lat: number; lon: number } {
  const p = (lat * Math.PI) / 180;
  return {
    lat: 111132.92 - 559.82 * Math.cos(2 * p) + 1.175 * Math.cos(4 * p),
    lon: 111412.84 * Math.cos(p) - 93.5 * Math.cos(3 * p) + 0.118 * Math.cos(5 * p),
  };
}

export function sideMetres(size: SizePx): number {
  return size * PIXEL_M;
}

export function sideKm(size: SizePx): string {
  return (sideMetres(size) / 1000).toFixed(2);
}

/** South, west, north, east of a square of `size` px at 10 m centred on the point. */
export function squareBounds(c: LatLon, size: SizePx): [[number, number], [number, number]] {
  const half = sideMetres(size) / 2;
  const m = metresPerDegree(c.lat);
  const dLat = half / m.lat;
  const dLon = half / Math.max(m.lon, 1);
  return [
    [c.lat - dLat, c.lon - dLon],
    [c.lat + dLat, c.lon + dLon],
  ];
}

export function clampLat(lat: number): number {
  return Math.max(-80, Math.min(80, lat));
}

export function wrapLon(lon: number): number {
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}

export function fmtCoord(v: number, pos: string, neg: string): string {
  return `${Math.abs(v).toFixed(4)}° ${v >= 0 ? pos : neg}`;
}

export function fmtCentre(c: LatLon): string {
  return `${fmtCoord(c.lat, 'N', 'S')}, ${fmtCoord(c.lon, 'E', 'W')}`;
}

/** "28.61, 77.21" (optionally with N/S/E/W or degree signs) -> point, else null. */
export function parseCoords(q: string): LatLon | null {
  const m = q
    .trim()
    .replace(/°/g, '')
    .match(/^(-?\d+(?:\.\d+)?)\s*([NS])?\s*[,;\s]\s*(-?\d+(?:\.\d+)?)\s*([EW])?$/i);
  if (!m) return null;
  let lat = parseFloat(m[1]);
  let lon = parseFloat(m[3]);
  if (m[2]?.toUpperCase() === 'S') lat = -Math.abs(lat);
  if (m[4]?.toUpperCase() === 'W') lon = -Math.abs(lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon };
}
