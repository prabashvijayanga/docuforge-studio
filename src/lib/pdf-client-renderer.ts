import { PDFPageItem } from "@/types/document";

export async function renderPdfPagesToThumbnails(file: File): Promise<PDFPageItem[]> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages: PDFPageItem[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 0.45 });

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    if (ctx) {
      await page.render({ canvasContext: ctx, viewport }).promise;
    }

    pages.push({
      id: `page-${i}-${ Math.random().toString(36).substring(2, 7)}`,
      originalIndex: i - 1,
      pageNumber: i,
      thumbnailDataUrl: canvas.toDataURL("image/jpeg", 0.8),
      rotation: 0,
      width: Math.round(viewport.width),
      height: Math.round(viewport.height),
    });
  }

  return pages;
}