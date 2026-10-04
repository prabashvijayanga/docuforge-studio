export type ToolMode =
  | "organize"
  | "img2pdf"
  | "merge"
  | "compress"
  | "convert";

export type ConvertTargetFormat =
  | "docx"
  | "pptx"
  | "xlsx"
  | "png_zip"
  | "html"
  | "md"
  | "txt";

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
  convertFormat: ConvertTargetFormat;
  imageDpi: number;
}