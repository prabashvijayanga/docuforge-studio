"use client";
import React from "react";
import { ConvertTargetFormat, InspectorSettings, ToolMode } from "@/types/document";
import { formatBytes } from "@/lib/utils";

interface InspectorSidebarProps {
  mode: ToolMode;
  files: File[];
  pageCount: number;
  settings: InspectorSettings;
  onUpdateSettings: (partial: Partial<InspectorSettings>) => void;
  onExport: () => void;
  isProcessing: boolean;
}

const CONVERT_OPTIONS: {
  id: ConvertTargetFormat;
  badge: string;
  title: string;
  desc: string;
}[] = [
  {
    id: "docx",
    badge: ".DOCX",
    title: "Microsoft Word",
    desc: "Editable paragraphs & layout",
  },
  {
    id: "pptx",
    badge: ".PPTX",
    title: "PowerPoint Slides",
    desc: "16:9 widescreen presentation + notes",
  },
  {
    id: "xlsx",
    badge: ".XLSX",
    title: "Excel Spreadsheet",
    desc: "Auto-detects tables & structured rows",
  },
  {
    id: "md",
    badge: ".MD",
    title: "Markdown Document",
    desc: "Clean headings & text for Notion/GitHub",
  },
  {
    id: "html",
    badge: ".HTML",
    title: "Interactive Web Page",
    desc: "Standalone responsive HTML5 document",
  },
  {
    id: "txt",
    badge: ".TXT",
    title: "Plain Text Stream",
    desc: "Raw UTF-8 text with page markers",
  },
  {
    id: "png_zip",
    badge: ".ZIP",
    title: "High-Res PNG Archive",
    desc: "150 DPI rendered page sheets",
  },
];

export function InspectorSidebar({
  mode,
  files,
  pageCount,
  settings,
  onUpdateSettings,
  onExport,
  isProcessing,
}: InspectorSidebarProps) {
  const totalBytes = files.reduce((acc, f) => acc + f.size, 0);

  return (
    <aside className="w-full lg:w-80 bg-white border-t lg:border-t-0 lg:border-l border-zinc-200 p-4 sm:p-5 flex flex-col justify-between shrink-0 overflow-y-auto">
      <div className="space-y-5">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2.5">
            Document Telemetry
          </h3>
          <div className="grid grid-cols-3 lg:grid-cols-1 gap-2 bg-zinc-50 border border-zinc-200/80 rounded-lg p-3 font-mono text-xs">
            <div className="flex flex-col lg:flex-row lg:justify-between">
              <span className="text-zinc-500 text-[10px] lg:text-xs">FILES</span>
              <span className="text-zinc-900 font-medium">{files.length}</span>
            </div>
            {pageCount > 0 && (
              <div className="flex flex-col lg:flex-row lg:justify-between">
                <span className="text-zinc-500 text-[10px] lg:text-xs">PAGES</span>
                <span className="text-zinc-900 font-medium">{pageCount}</span>
              </div>
            )}
            <div className="flex flex-col lg:flex-row lg:justify-between">
              <span className="text-zinc-500 text-[10px] lg:text-xs">SIZE</span>
              <span className="text-zinc-900 font-medium">{formatBytes(totalBytes)}</span>
            </div>
          </div>
        </div>

        {mode === "organize" && (
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Page Operations
            </h3>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                Watermark Overlay (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. CONFIDENTIAL"
                value={settings.watermarkText}
                onChange={(e) => onUpdateSettings({ watermarkText: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-white border border-zinc-300 rounded-md focus:outline-none focus:border-zinc-900"
              />
            </div>
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              Drag cards to reorder pages, insert Smart Typed Note pages anywhere, or remove unwanted sheets.
            </p>
          </div>
        )}

        {mode === "img2pdf" && (
          <div className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Page Layout Settings
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">Sheet Size</label>
                <select
                  value={settings.pageSize}
                  onChange={(e) =>
                    onUpdateSettings({ pageSize: e.target.value as "A4" | "FIT" })
                  }
                  className="w-full px-3 py-2 text-xs bg-white border border-zinc-300 rounded-md"
                >
                  <option value="A4">ISO A4 Standard (Auto)</option>
                  <option value="FIT">Fit Original Dimensions</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                  Page Margin ({settings.pageMargin} pt)
                </label>
                <input
                  type="range"
                  min={0}
                  max={72}
                  value={settings.pageMargin}
                  onChange={(e) => onUpdateSettings({ pageMargin: Number(e.target.value) })}
                  className="w-full accent-zinc-900 mt-1.5"
                />
              </div>
            </div>
          </div>
        )}

        {mode === "compress" && (
          <div className="space-y-2.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Compression Profile
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-2">
              {(["light", "recommended", "extreme"] as const).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => onUpdateSettings({ compressLevel: lvl })}
                  className={`w-full text-left p-2.5 sm:p-3 rounded-lg border text-xs transition-all ${
                    settings.compressLevel === lvl
                      ? "border-zinc-900 bg-zinc-50 font-medium"
                      : "border-zinc-200 hover:border-zinc-300"
                  }`}
                >
                  <div className="uppercase font-mono text-[11px] text-zinc-900">{lvl}</div>
                  <div className="text-zinc-500 text-[11px] mt-0.5">
                    {lvl === "light" && "High DPI retention"}
                    {lvl === "recommended" && "Balanced 110 DPI (65%)"}
                    {lvl === "extreme" && "Max reduction (72 DPI)"}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {mode === "convert" && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Target Output Format (7 Engines)
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
              {CONVERT_OPTIONS.map((opt) => {
                const active = settings.convertFormat === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onUpdateSettings({ convertFormat: opt.id })}
                    className={`p-2.5 rounded-lg border text-left text-xs transition-all ${
                      active
                        ? "border-zinc-900 bg-zinc-50 ring-1 ring-zinc-900/10"
                        : "border-zinc-200 hover:border-zinc-300"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="font-semibold text-zinc-900">{opt.title}</span>
                      <span
                        className={`font-mono text-[10px] px-1.5 py-0.5 rounded ${
                          active
                            ? "bg-zinc-900 text-white"
                            : "bg-zinc-100 text-zinc-600"
                        }`}
                      >
                        {opt.badge}
                      </span>
                    </div>
                    <div className="text-[11px] text-zinc-500">{opt.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="pt-4 mt-4 border-t border-zinc-200">
        <button
          type="button"
          onClick={onExport}
          disabled={files.length === 0 || isProcessing}
          className="w-full py-2.5 px-4 rounded-md bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-200 disabled:text-zinc-400 text-white font-medium text-xs transition-colors"
        >
          {isProcessing ? "Running Conversion Engine..." : "Execute & Download"}
        </button>
      </div>
    </aside>
  );
}