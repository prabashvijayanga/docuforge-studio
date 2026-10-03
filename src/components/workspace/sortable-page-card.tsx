"use client";
import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { PDFPageItem } from "@/types/document";
import { RotateCw, Trash2, GripVertical, FilePlus2, PenLine } from "lucide-react";

interface SortablePageCardProps {
  page: PDFPageItem;
  index: number;
  onRotate: (id: string) => void;
  onDelete: (id: string) => void;
  onInsertNoteAfter: (index: number) => void;
  onEditNote?: (page: PDFPageItem) => void;
}

export function SortablePageCard({
  page,
  index,
  onRotate,
  onDelete,
  onInsertNoteAfter,
  onEditNote,
}: SortablePageCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: page.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative bg-white border rounded-lg p-2 sm:p-2.5 flex flex-col transition-shadow ${
        isDragging
          ? "border-zinc-900 shadow-lg opacity-90"
          : page.isCustomNote
          ? "border-zinc-800 ring-1 ring-zinc-900/10 shadow-xs"
          : "border-zinc-200/90 shadow-xs hover:border-zinc-400"
      }`}
    >
      {/* Top Meta Bar */}
      <div className="flex items-center justify-between mb-2">
        <div
          {...attributes}
          {...listeners}
          className="flex items-center gap-1 cursor-grab active:cursor-grabbing text-zinc-400 hover:text-zinc-700 touch-none py-0.5"
          title="Drag to reorder"
        >
          <GripVertical className="w-3.5 h-3.5" />
          <span
            className={`font-mono text-[11px] font-medium px-1.5 py-0.5 rounded ${
              page.isCustomNote ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700"
            }`}
          >
            P.{String(index + 1).padStart(2, "0")}
          </span>
        </div>

        <div className="flex items-center gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
          {page.isCustomNote && onEditNote && (
            <button
              type="button"
              onClick={() => onEditNote(page)}
              className="p-1.5 sm:p-1 rounded bg-zinc-900 text-white hover:bg-zinc-700"
              title="Edit Typed Note"
            >
              <PenLine className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => onInsertNoteAfter(index)}
            className="p-1.5 sm:p-1 rounded bg-zinc-100 hover:bg-zinc-900 hover:text-white text-zinc-700"
            title="Insert Smart Typed Page after this page"
          >
            <FilePlus2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onRotate(page.id)}
            className="p-1.5 sm:p-1 rounded bg-zinc-100 hover:bg-zinc-200 text-zinc-700"
            title="Rotate 90°"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(page.id)}
            className="p-1.5 sm:p-1 rounded bg-zinc-100 hover:bg-red-50 hover:text-red-600 text-zinc-700"
            title="Remove page"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Page Canvas Preview */}
      <div className="relative bg-zinc-50 border border-zinc-100 rounded aspect-[1/1.414] flex items-center justify-center overflow-hidden">
        <img
          src={page.thumbnailDataUrl}
          alt={`Page ${index + 1}`}
          style={{ transform: `rotate(${page.rotation}deg)` }}
          className="max-h-full max-w-full object-contain transition-transform duration-200"
        />
      </div>

      {/* Footer Specs */}
      <div className="mt-2 flex items-center justify-between font-mono text-[10px] text-zinc-400">
        <span>{page.isCustomNote ? "TYPED NOTE" : `ORIG #${page.pageNumber}`}</span>
        <button
          type="button"
          onClick={() => onInsertNoteAfter(index)}
          className="text-zinc-600 hover:text-zinc-900 font-sans font-medium underline decoration-zinc-300"
        >
          + Add Page Here
        </button>
      </div>
    </div>
  );
}