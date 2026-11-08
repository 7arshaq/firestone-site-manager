/**
 * Satellite picture around a point, stitched from Esri World Imagery tiles.
 * Used to show the site and to let Claude compare it with the drawings.
 */
export const SATELLITE_CREDIT = 'Imagery © Esri, Maxar, Earthstar Geographics';
const TILE = 256;
const tileUrl = (z: number, x: number, y: number) =>
  `https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;

function loadTile(url: string) {
  return new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export interface SatelliteShot {
  dataUrl: string;
  /** metres covered from left to right */
  widthMeters: number;
}

const cache = new Map<string, Promise<SatelliteShot | null>>();

export function satellite(lat: number, lng: number, zoom = 18, size = 960): Promise<SatelliteShot | null> {
  const key = `${lat.toFixed(5)},${lng.toFixed(5)},${zoom},${size}`;
  if (!cache.has(key)) cache.set(key, build(lat, lng, zoom, size));
  return cache.get(key)!;
}

async function build(lat: number, lng: number, zoom: number, size: number): Promise<SatelliteShot | null> {
  const n = 2 ** zoom;
  const rad = (lat * Math.PI) / 180;
  // centre of the site in world pixels (Web Mercator)
  const cx = ((lng + 180) / 360) * n * TILE;
  const cy = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n * TILE;
  const left = cx - size / 2;
  const top = cy - size / 2;
  const tiles: Promise<void>[] = [];
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#1b1f24';
  ctx.fillRect(0, 0, size, size);
  let loaded = 0;
  for (let tx = Math.floor(left / TILE); tx <= Math.floor((left + size) / TILE); tx++) {
    for (let ty = Math.floor(top / TILE); ty <= Math.floor((top + size) / TILE); ty++) {
      tiles.push(
        loadTile(tileUrl(zoom, ((tx % n) + n) % n, ty)).then((img) => {
          if (!img) return;
          loaded++;
          ctx.drawImage(img, tx * TILE - left, ty * TILE - top);
        }),
      );
    }
  }
  await Promise.all(tiles);
  if (!loaded) return null;

  // site marker: white-rimmed red ring at the pin
  const m = size / 2;
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(m, m, 18, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#e0352b';
  ctx.stroke();
  ctx.fillStyle = '#e0352b';
  ctx.beginPath();
  ctx.arc(m, m, 3.5, 0, Math.PI * 2);
  ctx.fill();

  const metersPerPixel = (156543.03392 * Math.cos(rad)) / n;
  return { dataUrl: canvas.toDataURL('image/jpeg', 0.86), widthMeters: Math.round(metersPerPixel * size) };
}

export const googleMapsLink = (lat: number, lng: number) =>
  `https://www.google.com/maps/@?api=1&map_action=map&center=${lat},${lng}&zoom=18&basemap=satellite`;
