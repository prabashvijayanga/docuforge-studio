"use client";
import React from "react";
import { ToolMode } from "@/types/document";
import {
  FileText,
  Image,
  Layers,
  Minimize2,
  RefreshCw,
  RotateCcw,
  Download,
  LayoutGrid,
} from "lucide-react";

interface StudioHeaderProps {
  activeTool: ToolMode;
  showLanding: boolean;
  onGoHome: () => void;
  onSelectTool: (tool: ToolMode) => void;
  engineOnline: boolean;
  hasFiles: boolean;
  isProcessing: boolean;
  onReset: () => void;
  onExport: () => void;
}

const TOOLS: { id: ToolMode; label: string; icon: React.ReactNode }[] = [
  { id: "organize", label: "Organize & Notes", icon: <FileText className="w-3.5 h-3.5 shrink-0" /> },
  { id: "img2pdf", label: "Images to PDF", icon: <Image className="w-3.5 h-3.5 shrink-0" /> },
  { id: "merge", label: "Merge PDFs", icon: <Layers className="w-3.5 h-3.5 shrink-0" /> },
  { id: "compress", label: "Compress", icon: <Minimize2 className="w-3.5 h-3.5 shrink-0" /> },
  { id: "convert", label: "Convert PDF", icon: <RefreshCw className="w-3.5 h-3.5 shrink-0" /> },
];

export function StudioHeader({
  activeTool,
  showLanding,
  onGoHome,
  onSelectTool,
  engineOnline,
  hasFiles,
  isProcessing,
  onReset,
  onExport,
}: StudioHeaderProps) {
  return (
    <header className="bg-white border-b border-zinc-200 sticky top-0 z-30">
      <div className="h-14 px-3 sm:px-6 flex items-center justify-between gap-2">
        {/* Clickable Brand Logo -> Returns to Landing Hub */}
        <button
          type="button"
          onClick={onGoHome}
          className="flex items-center gap-2.5 shrink-0 text-left hover:opacity-80 transition-opacity"
          title="Return to DocuForge Home"
        >
          <div className="w-7 h-7 bg-zinc-900 text-white rounded flex items-center justify-center font-mono text-xs font-bold tracking-tighter">
            DF
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-zinc-900 tracking-tight text-sm">DocuForge</span>
            <span className="hidden sm:inline-block font-mono text-[10px] uppercase px-1.5 py-0.5 bg-zinc-100 text-zinc-600 rounded border border-zinc-200">
              Studio
            </span>
          </div>
        </button>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center gap-1 bg-zinc-100 p-1 rounded-lg border border-zinc-200/80">
          <button
            type="button"
            onClick={onGoHome}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
              showLanding
                ? "bg-white text-zinc-900 shadow-sm border border-zinc-200/60"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5 shrink-0" />
            All Tools
          </button>

          {TOOLS.map((t) => {
            const active = !showLanding && activeTool === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onSelectTool(t.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
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

        {/* Right Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded border border-zinc-200 bg-zinc-50">
            <span
              className={`w-2 h-2 rounded-full ${
                engineOnline ? "bg-emerald-600" : "bg-amber-500"
              }`}
            />
            <span className="font-mono text-[11px] text-zinc-600">
              {engineOnline ? "PY-ENGINE READY" : "LOCAL MODE"}
            </span>
          </div>

          {!showLanding && hasFiles && (
            <button
              type="button"
              onClick={onReset}
              disabled={isProcessing}
              className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-medium bg-zinc-100 hover:bg-zinc-200/80 text-zinc-700 transition-colors"
              title="Reset Workspace"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          )}

          {!showLanding ? (
            <button
              type="button"
              onClick={onExport}
              disabled={!hasFiles || isProcessing}
              className="flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-300 text-white font-medium text-xs rounded-md px-3 sm:px-4 py-2 transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5 shrink-0" />
              <span>{isProcessing ? "Processing..." : "Export"}</span>
              <span className="hidden sm:inline">{!isProcessing && "Document"}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onSelectTool("organize")}
              className="flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 text-white font-medium text-xs rounded-md px-3.5 py-2 transition-colors whitespace-nowrap"
            >
              <span>Launch Studio</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile / Tablet Scrollable Tool Switcher Bar */}
      <div className="lg:hidden border-t border-zinc-100 bg-zinc-50/70 px-3 py-1.5 overflow-x-auto no-scrollbar">
        <nav className="flex items-center gap-1 min-w-max">
          <button
            type="button"
            onClick={onGoHome}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
              showLanding
                ? "bg-zinc-900 text-white shadow-xs"
                : "bg-white text-zinc-600 border border-zinc-200/80"
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5 shrink-0" />
            All Tools
          </button>

          {TOOLS.map((t) => {
            const active = !showLanding && activeTool === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onSelectTool(t.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
                  active
                    ? "bg-zinc-900 text-white shadow-xs"
                    : "bg-white text-zinc-600 border border-zinc-200/80"
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}