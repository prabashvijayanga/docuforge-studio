"use client";
import React from "react";
import { ToolMode } from "@/types/document";
import { FileText, Image, Layers, Minimize2, RefreshCw, RotateCcw, Download } from "lucide-react";

interface StudioHeaderProps {
  activeTool: ToolMode;
  onSelectTool: (tool: ToolMode) => void;
  engineOnline: boolean;
  hasFiles: boolean;
  isProcessing: boolean;
  onReset: () => void;
  onExport: () => void;
}

const TOOLS: { id: ToolMode; label: string; icon: React.ReactNode }[] = [
  { id: "organize", label: "Organize & Edit", icon: <FileText className="w-3.5 h-3.5" /> },
  { id: "img2pdf", label: "Images to PDF", icon: <Image className="w-3.5 h-3.5" /> },
  { id: "merge", label: "Merge PDFs", icon: <Layers className="w-3.5 h-3.5" /> },
  { id: "compress", label: "Compress", icon: <Minimize2 className="w-3.5 h-3.5" /> },
  { id: "convert", label: "Convert PDF", icon: <RefreshCw className="w-3.5 h-3.5" /> },
];

export function StudioHeader({
  activeTool,
  onSelectTool,
  engineOnline,
  hasFiles,
  isProcessing,
  onReset,
  onExport,
}: StudioHeaderProps) {
  return (
    <header className="h-14 bg-white border-b border-zinc-200 px-6 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <div className="w-7 h-7 bg-zinc-900 text-white rounded flex items-center justify-center font-mono text-xs font-bold tracking-tighter">
          DF
        </div>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-zinc-900 tracking-tight text-sm">DocuForge</span>
          <span className="font-mono text-[10px] uppercase px-1.5 py-0.5 bg-zinc-100 text-zinc-600 rounded border border-zinc-200">
            Studio
          </span>
        </div>
      </div>

      <nav className="flex items-center gap-1 bg-zinc-100 p-1 rounded-lg border border-zinc-200/80">
        {TOOLS.map((t) => {
          const active = activeTool === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onSelectTool(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                active
                  ? "bg-white text-zinc-900 shadow-sm border border-zinc-200/60"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          );
        })}
      </nav>

      <div className="flex items-center gap-3">
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded border border-zinc-200 bg-zinc-50">
          <span
            className={`w-2 h-2 rounded-full ${
              engineOnline ? "bg-emerald-600" : "bg-amber-500"
            }`}
          />
          <span className="font-mono text-[11px] text-zinc-600">
            {engineOnline ? "PY-ENGINE READY" : "LOCAL MODE"}
          </span>
        </div>

        {hasFiles && (
          <button
            onClick={onReset}
            disabled={isProcessing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-zinc-100 hover:bg-zinc-200/80 text-zinc-700 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
        )}

        <button
          onClick={onExport}
          disabled={!hasFiles || isProcessing}
          className="flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-300 text-white font-medium text-xs rounded-md px-4 py-2 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          {isProcessing ? "Processing..." : "Export Document"}
        </button>
      </div>
    </header>
  );
}