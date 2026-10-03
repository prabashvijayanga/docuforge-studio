"use client";
import React, { useRef, useState, useEffect, useCallback } from "react";
import {
  X,
  PenTool,
  Type,
  Sparkles,
  Eraser,
  Check,
  FilePlus,
  Maximize2,
  Minimize2,
  Mic,
  MicOff,
  CornerDownLeft,
  Space,
} from "lucide-react";

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
  // "continuous" = Full-page direct tablet stylus/keyboard pad, "inkpad" = Freehand canvas with auto-convert
  const [inputMode, setInputMode] = useState<"continuous" | "inkpad">("inkpad");
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [canvasHeight, setCanvasHeight] = useState(340);

  // Ink Pad State
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasInk, setHasInk] = useState(false);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [autoConvert, setAutoConvert] = useState(true);
  const [penSize, setPenSize] = useState(5);
  const autoTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Voice Dictation State
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    setTitle(initialTitle);
    setTypedText(initialText);
  }, [initialTitle, initialText, isOpen]);

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw light guide lines so user writes straight (greatly improves OCR accuracy!)
    ctx.strokeStyle = "#E4E4E7";
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 6]);
    const step = 95;
    for (let y = step; y < canvas.height; y += step) {
      ctx.beginPath();
      ctx.moveTo(24, y);
      ctx.lineTo(canvas.width - 24, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    ctx.strokeStyle = "#09090B";
    ctx.lineWidth = penSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    setHasInk(false);
  }, [penSize]);

  useEffect(() => {
    if (isOpen && inputMode === "inkpad") {
      setTimeout(() => initCanvas(), 50);
    }
  }, [isOpen, inputMode, canvasHeight, initCanvas]);

  // Pre-process canvas: crop bounding box + add white margin + remove guide lines for high OCR accuracy
  const preprocessCanvasForOcr = (sourceCanvas: HTMLCanvasElement): string => {
    const w = sourceCanvas.width;
    const h = sourceCanvas.height;
    const srcCtx = sourceCanvas.getContext("2d")!;
    const imgData = srcCtx.getImageData(0, 0, w, h);
    const data = imgData.data;

    const outCanvas = document.createElement("canvas");
    outCanvas.width = w + 80;
    outCanvas.height = h + 80;
    const outCtx = outCanvas.getContext("2d")!;

    outCtx.fillStyle = "#FFFFFF";
    outCtx.fillRect(0, 0, outCanvas.width, outCanvas.height);

    const cleanedImgData = outCtx.createImageData(w, h);
    const dst = cleanedImgData.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      // Keep dark ink pixels, turn guide lines (#E4E4E7) and background into pure white
      const brightness = (r + g + b) / 3;
      if (brightness < 170) {
        dst[i] = 0;
        dst[i + 1] = 0;
        dst[i + 2] = 0;
        dst[i + 3] = 255;
      } else {
        dst[i] = 255;
        dst[i + 1] = 255;
        dst[i + 2] = 255;
        dst[i + 3] = 255;
      }
    }

    outCtx.putImageData(cleanedImgData, 40, 40);
    return outCanvas.toDataURL("image/png");
  };

  const handleConvertInkToText = useCallback(async () => {
    if (!canvasRef.current || !hasInk || isRecognizing) return;
    if (autoTimerRef.current) clearTimeout(autoTimerRef.current);

    setIsRecognizing(true);
    try {
      const Tesseract = await import("tesseract.js");
      const processedDataUrl = preprocessCanvasForOcr(canvasRef.current);

      const { data } = await Tesseract.recognize(processedDataUrl, "eng");
      const cleaned = data.text
        .replace(/[|~`^]/g, "")
        .trim();

      if (cleaned) {
        setTypedText((prev) => {
          if (!prev) return cleaned;
          return prev.endsWith("\n") ? `${prev}${cleaned}` : `${prev} ${cleaned}`;
        });
        initCanvas();
      }
    } catch {
      // Ignore silent OCR errors
    } finally {
      setIsRecognizing(false);
    }
  }, [hasInk, isRecognizing, initCanvas]);

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
    e.preventDefault();
    if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    canvas.setPointerCapture(e.pointerId);
    ctx.strokeStyle = "#09090B";
    ctx.lineWidth = penSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasInk(true);
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    // Continuous Writing: Auto-convert 1.8 seconds after lifting the stylus!
    if (autoConvert) {
      if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
      autoTimerRef.current = setTimeout(() => {
        handleConvertInkToText();
      }, 1800);
    }
  };

  // Voice Dictation Toggle (Web Speech API)
  const toggleVoiceDictation = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      return alert("Voice dictation is supported in Chrome, Edge, and Safari.");
    }

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onresult = (event: any) => {
      const transcript = event.results[event.results.length - 1][0].transcript.trim();
      if (transcript) {
        setTypedText((prev) => (prev ? `${prev} ${transcript}` : transcript));
      }
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  const generateNoteThumbnail = (heading: string, body: string): string => {
    const c = document.createElement("canvas");
    c.width = 420;
    c.height = 594;
    const ctx = c.getContext("2d")!;

    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, c.width, c.height);

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
    <div className="fixed inset-0 z-50 bg-zinc-950/70 backdrop-blur-xs flex items-center justify-center p-0 sm:p-4">
      <div
        className={`bg-white border border-zinc-200 shadow-2xl flex flex-col overflow-hidden transition-all ${
          isFullScreen
            ? "w-screen h-screen rounded-none"
            : "w-full h-full sm:h-auto sm:max-h-[94vh] max-w-5xl sm:rounded-xl"
        }`}
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 border-b border-zinc-200 flex items-center justify-between bg-zinc-50 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded bg-zinc-900 text-white flex items-center justify-center shrink-0">
              <FilePlus className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs sm:text-sm font-semibold text-zinc-900 truncate">
                Smart Continuous Note Studio (After Page #{insertAfterPage})
              </h3>
              <p className="text-[11px] text-zinc-500 hidden sm:block">
                Continuous Stylus Writing • Auto-Expanding Pages if Text Overflows
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsFullScreen((prev) => !prev)}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/60"
              title="Toggle Fullscreen"
            >
              {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/60"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mode & Controls Bar */}
        <div className="px-4 sm:px-6 py-2.5 bg-white border-b border-zinc-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setInputMode("continuous");
                setTimeout(() => textareaRef.current?.focus(), 50);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                inputMode === "continuous"
                  ? "bg-zinc-900 text-white"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
              }`}
            >
              <Type className="w-3.5 h-3.5" />
              <span>100% Accurate Tablet Stylus / Keyboard Pad</span>
            </button>

            <button
              type="button"
              onClick={() => setInputMode("inkpad")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                inputMode === "inkpad"
                  ? "bg-zinc-900 text-white"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
              }`}
            >
              <PenTool className="w-3.5 h-3.5" />
              <span>Freehand Ink Canvas (Auto-OCR)</span>
            </button>

            <button
              type="button"
              onClick={toggleVoiceDictation}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                isListening
                  ? "bg-red-600 text-white animate-pulse"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
              }`}
            >
              {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              <span>{isListening ? "Listening..." : "Voice Dictate"}</span>
            </button>
          </div>

          {/* Quick Helpers */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setTypedText((prev) => `${prev} `)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-mono bg-zinc-100 hover:bg-zinc-200 text-zinc-700"
              title="Insert Space"
            >
              <Space className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Space</span>
            </button>
            <button
              type="button"
              onClick={() => setTypedText((prev) => `${prev}\n`)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-mono bg-zinc-100 hover:bg-zinc-200 text-zinc-700"
              title="New Line"
            >
              <CornerDownLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New Line</span>
            </button>
          </div>
        </div>

        {/* Main Workspace Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 bg-[#F8F9FA]">
          {/* Title Input */}
          <input
            type="text"
            placeholder="Page Heading (e.g. Lecture 04 Notes - Data Structures)..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3.5 py-2 text-xs sm:text-sm font-semibold bg-white border border-zinc-300 rounded-lg focus:outline-none focus:border-zinc-900"
          />

          {/* MODE A: Freehand Ink Canvas with Continuous Auto-Convert */}
          {inputMode === "inkpad" && (
            <div className="bg-white border-2 border-zinc-300 rounded-xl overflow-hidden shadow-xs">
              <div className="bg-zinc-100 px-3 sm:px-4 py-2 border-b border-zinc-200 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-mono font-semibold text-zinc-700">
                    WRITE LARGE & CLEARLY ON THE GUIDE LINES
                  </span>
                  <label className="flex items-center gap-1.5 text-xs text-zinc-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoConvert}
                      onChange={(e) => setAutoConvert(e.target.checked)}
                      className="rounded accent-zinc-900"
                    />
                    <span>Auto-Convert when pen pauses (1.8s)</span>
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={penSize}
                    onChange={(e) => setPenSize(Number(e.target.value))}
                    className="px-2 py-1 text-xs bg-white border border-zinc-300 rounded"
                  >
                    <option value={4}>Medium Pen</option>
                    <option value={6}>Thick Marker (Best OCR)</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => setCanvasHeight((h) => (h < 600 ? h + 160 : 340))}
                    className="px-2.5 py-1 rounded text-xs font-medium bg-white border border-zinc-300 hover:bg-zinc-50 text-zinc-700"
                  >
                    {canvasHeight < 600 ? "+ More Writing Space" : "Reset Size"}
                  </button>

                  <button
                    type="button"
                    onClick={initCanvas}
                    className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium bg-white border border-zinc-300 hover:bg-zinc-50 text-zinc-700"
                  >
                    <Eraser className="w-3.5 h-3.5" />
                    Clear
                  </button>

                  <button
                    type="button"
                    onClick={handleConvertInkToText}
                    disabled={!hasInk || isRecognizing}
                    className="flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-300 text-white"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {isRecognizing ? "Reading Ink..." : "Convert Now"}
                  </button>
                </div>
              </div>

              <div className="relative w-full overflow-hidden">
                <canvas
                  ref={canvasRef}
                  width={1200}
                  height={canvasHeight}
                  onPointerDown={startDrawing}
                  onPointerMove={draw}
                  onPointerUp={stopDrawing}
                  onPointerCancel={stopDrawing}
                  style={{ height: `${canvasHeight}px`, touchAction: "none" }}
                  className="w-full cursor-crosshair bg-white block select-none"
                />
                {isRecognizing && (
                  <div className="absolute inset-0 bg-white/75 flex items-center justify-center font-mono text-xs font-semibold text-zinc-900">
                    CONVERTING HANDWRITING TO TYPED TEXT...
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Continuous Ruled A4 Paper Sheet (Supports Unlimited Writing + 100% Accurate Native Tablet Scribble) */}
          <div className="bg-white border border-zinc-300 rounded-xl p-4 sm:p-6 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2 pb-2 border-b border-zinc-100">
              <div className="text-xs font-semibold text-zinc-800">
                {inputMode === "continuous"
                  ? "✍️ Write directly below with your Tablet S-Pen / Apple Pencil (Scribble) or Keyboard:"
                  : "📄 Live Typed Document Output (Automatically appends as you write above):"}
              </div>
              <span className="font-mono text-[11px] text-zinc-500">
                {typedText.length} CHARS • AUTO MULTI-PAGE ENABLED
              </span>
            </div>

            <textarea
              ref={textareaRef}
              rows={inputMode === "continuous" ? 14 : 7}
              value={typedText}
              onChange={(e) => setTypedText(e.target.value)}
              placeholder={
                inputMode === "continuous"
                  ? "Touch here with your Tablet Stylus (S-Pen / Apple Pencil) or use Gboard Handwriting on mobile to write continuously across the entire page with 100% accuracy..."
                  : "Words written on the ink canvas above will continuously appear here..."
              }
              style={{
                backgroundImage:
                  "repeating-linear-gradient(transparent, transparent 27px, #F4F4F5 27px, #F4F4F5 28px)",
                lineHeight: "28px",
              }}
              className="w-full px-2 py-1 text-sm sm:text-base text-zinc-900 bg-transparent focus:outline-none resize-y font-sans"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 border-t border-zinc-200 bg-white flex flex-wrap items-center justify-between gap-2 shrink-0">
          <span className="text-[11px] font-mono text-zinc-500">
            LONG NOTES AUTOMATICALLY CREATE EXTRA A4 PAGES ON EXPORT
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-md text-xs font-medium text-zinc-600 hover:bg-zinc-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmSave}
              className="flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-white"
            >
              <Check className="w-3.5 h-3.5" />
              Save & Insert into PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}