"use client";
import React from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { PDFPageItem } from "@/types/document";
import { SortablePageCard } from "./sortable-page-card";
import { RotateCw, Undo2, FilePlus2 } from "lucide-react";

interface PageThumbnailGridProps {
  pages: PDFPageItem[];
  canUndo: boolean;
  onReorder: (activeId: string, overId: string) => void;
  onRotatePage: (id: string) => void;
  onRotateAll: () => void;
  onDeletePage: (id: string) => void;
  onUndoDelete: () => void;
  onInsertNoteAfter: (index: number) => void;
  onEditNote: (page: PDFPageItem) => void;
}

export function PageThumbnailGrid({
  pages,
  canUndo,
  onReorder,
  onRotatePage,
  onRotateAll,
  onDeletePage,
  onUndoDelete,
  onInsertNoteAfter,
  onEditNote,
}: PageThumbnailGridProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      onReorder(String(active.id), String(over.id));
    }
  };

  return (
    <div className="flex-1 p-3 sm:p-6 overflow-y-auto">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 bg-white border border-zinc-200/90 rounded-lg px-3 sm:px-4 py-2.5">
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="text-xs font-medium text-zinc-800">
            Interactive Page Canvas
          </span>
          <span className="font-mono text-[11px] text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded">
            {pages.length} PAGES
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onInsertNoteAfter(pages.length - 1)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-white"
          >
            <FilePlus2 className="w-3.5 h-3.5" />
            <span>+ New Smart Typed Page</span>
          </button>

          {canUndo && (
            <button
              type="button"
              onClick={onUndoDelete}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-zinc-100 hover:bg-zinc-200 text-zinc-700"
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span>Undo</span>
            </button>
          )}
          <button
            type="button"
            onClick={onRotateAll}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-zinc-100 hover:bg-zinc-200 text-zinc-700"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>Rotate All 90°</span>
          </button>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={pages.map((p) => p.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
            {pages.map((page, index) => (
              <SortablePageCard
                key={page.id}
                page={page}
                index={index}
                onRotate={onRotatePage}
                onDelete={onDeletePage}
                onInsertNoteAfter={onInsertNoteAfter}
                onEditNote={onEditNote}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}