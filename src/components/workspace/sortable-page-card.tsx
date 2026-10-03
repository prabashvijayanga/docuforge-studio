"use client";
import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { PDFPageItem } from "@/types/document";
import { RotateCw, Trash2, GripVertical } from "lucide-react";

interface SortablePageCardProps {
  page: PDFPageItem;
  index: number;
  onRotate: (id: string) => void;
  onDelete: (id: string) => void;
}

export function SortablePageCard({ page, index, onRotate, onDelete }: SortablePageCardProps) {
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
      className={`group relative bg-white border rounded-lg p-2.5 flex flex-col transition-shadow ${
        isDragging
          ? "border-zinc-900 shadow-lg opacity-90"
          : "border-zinc-200/90 shadow-xs hover:border-zinc-400"
      }`}
    >
      {/* Top Meta Bar */}
      <div className="flex items-center justify-between mb-2">
        <div
          {...attributes}
          {...listeners}
          className="flex items-center gap-1 cursor-grab active:cursor-grabbing text-zinc-400 hover:text-zinc-700"
          title="Drag to reorder"
        >
          <GripVertical className="w-3.5 h-3.5" />
          <span className="font-mono text-[11px] font-medium bg-zinc-100 text-zinc-700 px-1.5 py-0.5 rounded">
            P.{String(index + 1).padStart(2, "0")}
          </span>
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={() => onRotate(page.id)}
            className="p-1 rounded bg-zinc-100 hover:bg-zinc-200 text-zinc-700"
            title="Rotate 90°"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(page.id)}
            className="p-1 rounded bg-zinc-100 hover:bg-red-50 hover:text-red-600 text-zinc-700"
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
          alt={`Page ${page.pageNumber}`}
          style={{ transform: `rotate(${page.rotation}deg)` }}
          className="max-h-full max-w-full object-contain transition-transform duration-200"
        />
      </div>

      {/* Footer Specs */}
      <div className="mt-2 flex items-center justify-between font-mono text-[10px] text-zinc-400">
        <span>ORIG #{page.pageNumber}</span>
        <span>{page.rotation > 0 ? `${page.rotation}°` : `${page.width}×${page.height}`}</span>
      </div>
    </div>
  );
}