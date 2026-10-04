export type ToolMode =
  | "organize"
  | "img2pdf"
  | "merge"
  | "compress"
  | "convert"
  | "study";

export type ConvertDirection = "pdf_to_other" | "other_to_pdf";

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
  convertDirection: ConvertDirection;
  convertFormat: ConvertTargetFormat;
  imageDpi: number;
}

export interface StudyQuizQuestion {
  id: number;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  sourcePage: number;
}

export interface StudyPackResponse {
  documentTitle: string;
  pageCount: number;
  wordCount: number;
  readingTimeMinutes: number;
  keyTopics: string[];
  definitions: { term: string; meaning: string; page: number }[];
  sections: { heading: string; bullets: string[]; page: number }[];
  quiz: StudyQuizQuestion[];
}