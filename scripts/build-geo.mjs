// One-off: builds src/data/uae-map.geojson from geoBoundaries (emirates) + world-atlas (neighbours).
// Usage: node scripts/build-geo.mjs <ARE-ADM1_simplified.geojson> <ARE-ADM0_simplified.geojson>
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { feature } from 'topojson-client';

const require = createRequire(import.meta.url);
const src = process.argv[2];
const adm1 = JSON.parse(fs.readFileSync(src, 'utf8'));
const adm0 = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
const world = require('world-atlas/countries-10m.json');

const round = (n, p = 4) => Math.round(n * 10 ** p) / 10 ** p;
const ringArea = (r) => {
  let a = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] - r[i][0]) * (r[j][1] + r[i][1]);
  return Math.abs(a / 2);
};
const MIN_AREA = 0.00003; // ~0.35 km² — drops sandbars, keeps inhabited islands
const dedupe = (ring) => {
  const out = [];
  for (const [x, y] of ring) {
    const pt = [round(x), round(y)];
    const last = out[out.length - 1];
    if (!last || last[0] !== pt[0] || last[1] !== pt[1]) out.push(pt);
  }
  return out;
};
// d3-geo wants exterior rings clockwise (holes counter-clockwise); RFC 7946 sources are the opposite.
const signed = (r) => {
  let a = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] - r[i][0]) * (r[j][1] + r[i][1]);
  return a / 2; // > 0 means counter-clockwise with y pointing up
};
const rewind = (poly) => poly.map((ring, i) => {
  const cw = signed(ring) < 0;
  return (i === 0 ? cw : !cw) ? ring : [...ring].reverse();
});
const cleanPolys = (geom, minArea) => {
  const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
  const kept = polys
    .filter((p) => ringArea(p[0]) >= minArea)
    .map((p) => rewind(p.filter((r, i) => i === 0 || ringArea(r) >= minArea).map(dedupe)));
  return { type: 'MultiPolygon', coordinates: kept };
};

const names = {
  'Abu Dhabi': 'Abu Dhabi', Ajman: 'Ajman', Dubai: 'Dubai', Fujairah: 'Fujairah',
  'Ras al-Khaimah': 'Ras Al Khaimah', Sharjah: 'Sharjah', 'Umm al-Quwain': 'Umm Al Quwain',
};
const emirates = adm1.features.map((f) => ({
  type: 'Feature',
  properties: { name: names[f.properties.shapeName] ?? f.properties.shapeName },
  geometry: cleanPolys(f.geometry, MIN_AREA),
}));

const countries = feature(world, world.objects.countries);
const wanted = { 512: 'Oman', 682: 'Saudi Arabia', 634: 'Qatar' };
const bbox = [49.5, 21.3, 58.5, 27.6];
const clipRing = (r) => r.some(([x, y]) => x >= bbox[0] && x <= bbox[2] && y >= bbox[1] && y <= bbox[3]);
const neighbours = countries.features
  .filter((f) => wanted[Number(f.id)])
  .map((f) => {
    const g = cleanPolys(f.geometry, 0.0005);
    g.coordinates = g.coordinates.filter((p) => clipRing(p[0]));
    return { type: 'Feature', properties: { name: wanted[Number(f.id)] }, geometry: g };
  })
  .filter((f) => f.geometry.coordinates.length);

const country = { type: 'Feature', properties: { name: 'United Arab Emirates' }, geometry: cleanPolys(adm0.features[0].geometry, MIN_AREA) };
const out = { country, emirates: { type: 'FeatureCollection', features: emirates }, neighbours: { type: 'FeatureCollection', features: neighbours } };
fs.writeFileSync(new URL('../src/data/uae-map.geojson', import.meta.url), JSON.stringify(out));
console.log('emirates', emirates.map((e) => `${e.properties.name}:${e.geometry.coordinates.length}`).join(' '));
console.log('neighbours', neighbours.map((e) => e.properties.name).join(' '));
console.log('bytes', fs.statSync(new URL('../src/data/uae-map.geojson', import.meta.url)).size);
