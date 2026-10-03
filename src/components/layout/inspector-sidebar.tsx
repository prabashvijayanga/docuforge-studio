"use client";
import React from "react";
import { InspectorSettings, ToolMode } from "@/types/document";
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
    <aside className="w-full lg:w-80 bg-white border-t lg:border-t-0 lg:border-l border-zinc-200 p-4 sm:p-5 flex flex-col justify-between shrink-0">
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

        {/* Tool-specific Inspector Controls */}
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
              Drag cards to reorder pages, tap rotate on individual sheets, or remove unwanted pages before exporting.
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
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Target Output Format
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => onUpdateSettings({ convertFormat: "docx" })}
                className={`p-3 rounded-lg border text-left text-xs ${
                  settings.convertFormat === "docx"
                    ? "border-zinc-900 bg-zinc-50 font-medium"
                    : "border-zinc-200"
                }`}
              >
                <div className="font-mono text-zinc-900">Microsoft Word (.DOCX)</div>
                <div className="text-[11px] text-zinc-500">Editable layout & paragraphs</div>
              </button>
              <button
                type="button"
                onClick={() => onUpdateSettings({ convertFormat: "png_zip" })}
                className={`p-3 rounded-lg border text-left text-xs ${
                  settings.convertFormat === "png_zip"
                    ? "border-zinc-900 bg-zinc-50 font-medium"
                    : "border-zinc-200"
                }`}
              >
                <div className="font-mono text-zinc-900">High-Res PNG Archive (.ZIP)</div>
                <div className="text-[11px] text-zinc-500">150 DPI rendered sheets</div>
              </button>
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
          {isProcessing ? "Running Python Pipeline..." : "Execute & Download"}
        </button>
      </div>
    </aside>
  );
}