import type * as Pdf from './pdf';

/** jsPDF is large, so the report builders load only when a PDF is actually made. */
export async function makePdf(build: (pdf: typeof Pdf) => Promise<Blob>, filename: string) {
  const pdf = await import('./pdf');
  return pdf.shareOrDownload(await build(pdf), filename);
}
