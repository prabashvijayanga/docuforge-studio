"use client";
import React, { useRef, useState, useEffect } from "react";
import { X, PenTool, Type, Sparkles, Eraser, Check, FilePlus } from "lucide-react";

interface SmartNoteModalProps {
  isOpen: boolean;
  insertAfterPage: number;
  initialTitle?: string;
  initialText?: string;
  onClose: () => void;
  onSaveNotePage: (title: string, typedText: string, previewDataUrl: string) => void;
}

export function SmartNoteModal({
  isOpen,
  insertAfterPage,
  initialTitle = "",
  initialText = "",
  onClose,
  onSaveNotePage,
}: SmartNoteModalProps) {
  const [title, setTitle] = useState(initialTitle);
  const [typedText, setTypedText] = useState(initialText);
  const [inputMode, setInputMode] = useState<"scribble" | "inkpad">("inkpad");
  const [isRecognizing, setIsRecognizing] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    setTitle(initialTitle);
    setTypedText(initialText);
  }, [initialTitle, initialText, isOpen]);

  useEffect(() => {
    if (isOpen && inputMode === "inkpad") {
      initCanvas();
    }
  }, [isOpen, inputMode]);

  const initCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#18181B";
    ctx.lineWidth = 3.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    setHasInk(false);
  };

  if (!isOpen) return null;

  const getCoordinates = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasInk(true);
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };


  const handleConvertInkToText = async () => {
    if (!canvasRef.current || !hasInk) return;
    setIsRecognizing(true);
    try {
      const Tesseract = await import("tesseract.js");
      const dataUrl = canvasRef.current.toDataURL("image/png");
      const { data } = await Tesseract.recognize(dataUrl, "eng");
      const cleaned = data.text.trim();
      if (cleaned) {
        setTypedText((prev) => (prev ? `${prev}\n${cleaned}` : cleaned));
        initCanvas();
      } else {
        alert("Could not detect clear handwriting. Write slightly larger or use Tablet Scribble mode.");
      }
    } catch {
      alert("Handwriting recognition failed.");
    } finally {
      setIsRecognizing(false);
    }
  };


  const generateNoteThumbnail = (heading: string, body: string): string => {
    const c = document.createElement("canvas");
    c.width = 420;
    c.height = 594;
    const ctx = c.getContext("2d")!;

    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, c.width, c.height);

    // Subtle ruled lines
    ctx.strokeStyle = "#F4F4F5";
    ctx.lineWidth = 1;
    for (let y = 80; y < c.height - 30; y += 24) {
      ctx.beginPath();
      ctx.moveTo(32, y);
      ctx.lineTo(c.width - 32, y);
      ctx.stroke();
    }

    ctx.fillStyle = "#18181B";
    ctx.font = "bold 16px sans-serif";
    ctx.fillText(heading || "SMART NOTE PAGE", 32, 48);

    ctx.fillStyle = "#3F3F46";
    ctx.font = "12px monospace";
    const lines = (body || "").split("\n");
    let yPos = 85;
    for (const line of lines.slice(0, 18)) {
      ctx.fillText(line.slice(0, 48), 32, yPos);
      yPos += 24;
    }
    return c.toDataURL("image/jpeg", 0.85);
  };

  const handleConfirmSave = () => {
    if (!typedText.trim() && !title.trim()) {
      return alert("Please write or type some content for the new page.");
    }
    const thumb = generateNoteThumbnail(title, typedText);
    onSaveNotePage(title.trim(), typedText, thumb);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
      <div className="bg-white border border-zinc-200 rounded-xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Top Bar */}
        <div className="px-5 py-3.5 border-b border-zinc-200 flex items-center justify-between bg-zinc-50">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded bg-zinc-900 text-white flex items-center justify-center">
              <FilePlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-semibold text-zinc-900">
                Insert Smart Typed Page (After Page #{insertAfterPage})
              </h3>
              <p className="text-[11px] text-zinc-500">
                Write with Tablet Stylus / Pencil and convert directly into clean typed PDF text
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-800 hover:bg-zinc-200/60"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Page Heading */}
          <div>
            <label className="block text-[11px] font-mono uppercase text-zinc-500 mb-1">
              Page Heading (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Lecture Summary / Additional Clauses..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm font-medium bg-white border border-zinc-300 rounded-lg focus:outline-none focus:border-zinc-900"
            />
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
            <div className="inline-flex bg-zinc-100 p-1 rounded-lg border border-zinc-200">
              <button
                type="button"
                onClick={() => setInputMode("inkpad")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  inputMode === "inkpad"
                    ? "bg-white text-zinc-900 shadow-xs"
                    : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                <PenTool className="w-3.5 h-3.5" />
                Stylus Ink Pad (Auto-OCR)
              </button>
              <button
                type="button"
                onClick={() => setInputMode("scribble")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  inputMode === "scribble"
                    ? "bg-white text-zinc-900 shadow-xs"
                    : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                <Type className="w-3.5 h-3.5" />
                Direct Tablet Scribble / Type
              </button>
            </div>

            {inputMode === "inkpad" && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={initCanvas}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium bg-zinc-100 hover:bg-zinc-200 text-zinc-700"
                >
                  <Eraser className="w-3.5 h-3.5" />
                  Clear Ink
                </button>
                <button
                  type="button"
                  onClick={handleConvertInkToText}
                  disabled={!hasInk || isRecognizing}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-300 text-white transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {isRecognizing ? "Converting Handwriting..." : "Convert Ink to Typed Text"}
                </button>
              </div>
            )}
          </div>

          {/* Stylus Ink Drawing Box */}
          {inputMode === "inkpad" && (
            <div className="border-2 border-dashed border-zinc-300 rounded-xl overflow-hidden bg-white relative">
              <div className="bg-zinc-50 px-3 py-1.5 border-b border-zinc-200 flex items-center justify-between text-[11px] font-mono text-zinc-500">
                <span>DRAW WITH PEN / STYLUS BELOW</span>
                <span>CLICK &quot;CONVERT INK TO TYPED TEXT&quot; WHEN DONE</span>
              </div>
              <canvas
                ref={canvasRef}
                width={900}
                height={260}
                onPointerDown={startDrawing}
                onPointerMove={draw}
                onPointerUp={stopDrawing}
                onPointerLeave={stopDrawing}
                className="w-full h-48 sm:h-56 touch-none cursor-crosshair bg-white"
              />
            </div>
          )}

          {/* Live Typed Output Paper (Also supports Apple Pencil Scribble / S-Pen Direct Writing) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-mono uppercase text-zinc-500">
                Formatted Typed Output (Editable & Tablet S-Pen / Apple Scribble Ready)
              </label>
              <span className="text-[11px] font-mono text-zinc-400">
                {typedText.length} CHARS
              </span>
            </div>
            <textarea
              rows={7}
              value={typedText}
              onChange={(e) => setTypedText(e.target.value)}
              placeholder="Your converted handwriting appears here as clean typed text. On iPad (Apple Pencil) or Samsung Tab (S-Pen), you can also write directly inside this box with your stylus!"
              className="w-full p-3.5 text-xs sm:text-sm leading-relaxed font-sans bg-zinc-50/60 border border-zinc-300 rounded-lg focus:bg-white focus:outline-none focus:border-zinc-900"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-zinc-200 bg-zinc-50 flex items-center justify-between">
          <span className="text-[11px] font-mono text-zinc-500">
            FORMAT: ISO A4 • VECTOR TEXT STREAM
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-md text-xs font-medium text-zinc-600 hover:bg-zinc-200/70"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmSave}
              className="flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-white"
            >
              <Check className="w-3.5 h-3.5" />
              Insert Typed Page into PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}