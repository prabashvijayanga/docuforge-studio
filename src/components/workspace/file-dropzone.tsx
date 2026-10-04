"use client";
import React, { useRef, useState } from "react";
import { Upload, FileUp, ArrowRightLeft } from "lucide-react";
import { ConvertDirection, ToolMode } from "@/types/document";

interface FileDropzoneProps {
  mode: ToolMode;
  convertDirection?: ConvertDirection;
  onToggleConvertDirection?: (dir: ConvertDirection) => void;
  onFilesSelected: (files: File[]) => void;
}

export function FileDropzone({
  mode,
  convertDirection = "pdf_to_other",
  onToggleConvertDirection,
  onFilesSelected,
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);

  const isMulti = mode === "img2pdf" || mode === "merge";
  const isReverseConvert = mode === "convert" && convertDirection === "other_to_pdf";

  const acceptMime =
    mode === "img2pdf"
      ? "image/jpeg,image/png,image/webp"
      : isReverseConvert
      ? ".docx,.pptx,.xlsx,.md,.html,.htm,.txt,.csv"
      : "application/pdf";

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFilesSelected(Array.from(e.dataTransfer.files));
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8">
      {/* Bi-Directional Switcher Pill when inside Convert Mode */}
      {mode === "convert" && onToggleConvertDirection && (
        <div className="mb-5 inline-flex bg-white p-1 rounded-xl border border-zinc-200 shadow-xs">
          <button
            type="button"
            onClick={() => onToggleConvertDirection("pdf_to_other")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              convertDirection === "pdf_to_other"
                ? "bg-zinc-900 text-white"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            <span>PDF → Office / Text (7 Formats)</span>
          </button>
          <button
            type="button"
            onClick={() => onToggleConvertDirection("other_to_pdf")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              convertDirection === "other_to_pdf"
                ? "bg-zinc-900 text-white"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>Office / Text → PDF (Reverse)</span>
          </button>
        </div>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`w-full max-w-2xl bg-white border-2 border-dashed rounded-xl p-6 sm:p-12 text-center cursor-pointer transition-all ${
          dragging ? "border-zinc-900 bg-zinc-50" : "border-zinc-300 hover:border-zinc-400"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple={isMulti}
          accept={acceptMime}
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              onFilesSelected(Array.from(e.target.files));
            }
          }}
        />

        <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-lg bg-zinc-100 border border-zinc-200 flex items-center justify-center mx-auto mb-4 text-zinc-700">
          {isMulti ? <FileUp className="w-5 h-5" /> : <Upload className="w-5 h-5" />}
        </div>

        <h2 className="text-sm sm:text-base font-semibold text-zinc-900 tracking-tight mb-1">
          {mode === "img2pdf"
            ? "Drop images here to compile into PDF"
            : mode === "merge"
            ? "Select multiple PDF files to combine"
            : isReverseConvert
            ? "Drop Word (.DOCX), PowerPoint (.PPTX), Excel (.XLSX), MD, HTML, or TXT to convert into PDF"
            : "Drop a PDF document here to open studio"}
        </h2>
        <p className="text-xs text-zinc-500 mb-6">
          Tap to browse device storage or drag files directly into the workspace
        </p>

        <span className="inline-flex items-center px-4 py-2 rounded-md text-xs font-medium bg-zinc-900 text-white">
          Select {isMulti ? "Files" : isReverseConvert ? "Office / Text File" : "PDF Document"}
        </span>

        <div className="mt-6 sm:mt-8 pt-4 border-t border-zinc-100 flex flex-wrap items-center justify-center gap-2 sm:gap-6 font-mono text-[10px] sm:text-[11px] text-zinc-400">
          <span>
            FORMAT:{" "}
            {mode === "img2pdf"
              ? "JPG / PNG / WEBP"
              : isReverseConvert
              ? "DOCX / PPTX / XLSX / MD / HTML / TXT"
              : "PDF 1.4 - 2.0"}
          </span>
          <span className="hidden sm:inline">•</span>
          <span>MEMORY: ZERO-STORAGE STREAM</span>
        </div>
      </div>
    </div>
  );
}