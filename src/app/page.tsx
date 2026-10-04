"use client";
import React, { useEffect, useState } from "react";
import { arrayMove } from "@dnd-kit/sortable";
import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
import {
  ConvertDirection,
  ConvertTargetFormat,
  InspectorSettings,
  PDFPageItem,
  ToolMode,
} from "@/types/document";
import { renderPdfPagesToThumbnails } from "@/lib/pdf-client-renderer";
import { StudioHeader } from "@/components/layout/studio-header";
import { LandingHero } from "@/components/layout/landing-hero";
import { FileDropzone } from "@/components/workspace/file-dropzone";
import { PageThumbnailGrid } from "@/components/workspace/page-thumbnail-grid";
import { SmartNoteModal } from "@/components/workspace/smart-note-modal";
import { InspectorSidebar } from "@/components/layout/inspector-sidebar";
import { formatBytes } from "@/lib/utils";
import { FileText, Trash2, Scissors, ArrowLeft } from "lucide-react";

const API_BASE =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
    ? "http://127.0.0.1:8000"
    : "";

async function imageFileToNormalizedJpegBytes(
  file: File,
  maxDimension = 2600,
  quality = 0.88
): Promise<{ bytes: Uint8Array; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;

      if (width > maxDimension || height > maxDimension) {
        const scale = maxDimension / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas context unavailable"));
        return;
      }

      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        async (blob) => {
          if (!blob) {
            reject(new Error("Failed to encode image"));
            return;
          }
          const buf = await blob.arrayBuffer();
          resolve({ bytes: new Uint8Array(buf), width, height });
        },
        "image/jpeg",
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Could not load image: ${file.name}`));
    };

    img.src = objectUrl;
  });
}

function wrapTextLines(text: string, maxCharsPerLine = 78): string[] {
  const result: string[] = [];
  const paragraphs = text.split("\n");
  for (const para of paragraphs) {
    if (!para.trim()) {
      result.push("");
      continue;
    }
    const words = para.split(" ");
    let currentLine = "";
    for (const word of words) {
      if ((currentLine + " " + word).trim().length <= maxCharsPerLine) {
        currentLine = (currentLine + " " + word).trim();
      } else {
        if (currentLine) result.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) result.push(currentLine);
  }
  return result;
}

export default function DocuForgeStudioPage() {
  const [showLanding, setShowLanding] = useState(true);
  const [activeTool, setActiveTool] = useState<ToolMode>("organize");
  const [engineOnline, setEngineOnline] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [pages, setPages] = useState<PDFPageItem[]>([]);
  const [deletedHistory, setDeletedHistory] = useState<PDFPageItem[][]>([]);
  const [loadingThumbnails, setLoadingThumbnails] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [rangeInput, setRangeInput] = useState("");

  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [insertAfterIdx, setInsertAfterIdx] = useState<number>(0);
  const [editingNotePageId, setEditingNotePageId] = useState<string | null>(null);

  const [settings, setSettings] = useState<InspectorSettings>({
    watermarkText: "",
    compressLevel: "recommended",
    pageSize: "A4",
    pageMargin: 24,
    convertDirection: "pdf_to_other",
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
    setShowLanding(false);
    handleReset();
  };

  const handleLaunchFromLanding = (
    tool: ToolMode,
    convertDir?: ConvertDirection,
    convertFmt?: ConvertTargetFormat
  ) => {
    setActiveTool(tool);
    if (convertDir || convertFmt) {
      setSettings((prev) => ({
        ...prev,
        ...(convertDir ? { convertDirection: convertDir } : {}),
        ...(convertFmt ? { convertFormat: convertFmt } : {}),
      }));
    }
    setShowLanding(false);
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

  const handleOpenInsertNote = (index: number) => {
    setEditingNotePageId(null);
    setInsertAfterIdx(index);
    setNoteModalOpen(true);
  };

  const handleOpenEditNote = (page: PDFPageItem) => {
    setEditingNotePageId(page.id);
    setNoteModalOpen(true);
  };

  const handleSaveNotePage = (title: string, typedText: string, previewDataUrl: string) => {
    if (editingNotePageId) {
      setPages((prev) =>
        prev.map((p) =>
          p.id === editingNotePageId
            ? { ...p, noteTitle: title, noteText: typedText, thumbnailDataUrl: previewDataUrl }
            : p
        )
      );
      setEditingNotePageId(null);
      return;
    }

    const newPage: PDFPageItem = {
      id: `custom-note-${Date.now()}`,
      originalIndex: -1,
      pageNumber: pages.length + 1,
      rotation: 0,
      thumbnailDataUrl: previewDataUrl,
      width: 595,
      height: 842,
      isCustomNote: true,
      noteTitle: title,
      noteText: typedText,
    };

    setDeletedHistory((prev) => [...prev, pages]);
    setPages((prev) => {
      const copy = [...prev];
      copy.splice(insertAfterIdx + 1, 0, newPage);
      return copy;
    });
  };

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

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleExport = async () => {
    if (files.length === 0) return;
    setIsProcessing(true);

    try {
      if (activeTool === "organize") {
        const srcBytes = await files[0].arrayBuffer();
        const srcDoc = await PDFDocument.load(srcBytes);
        const outDoc = await PDFDocument.create();

        const fontRegular = await outDoc.embedFont(StandardFonts.Helvetica);
        const fontBold = await outDoc.embedFont(StandardFonts.HelveticaBold);

        for (const p of pages) {
          let targetPage;

          if (p.isCustomNote) {
            targetPage = outDoc.addPage([595.28, 841.89]);
            const { width, height } = targetPage.getSize();
            let cursorY = height - 56;

            if (p.noteTitle) {
              targetPage.drawText(p.noteTitle, {
                x: 48,
                y: cursorY,
                size: 16,
                font: fontBold,
                color: rgb(0.09, 0.09, 0.11),
              });
              cursorY -= 14;
              targetPage.drawLine({
                start: { x: 48, y: cursorY },
                end: { x: width - 48, y: cursorY },
                thickness: 0.75,
                color: rgb(0.85, 0.85, 0.88),
              });
              cursorY -= 24;
            }

            const wrappedLines = wrapTextLines(p.noteText || "", 80);
            for (const line of wrappedLines) {
              if (cursorY < 56) {
                targetPage = outDoc.addPage([595.28, 841.89]);
                cursorY = height - 56;
              }
              targetPage.drawText(line, {
                x: 48,
                y: cursorY,
                size: 11.5,
                font: fontRegular,
                color: rgb(0.18, 0.18, 0.21),
              });
              cursorY -= 18;
            }

            if (p.rotation !== 0) {
              targetPage.setRotation(degrees(p.rotation));
            }
          } else {
            const [copied] = await outDoc.copyPages(srcDoc, [p.originalIndex]);
            const currentRot = copied.getRotation().angle;
            copied.setRotation(degrees((currentRot + p.rotation) % 360));
            targetPage = outDoc.addPage(copied);
          }

          if (settings.watermarkText.trim()) {
            const { width, height } = targetPage.getSize();
            targetPage.drawText(settings.watermarkText.trim(), {
              x: width * 0.22,
              y: height * 0.45,
              size: 42,
              font: fontBold,
              color: rgb(0.6, 0.6, 0.6),
              opacity: 0.28,
              rotate: degrees(45),
            });
          }
        }

        const outBytes = await outDoc.save();
        triggerDownload(
          new Blob([outBytes as unknown as BlobPart], { type: "application/pdf" }),
          `edited_${files[0].name}`
        );
        return;
      }

      if (activeTool === "img2pdf") {
        const pdfDoc = await PDFDocument.create();
        const a4Width = 595.28;
        const a4Height = 841.89;
        const margin = settings.pageMargin;

        for (const imgFile of files) {
          const { bytes, width: imgW, height: imgH } = await imageFileToNormalizedJpegBytes(imgFile);
          const embeddedJpg = await pdfDoc.embedJpg(bytes);

          if (settings.pageSize === "FIT") {
            const page = pdfDoc.addPage([imgW, imgH]);
            page.drawImage(embeddedJpg, { x: 0, y: 0, width: imgW, height: imgH });
          } else {
            const isLandscape = imgW > imgH;
            const pw = isLandscape ? a4Height : a4Width;
            const ph = isLandscape ? a4Width : a4Height;
            const page = pdfDoc.addPage([pw, ph]);

            const availW = Math.max(50, pw - margin * 2);
            const availH = Math.max(50, ph - margin * 2);
            const scale = Math.min(availW / imgW, availH / imgH);
            const drawW = imgW * scale;
            const drawH = imgH * scale;
            const x = (pw - drawW) / 2;
            const y = (ph - drawH) / 2;

            page.drawImage(embeddedJpg, { x, y, width: drawW, height: drawH });
          }
        }

        const pdfBytes = await pdfDoc.save();
        triggerDownload(
          new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" }),
          "compiled_images.pdf"
        );
        return;
      }

      if (activeTool === "merge") {
        const mergedPdf = await PDFDocument.create();
        for (const pdfFile of files) {
          const buf = await pdfFile.arrayBuffer();
          const srcDoc = await PDFDocument.load(buf);
          const copiedPages = await mergedPdf.copyPages(srcDoc, srcDoc.getPageIndices());
          copiedPages.forEach((p) => mergedPdf.addPage(p));
        }
        const mergedBytes = await mergedPdf.save();
        triggerDownload(
          new Blob([mergedBytes as unknown as BlobPart], { type: "application/pdf" }),
          "merged_document.pdf"
        );
        return;
      }

      const formData = new FormData();
      let endpoint = "/api/py/compress";
      const baseName = files[0].name.replace(/\.[^/.]+$/, "");
      let outputFilename = `${baseName}_output.pdf`;

      if (activeTool === "compress") {
        formData.append("file", files[0]);
        formData.append("level", settings.compressLevel);
        endpoint = "/api/py/compress";
        outputFilename = `compressed_${files[0].name}`;
      } else if (activeTool === "convert") {
        formData.append("file", files[0]);

        if (settings.convertDirection === "other_to_pdf") {
          endpoint = "/api/py/office-to-pdf";
          outputFilename = `${baseName}.pdf`;
        } else {
          switch (settings.convertFormat) {
            case "docx":
              endpoint = "/api/py/pdf-to-word";
              outputFilename = `${baseName}.docx`;
              break;
            case "pptx":
              endpoint = "/api/py/pdf-to-pptx";
              outputFilename = `${baseName}.pptx`;
              break;
            case "xlsx":
              endpoint = "/api/py/pdf-to-excel";
              outputFilename = `${baseName}.xlsx`;
              break;
            case "md":
              endpoint = "/api/py/pdf-to-md";
              outputFilename = `${baseName}.md`;
              break;
            case "html":
              endpoint = "/api/py/pdf-to-html";
              outputFilename = `${baseName}.html`;
              break;
            case "txt":
              endpoint = "/api/py/pdf-to-txt";
              outputFilename = `${baseName}.txt`;
              break;
            case "png_zip":
            default:
              formData.append("dpi", String(settings.imageDpi));
              endpoint = "/api/py/pdf-to-images";
              outputFilename = `${baseName}_images.zip`;
              break;
          }
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
      triggerDownload(blob, outputFilename);
    } catch (err: unknown) {
      console.error("Export Error:", err);
      const msg = err instanceof Error ? err.message : "Ensure FastAPI server is running";
      alert(`Processing failed: ${msg}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const editingPageObj = pages.find((p) => p.id === editingNotePageId);

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F9FA] text-zinc-900">
      <StudioHeader
        activeTool={activeTool}
        showLanding={showLanding}
        onGoHome={() => setShowLanding(true)}
        onSelectTool={handleSelectTool}
        engineOnline={engineOnline}
        hasFiles={files.length > 0}
        isProcessing={isProcessing}
        onReset={handleReset}
        onExport={handleExport}
      />

      {showLanding ? (
        <LandingHero engineOnline={engineOnline} onLaunchTool={handleLaunchFromLanding} />
      ) : (
        <div className="flex-1 flex flex-col lg:flex-row overflow-x-hidden">
          {files.length === 0 ? (
            <div className="flex-1 flex flex-col">
              {/* Sub-bar to return to All Tools Overview */}
              <div className="px-4 sm:px-8 pt-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowLanding(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to All Tools Overview</span>
                </button>
              </div>

              <FileDropzone
                mode={activeTool}
                convertDirection={settings.convertDirection}
                onToggleConvertDirection={(dir) => {
                  setSettings((prev) => ({ ...prev, convertDirection: dir }));
                  handleReset();
                }}
                onFilesSelected={handleFilesSelected}
              />
            </div>
          ) : activeTool === "organize" ? (
            loadingThumbnails ? (
              <div className="flex-1 py-20 flex items-center justify-center font-mono text-xs text-zinc-500">
                RENDERING PDF SHEETS IN MEMORY...
              </div>
            ) : (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="bg-white border-b border-zinc-200 px-3 sm:px-6 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2 text-xs text-zinc-600">
                    <Scissors className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    <span className="font-medium text-zinc-800">Quick Range Selector:</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      placeholder="e.g. 1-5, 12, 20-45"
                      value={rangeInput}
                      onChange={(e) => setRangeInput(e.target.value)}
                      className="px-3 py-1.5 sm:py-1 text-xs font-mono bg-zinc-50 border border-zinc-300 rounded-md flex-1 sm:w-44 focus:outline-none focus:border-zinc-900"
                    />
                    <button
                      type="button"
                      onClick={() => handleBulkRangeAction("remove")}
                      className="px-2.5 py-1.5 sm:py-1 text-xs font-medium bg-zinc-100 hover:bg-red-50 hover:text-red-600 text-zinc-700 rounded border border-zinc-200 transition-colors"
                    >
                      Remove
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBulkRangeAction("keep")}
                      className="px-2.5 py-1.5 sm:py-1 text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-white rounded transition-colors"
                    >
                      Keep Only
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
                  onInsertNoteAfter={handleOpenInsertNote}
                  onEditNote={handleOpenEditNote}
                />
              </div>
            )
          ) : (
            <div className="flex-1 p-4 sm:p-8 overflow-y-auto">
              <div className="max-w-2xl mx-auto bg-white border border-zinc-200 rounded-lg p-4 sm:p-6">
                <h3 className="text-sm font-semibold text-zinc-900 mb-4">
                  Queued Files ({files.length})
                </h3>
                <div className="divide-y divide-zinc-100">
                  {files.map((file, idx) => (
                    <div key={idx} className="py-3 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText className="w-4 h-4 text-zinc-400 shrink-0" />
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-zinc-800 truncate">
                            {file.name}
                          </div>
                          <div className="font-mono text-[10px] text-zinc-400">
                            {formatBytes(file.size)}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFiles((prev) => prev.filter((_, i) => i !== idx))}
                        className="p-1.5 text-zinc-400 hover:text-red-600 rounded shrink-0"
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
            onResetFiles={handleReset}
          />
        </div>
      )}

      <SmartNoteModal
        isOpen={noteModalOpen}
        insertAfterPage={insertAfterIdx + 1}
        initialTitle={editingPageObj?.noteTitle || ""}
        initialText={editingPageObj?.noteText || ""}
        onClose={() => {
          setNoteModalOpen(false);
          setEditingNotePageId(null);
        }}
        onSaveNotePage={handleSaveNotePage}
      />
    </div>
  );
}