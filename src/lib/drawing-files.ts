import { PRICE } from './ai';

export type DrawingKind = 'pdf' | 'image' | 'dwg' | 'other';

export interface PickedDrawing {
  id: string;
  file: File;
  kind: DrawingKind;
  pages: number;
  thumb: string | null;
  error?: string;
}

/** Above this a PDF is sent as page pictures instead of the PDF itself (requests are capped at 32 MB) */
export const PDF_INLINE_LIMIT = 20 * 1024 * 1024;
/** Most pages sent as pictures from one oversized PDF */
export const MAX_RASTER_PAGES = 40;

export function kindOf(file: File): DrawingKind {
  const name = file.name.toLowerCase();
  if (file.type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (file.type.startsWith('image/') || /\.(jpe?g|png|webp|heic)$/.test(name)) return 'image';
  if (/\.(dwg|dxf|dwf)$/.test(name)) return 'dwg';
  return 'other';
}

async function pdfjs() {
  const lib = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  lib.GlobalWorkerOptions.workerSrc = worker.default;
  return lib;
}

/** Opens a PDF; call close() when done to free the worker */
async function openPdf(file: File) {
  const lib = await pdfjs();
  const task = lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const doc = await task.promise;
  return Object.assign(doc, { close: () => task.destroy() });
}

async function renderPage(doc: Awaited<ReturnType<typeof openPdf>>, n: number, longEdge: number, quality: number) {
  const page = await doc.getPage(n);
  const base = page.getViewport({ scale: 1 });
  const scale = longEdge / Math.max(base.width, base.height);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, canvasContext: ctx, viewport }).promise;
  return canvas.toDataURL('image/jpeg', quality);
}

/** Page count and a small preview of the first page */
export async function inspect(file: File, id: string): Promise<PickedDrawing> {
  const kind = kindOf(file);
  const base: PickedDrawing = { id, file, kind, pages: kind === 'image' ? 1 : 0, thumb: null };
  try {
    if (kind === 'pdf') {
      const doc = await openPdf(file);
      const thumb = await renderPage(doc, 1, 260, 0.7);
      const pages = doc.numPages;
      await doc.close();
      return { ...base, pages, thumb };
    }
    if (kind === 'image') return { ...base, thumb: URL.createObjectURL(file) };
    if (kind === 'dwg') return { ...base, error: 'AutoCAD files can’t be read in a browser. In AutoCAD, use Plot → “DWG To PDF”, then add the PDF.' };
    return { ...base, error: 'Only PDF drawings and photos (JPG, PNG) can be read.' };
  } catch {
    return { ...base, error: 'This file could not be opened. Is it a damaged or password-protected PDF?' };
  }
}

const toBase64 = (dataUrl: string) => dataUrl.slice(dataUrl.indexOf(',') + 1);

/** A photo or scan, resized so Claude can read it (≤ 2000 px, JPEG) */
export async function imageForClaude(file: File) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return toBase64(canvas.toDataURL('image/jpeg', 0.85));
}

/** An oversized PDF as page pictures (first MAX_RASTER_PAGES pages) */
export async function pdfAsImages(file: File) {
  const doc = await openPdf(file);
  const count = Math.min(doc.numPages, MAX_RASTER_PAGES);
  const pages: string[] = [];
  for (let n = 1; n <= count; n++) pages.push(toBase64(await renderPage(doc, n, 2000, 0.82)));
  const total = doc.numPages;
  await doc.close();
  return { pages, total };
}

export const pdfBase64 = async (file: File) => {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};

/** Rough cost before reading: ~3,000 tokens per drawing page, ~1,600 per photo, plus Claude's answer */
export function estimate(list: PickedDrawing[]) {
  const usable = list.filter((d) => !d.error && (d.kind === 'pdf' || d.kind === 'image'));
  const pdfPages = usable.filter((d) => d.kind === 'pdf').reduce((a, d) => a + Math.min(d.pages, d.file.size > PDF_INLINE_LIMIT ? MAX_RASTER_PAGES : d.pages), 0);
  const images = usable.filter((d) => d.kind === 'image').length;
  const input = pdfPages * 3000 + images * 1600 + 6000;
  const output = 12000;
  const dollars = (input * PRICE.input + output * PRICE.output) / 1e6;
  return { pages: pdfPages + images, dollars };
}

/**
 * Marked-up sheets for reading highlights: each page as a picture with digital highlights drawn on
 * (annotations are rendered), plus the sheet's own text so the floor and legend can be read.
 */
export async function markupPages(file: File, max: number) {
  const doc = await openPdf(file);
  const count = Math.min(doc.numPages, max);
  const pages: { image: string; text: string }[] = [];
  for (let n = 1; n <= count; n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    const text = content.items
      .map((i) => ('str' in i ? i.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 1500);
    pages.push({ image: toBase64(await renderPage(doc, n, 2000, 0.85)), text });
  }
  const total = doc.numPages;
  await doc.close();
  return { pages, total };
}
