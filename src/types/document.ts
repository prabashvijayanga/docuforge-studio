export type ToolMode = "organize" | "img2pdf" | "merge" | "compress" | "convert";

export interface PDFPageItem {
  id: string;
  originalIndex: number;
  pageNumber: number;
  thumbnailDataUrl: string;
  rotation: number;
  width: number;
  height: number;
}

export interface InspectorSettings {
  watermarkText: string;
  compressLevel: "light" | "recommended" | "extreme";
  pageSize: "A4" | "FIT";
  pageMargin: number;
  convertFormat: "docx" | "png_zip";
  imageDpi: number;
}