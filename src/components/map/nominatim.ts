const BASE = 'https://nominatim.openstreetmap.org';

export interface Place {
  id: string;
  /** Short label: the place itself. */
  name: string;
  /** Context line: region and country. */
  context: string;
  /** Human readable kind, e.g. "City". */
  kind: string;
  lat: number;
  lon: number;
  /** [south, west, north, east] */
  bbox: [number, number, number, number] | null;
}

interface RawPlace {
  place_id: number;
  osm_type?: string;
  osm_id?: number;
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
  type?: string;
  addresstype?: string;
  category?: string;
  boundingbox?: string[];
}

function titleCase(s: string): string {
  const t = s.replace(/_/g, ' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function toPlace(r: RawPlace): Place {
  const parts = r.display_name.split(',').map((p) => p.trim());
  const bb = r.boundingbox?.map(Number);
  return {
    id: `${r.osm_type ?? 'p'}${r.osm_id ?? r.place_id}`,
    name: r.name || parts[0] || r.display_name,
    context: parts.slice(1).join(', '),
    kind: titleCase(r.addresstype || r.type || r.category || 'place'),
    lat: parseFloat(r.lat),
    lon: parseFloat(r.lon),
    // Nominatim order is [south, north, west, east].
    bbox: bb && bb.length === 4 && bb.every(Number.isFinite) ? [bb[0], bb[2], bb[1], bb[3]] : null,
  };
}

export async function searchPlaces(q: string, signal: AbortSignal): Promise<Place[]> {
  const res = await fetch(`${BASE}/search?format=jsonv2&limit=6&q=${encodeURIComponent(q)}`, { signal });
  if (!res.ok) throw new Error(res.status === 429 ? 'Search is rate limited, try again in a moment' : `Search failed (${res.status})`);
  const data = (await res.json()) as RawPlace[];
  const seen = new Set<string>();
  return data
    .map(toPlace)
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon))
    .filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));
}

/** Short place name for a point, or null when nothing useful is there (open sea, desert). */
export async function reversePlace(lat: number, lon: number, signal: AbortSignal): Promise<string | null> {
  const res = await fetch(`${BASE}/reverse?format=jsonv2&zoom=14&lat=${lat.toFixed(6)}&lon=${lon.toFixed(6)}`, { signal });
  if (!res.ok) throw new Error(`Reverse geocoding failed (${res.status})`);
  const d = (await res.json()) as { error?: string; name?: string; display_name?: string; address?: Record<string, string> };
  if (d.error || !d.display_name) return null;
  const a = d.address ?? {};
  const local = a.suburb || a.neighbourhood || a.village || a.hamlet || a.town || d.name;
  const city = a.city || a.town || a.county || a.state_district || a.state;
  const parts = [local, city && city !== local ? city : null].filter(Boolean) as string[];
  if (parts.length === 0) return d.display_name.split(',').slice(0, 2).join(',').trim();
  return parts.join(', ');
}
