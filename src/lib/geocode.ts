/** Street address for a pin, from OpenStreetMap's free Nominatim service (one lookup per pin). */
export interface Place {
  label: string;
  area: string;
  emirate: string;
}

const cache = new Map<string, Promise<Place | null>>();

export function reverseGeocode(lat: number, lng: number): Promise<Place | null> {
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  if (!cache.has(key)) {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=17&accept-language=en`;
    cache.set(
      key,
      fetch(url)
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          if (!j?.address) return null;
          const a = j.address as Record<string, string>;
          const area = a.neighbourhood || a.suburb || a.quarter || a.city_district || a.industrial || a.village || a.town || '';
          const emirate = (a.state || a.city || '').replace(/ Emirate$/i, '');
          return { label: j.display_name as string, area, emirate };
        })
        .catch(() => null),
    );
  }
  return cache.get(key)!;
}

/**
 * Finds an address or place name (e.g. from a drawing's title block) inside the UAE.
 * Plot numbers are rarely known to OpenStreetMap, so it retries with less detail:
 * "Plot ME-11, Musaffah, Abu Dhabi" → "Musaffah, Abu Dhabi".
 */
export async function findPlace(query: string): Promise<{ lat: number; lng: number; label: string } | null> {
  const parts = query.split(',').map((p) => p.trim()).filter(Boolean);
  const tries = parts.map((_, i) => parts.slice(i).join(', ')).filter((q) => q.length > 3).slice(0, 3);
  for (let i = 0; i < tries.length; i++) {
    if (i) await new Promise((r) => setTimeout(r, 1100)); // Nominatim allows one request per second
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=ae&accept-language=en&q=${encodeURIComponent(tries[i])}`;
    try {
      const r = await fetch(url);
      if (!r.ok) continue;
      const [hit] = (await r.json()) as { lat: string; lon: string; display_name: string }[];
      if (hit) return { lat: Math.round(+hit.lat * 1e5) / 1e5, lng: Math.round(+hit.lon * 1e5) / 1e5, label: hit.display_name };
    } catch {
      /* try the next, shorter query */
    }
  }
  return null;
}
