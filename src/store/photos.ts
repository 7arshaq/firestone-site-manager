import { createStore, del, get, set, delMany } from 'idb-keyval';

const photoStore = createStore('riser-photos', 'blobs');

export const savePhotoBlobs = async (id: string, full: Blob, thumb: Blob) => {
  await set(`full:${id}`, full, photoStore);
  await set(`thumb:${id}`, thumb, photoStore);
};

export const getPhotoBlob = (id: string, size: 'full' | 'thumb' = 'thumb') =>
  get<Blob>(`${size}:${id}`, photoStore);

export const deletePhotoBlobs = async (id: string) => {
  await del(`full:${id}`, photoStore);
  await del(`thumb:${id}`, photoStore);
};

export const deleteManyPhotoBlobs = (ids: string[]) =>
  delMany(ids.flatMap((id) => [`full:${id}`, `thumb:${id}`]), photoStore);

/** Resize an image file to a JPEG no larger than `max` px on the long edge */
async function resize(file: Blob, max: number, quality: number) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const blob = await new Promise<Blob>((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error('Could not compress photo'))), 'image/jpeg', quality),
  );
  return { blob, width: w, height: h };
}

export async function processPhoto(file: File) {
  const full = await resize(file, 1600, 0.8);
  const thumb = await resize(file, 420, 0.72);
  return { full: full.blob, thumb: thumb.blob, width: full.width, height: full.height };
}

export function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(blob);
  });
}

export async function dataURLToBlob(url: string) {
  const res = await fetch(url);
  return res.blob();
}
