"use client";
import React, { useRef, useState } from "react";
import { Upload, FileUp } from "lucide-react";
import { ToolMode } from "@/types/document";

interface FileDropzoneProps {
  mode: ToolMode;
  onFilesSelected: (files: File[]) => void;
}

export function FileDropzone({ mode, onFilesSelected }: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);

  const isMulti = mode === "img2pdf" || mode === "merge";
  const acceptMime = mode === "img2pdf" ? "image/jpeg,image/png,image/webp" : "application/pdf";

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFilesSelected(Array.from(e.dataTransfer.files));
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`w-full max-w-2xl bg-white border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
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

        <div className="w-12 h-12 rounded-lg bg-zinc-100 border border-zinc-200 flex items-center justify-center mx-auto mb-4 text-zinc-700">
          {isMulti ? <FileUp className="w-5 h-5" /> : <Upload className="w-5 h-5" />}
        </div>

        <h2 className="text-base font-semibold text-zinc-900 tracking-tight mb-1">
          {mode === "img2pdf"
            ? "Drop images here to compile into PDF"
            : mode === "merge"
            ? "Select multiple PDF files to combine"
            : "Drop a PDF document here to open studio"}
        </h2>
        <p className="text-xs text-zinc-500 mb-6">
          Click to browse local storage or drag files directly into the workspace
        </p>

        <span className="inline-flex items-center px-4 py-2 rounded-md text-xs font-medium bg-zinc-900 text-white">
          Select {isMulti ? "Files" : "Document"}
        </span>

        <div className="mt-8 pt-4 border-t border-zinc-100 flex items-center justify-center gap-6 font-mono text-[11px] text-zinc-400">
          <span>FORMAT: {mode === "img2pdf" ? "JPG / PNG / WEBP" : "PDF 1.4 - 2.0"}</span>
          <span>•</span>
          <span>MEMORY: ZERO-STORAGE STREAM</span>
        </div>
      </div>
    </div>
  );
}