// Builds web-ready brand assets from the source logo in /logo.
// Usage: npm run brand
import fs from 'node:fs';
import sharp from 'sharp';

const SRC = 'logo/Logo without the name.png'; // triangle mark only
const LIGHT_INK = [233, 235, 238]; // replaces black in the dark-theme variant

fs.mkdirSync('public/brand', { recursive: true });
fs.mkdirSync('public/icons', { recursive: true });

/** Re-ink near-black pixels (keeping alpha) so the logo reads on dark surfaces */
async function darkVariant(input) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const max = Math.max(data[i], data[i + 1], data[i + 2]);
    const min = Math.min(data[i], data[i + 1], data[i + 2]);
    if (max < 110 && max - min < 40) {
      data[i] = LIGHT_INK[0];
      data[i + 1] = LIGHT_INK[1];
      data[i + 2] = LIGHT_INK[2];
    }
  }
  return sharp(data, { raw: info }).png().toBuffer();
}

const mark = await sharp(SRC).trim({ threshold: 1 }).png().toBuffer();

const light = await sharp(mark).resize({ width: 256 }).png({ compressionLevel: 9 }).toBuffer();
fs.writeFileSync('public/brand/mark.png', light);
fs.writeFileSync('public/brand/mark-dark.png', await darkVariant(light));
fs.writeFileSync('public/brand/logo-pdf.png', await sharp(mark).resize({ width: 240 }).flatten({ background: '#ffffff' }).png().toBuffer());

/** Square icon: mark centred on a white tile */
async function icon(size, scale, file) {
  const inner = Math.round(size * scale);
  const m = await sharp(mark).resize({ width: inner, height: inner, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: '#ffffff' } })
    .composite([{ input: m, gravity: 'centre' }])
    .png({ compressionLevel: 9 })
    .toFile(file);
}

await icon(192, 0.74, 'public/icons/icon-192.png');
await icon(512, 0.74, 'public/icons/icon-512.png');
await icon(512, 0.58, 'public/icons/maskable-512.png');
await icon(180, 0.72, 'public/apple-touch-icon.png');
await icon(64, 0.84, 'public/favicon.png');

const meta = await sharp('public/brand/logo-pdf.png').metadata();
console.log('brand assets written; pdf logo', meta.width, 'x', meta.height);
