"use client";
import React, { useEffect, useState } from "react";
import { arrayMove } from "@dnd-kit/sortable";
import { InspectorSettings, PDFPageItem, ToolMode } from "@/types/document";
import { renderPdfPagesToThumbnails } from "@/lib/pdf-client-renderer";
import { StudioHeader } from "@/components/layout/studio-header";
import { FileDropzone } from "@/components/workspace/file-dropzone";
import { PageThumbnailGrid } from "@/components/workspace/page-thumbnail-grid";
import { InspectorSidebar } from "@/components/layout/inspector-sidebar";
import { formatBytes } from "@/lib/utils";
import { FileText, Trash2, Scissors } from "lucide-react";

// Localhost වලදී Next.js proxy size limit එක මඟහැර කෙලින්ම FastAPI port 8000 වෙත යැවීම
const API_BASE =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
    ? "http://127.0.0.1:8000"
    : "";

export default function DocuForgeStudioPage() {
  const [activeTool, setActiveTool] = useState<ToolMode>("organize");
  const [engineOnline, setEngineOnline] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [pages, setPages] = useState<PDFPageItem[]>([]);
  const [deletedHistory, setDeletedHistory] = useState<PDFPageItem[][]>([]);
  const [loadingThumbnails, setLoadingThumbnails] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [rangeInput, setRangeInput] = useState("");

  const [settings, setSettings] = useState<InspectorSettings>({
    watermarkText: "",
    compressLevel: "recommended",
    pageSize: "A4",
    pageMargin: 24,
    convertFormat: "docx",
    imageDpi: 150,
  });

  useEffect(() => {
    fetch(`${API_BASE}/api/py/health`)
      .then((r) => r.ok && setEngineOnline(true))
      .catch(() => setEngineOnline(false));
  }, []);

  const handleReset = () => {
    setFiles([]);
    setPages([]);
    setDeletedHistory([]);
    setRangeInput("");
  };

  const handleSelectTool = (tool: ToolMode) => {
    setActiveTool(tool);
    handleReset();
  };

  const handleFilesSelected = async (selected: File[]) => {
    setFiles(selected);
    if (activeTool === "organize" && selected[0]?.type === "application/pdf") {
      setLoadingThumbnails(true);
      try {
        const rendered = await renderPdfPagesToThumbnails(selected[0]);
        setPages(rendered);
      } catch {
        alert("Failed to render PDF preview. Ensure the PDF is valid and not password-protected.");
      } finally {
        setLoadingThumbnails(false);
      }
    }
  };

  const handleReorder = (activeId: string, overId: string) => {
    setPages((items) => {
      const oldIdx = items.findIndex((i) => i.id === activeId);
      const newIdx = items.findIndex((i) => i.id === overId);
      return arrayMove(items, oldIdx, newIdx);
    });
  };

  const handleRotatePage = (id: string) => {
    setPages((items) =>
      items.map((p) => (p.id === id ? { ...p, rotation: (p.rotation + 90) % 360 } : p))
    );
  };

  const handleRotateAll = () => {
    setPages((items) => items.map((p) => ({ ...p, rotation: (p.rotation + 90) % 360 })));
  };

  const handleDeletePage = (id: string) => {
    if (pages.length <= 1) return alert("Document must contain at least one page.");
    setDeletedHistory((prev) => [...prev, pages]);
    setPages((items) => items.filter((p) => p.id !== id));
  };

  const handleUndoDelete = () => {
    if (deletedHistory.length === 0) return;
    const previous = deletedHistory[deletedHistory.length - 1];
    setPages(previous);
    setDeletedHistory((prev) => prev.slice(0, -1));
  };

  // පිටු 100+ PDF සඳහා පිටු පරාසයක් (උදා: "1-5, 10, 20-30") එකවර මැකීම හෝ ඉතිරි කරගැනීම
  const parsePageRange = (input: string, maxPages: number): Set<number> => {
    const result = new Set<number>();
    const parts = input.split(",");
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      if (trimmed.includes("-")) {
        const [startStr, endStr] = trimmed.split("-");
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);
        if (!isNaN(start) && !isNaN(end)) {
          for (let i = Math.min(start, end); i <= Math.max(start, end); i++) {
            if (i >= 1 && i <= maxPages) result.add(i);
          }
        }
      } else {
        const num = parseInt(trimmed, 10);
        if (!isNaN(num) && num >= 1 && num <= maxPages) result.add(num);
      }
    }
    return result;
  };

  const handleBulkRangeAction = (action: "remove" | "keep") => {
    if (!rangeInput.trim()) return;
    const targetSet = parsePageRange(rangeInput, pages.length);
    if (targetSet.size === 0) return alert("Enter valid page numbers (e.g., 1-5, 8, 12-20)");

    const filtered = pages.filter((_, idx) => {
      const currentPos = idx + 1;
      return action === "remove" ? !targetSet.has(currentPos) : targetSet.has(currentPos);
    });

    if (filtered.length === 0) return alert("Cannot remove all pages from the document.");
    setDeletedHistory((prev) => [...prev, pages]);
    setPages(filtered);
    setRangeInput("");
  };

  const handleExport = async () => {
    if (files.length === 0) return;
    setIsProcessing(true);

    try {
      const formData = new FormData();
      let endpoint = "/api/py/organize";
      let outputFilename = "docuforge_output.pdf";

      if (activeTool === "organize") {
        formData.append("file", files[0]);
        const ops = pages.map((p) => ({
          originalIndex: p.originalIndex,
          rotation: p.rotation,
        }));
        formData.append("operations", JSON.stringify(ops));
        formData.append("watermark", settings.watermarkText);
        formData.append("compress_level", "none");
        endpoint = "/api/py/organize";
        outputFilename = `edited_${files[0].name}`;
      } else if (activeTool === "img2pdf") {
        files.forEach((f) => formData.append("files", f));
        formData.append("page_size", settings.pageSize);
        formData.append("margin", String(settings.pageMargin));
        endpoint = "/api/py/images-to-pdf";
        outputFilename = "compiled_images.pdf";
      } else if (activeTool === "merge") {
        files.forEach((f) => formData.append("files", f));
        endpoint = "/api/py/merge";
        outputFilename = "merged_document.pdf";
      } else if (activeTool === "compress") {
        formData.append("file", files[0]);
        formData.append("level", settings.compressLevel);
        endpoint = "/api/py/compress";
        outputFilename = `compressed_${files[0].name}`;
      } else if (activeTool === "convert") {
        formData.append("file", files[0]);
        if (settings.convertFormat === "docx") {
          endpoint = "/api/py/pdf-to-word";
          outputFilename = files[0].name.replace(/\.pdf$/i, ".docx");
        } else {
          formData.append("dpi", String(settings.imageDpi));
          endpoint = "/api/py/pdf-to-images";
          outputFilename = `${files[0].name.replace(/\.pdf$/i, "")}_images.zip`;
        }
      }

      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || `HTTP ${res.status}`);
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = outputFilename;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: unknown) {
      console.error("Export Error:", err);
      const msg = err instanceof Error ? err.message : "Ensure FastAPI server is running";
      alert(`Processing failed: ${msg}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F9FA] text-zinc-900">
      <StudioHeader
        activeTool={activeTool}
        onSelectTool={handleSelectTool}
        engineOnline={engineOnline}
        hasFiles={files.length > 0}
        isProcessing={isProcessing}
        onReset={handleReset}
        onExport={handleExport}
      />

      <div className="flex-1 flex overflow-hidden">
        {files.length === 0 ? (
          <FileDropzone mode={activeTool} onFilesSelected={handleFilesSelected} />
        ) : activeTool === "organize" ? (
          loadingThumbnails ? (
            <div className="flex-1 flex items-center justify-center font-mono text-xs text-zinc-500">
              RENDERING PDF SHEETS IN MEMORY...
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Bulk Page Range Bar for Large Documents */}
              <div className="bg-white border-b border-zinc-200 px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-zinc-600">
                  <Scissors className="w-3.5 h-3.5 text-zinc-400" />
                  <span className="font-medium text-zinc-800">Quick Range Selector:</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="e.g. 1-5, 12, 20-45"
                    value={rangeInput}
                    onChange={(e) => setRangeInput(e.target.value)}
                    className="px-3 py-1 text-xs font-mono bg-zinc-50 border border-zinc-300 rounded-md w-48 focus:outline-none focus:border-zinc-900"
                  />
                  <button
                    type="button"
                    onClick={() => handleBulkRangeAction("remove")}
                    className="px-2.5 py-1 text-xs font-medium bg-zinc-100 hover:bg-red-50 hover:text-red-600 text-zinc-700 rounded border border-zinc-200 transition-colors"
                  >
                    Remove Range
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBulkRangeAction("keep")}
                    className="px-2.5 py-1 text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-white rounded transition-colors"
                  >
                    Keep Only Range
                  </button>
                </div>
              </div>

              <PageThumbnailGrid
                pages={pages}
                canUndo={deletedHistory.length > 0}
                onReorder={handleReorder}
                onRotatePage={handleRotatePage}
                onRotateAll={handleRotateAll}
                onDeletePage={handleDeletePage}
                onUndoDelete={handleUndoDelete}
              />
            </div>
          )
        ) : (
          <div className="flex-1 p-8 overflow-y-auto">
            <div className="max-w-2xl mx-auto bg-white border border-zinc-200 rounded-lg p-6">
              <h3 className="text-sm font-semibold text-zinc-900 mb-4">
                Queued Files ({files.length})
              </h3>
              <div className="divide-y divide-zinc-100">
                {files.map((file, idx) => (
                  <div key={idx} className="py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-zinc-400" />
                      <div>
                        <div className="text-xs font-medium text-zinc-800">{file.name}</div>
                        <div className="font-mono text-[10px] text-zinc-400">
                          {formatBytes(file.size)}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFiles((prev) => prev.filter((_, i) => i !== idx))}
                      className="p-1.5 text-zinc-400 hover:text-red-600 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <InspectorSidebar
          mode={activeTool}
          files={files}
          pageCount={pages.length}
          settings={settings}
          onUpdateSettings={(partial) => setSettings((prev) => ({ ...prev, ...partial }))}
          onExport={handleExport}
          isProcessing={isProcessing}
        />
      </div>
    </div>
  );
}