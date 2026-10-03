export type ToolMode =
  | "organize"
  | "img2pdf"
  | "merge"
  | "compress"
  | "convert";

export interface PDFPageItem {
  id: string;
  originalIndex: number; 
  pageNumber: number;
  rotation: number;
  thumbnailDataUrl: string;
  width: number;
  height: number;
  isCustomNote?: boolean;
  noteTitle?: string;
  noteText?: string;
}

export interface InspectorSettings {
  watermarkText: string;
  compressLevel: "light" | "recommended" | "extreme";
  pageSize: "A4" | "FIT";
  pageMargin: number;
  convertFormat: "docx" | "png_zip";
  imageDpi: number;
}