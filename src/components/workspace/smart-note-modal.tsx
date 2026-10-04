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
  Delete,
  Undo2,
} from "lucide-react";

interface SmartNoteModalProps {
  isOpen: boolean;
  insertAfterPage: number;
  initialTitle?: string;
  initialText?: string;
  onClose: () => void;
  onSaveNotePage: (title: string, typedText: string, previewDataUrl: string) => void;
}

interface InkStroke {
  x: number[];
  y: number[];
  t: number[];
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

interface WordCluster {
  strokes: InkStroke[];
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  lineIndex: number;
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
  const [inputMode, setInputMode] = useState<"inkpad" | "continuous">("inkpad");
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [canvasHeight, setCanvasHeight] = useState(340);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const strokesRef = useRef<InkStroke[]>([]);
  const currentStrokeRef = useRef<InkStroke | null>(null);
  const strokeStartEpochRef = useRef<number>(0);

  const [isDrawing, setIsDrawing] = useState(false);
  const [hasInk, setHasInk] = useState(false);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [autoConvert, setAutoConvert] = useState(true);
  const [penSize, setPenSize] = useState(4.5);
  const [wordGapSensitivity, setWordGapSensitivity] = useState(34); // px gap to trigger a new word space
  const [livePreviewSentence, setLivePreviewSentence] = useState<string>("");
  const [detectedWordCount, setDetectedWordCount] = useState<number>(0);
  const [candidates, setCandidates] = useState<string[]>([]);
  const [lastAppendedChunk, setLastAppendedChunk] = useState<string>("");

  const autoCommitTimerRef = useRef<NodeJS.Timeout | null>(null);
  const livePreviewTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    setTitle(initialTitle);
    setTypedText(initialText);
  }, [initialTitle, initialText, isOpen]);

  // Draw ruled baselines + visual word-cluster boxes
  const redrawCanvas = useCallback(
    (highlightClusters: WordCluster[] = []) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Horizontal ruled lines (every 105px)
      ctx.strokeStyle = "#E4E4E7";
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 6]);
      const lineStep = 105;
      for (let y = lineStep; y < canvas.height; y += lineStep) {
        ctx.beginPath();
        ctx.moveTo(20, y);
        ctx.lineTo(canvas.width - 20, y);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Draw subtle green bounding boxes around each detected word so user sees word spaces!
      if (highlightClusters.length > 0) {
        ctx.strokeStyle = "rgba(16, 185, 129, 0.35)";
        ctx.fillStyle = "rgba(16, 185, 129, 0.04)";
        ctx.lineWidth = 1.5;
        highlightClusters.forEach((c, idx) => {
          const bx = Math.max(4, c.minX - 8);
          const by = Math.max(4, c.minY - 8);
          const bw = c.maxX - c.minX + 16;
          const bh = c.maxY - c.minY + 16;
          ctx.fillRect(bx, by, bw, bh);
          ctx.strokeRect(bx, by, bw, bh);

          ctx.fillStyle = "#059669";
          ctx.font = "bold 10px monospace";
          ctx.fillText(`W${idx + 1}`, bx + 2, Math.max(12, by - 3));
          ctx.fillStyle = "rgba(16, 185, 129, 0.04)";
        });
      }

      // Draw all ink strokes smoothly
      ctx.strokeStyle = "#09090B";
      ctx.lineWidth = penSize;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      for (const s of strokesRef.current) {
        if (s.x.length === 0) continue;
        ctx.beginPath();
        ctx.moveTo(s.x[0], s.y[0]);
        if (s.x.length < 3) {
          for (let i = 1; i < s.x.length; i++) {
            ctx.lineTo(s.x[i], s.y[i]);
          }
        } else {
          // Quadratic Bezier smoothing for natural pen curves
          for (let i = 1; i < s.x.length - 1; i++) {
            const midX = (s.x[i] + s.x[i + 1]) / 2;
            const midY = (s.y[i] + s.y[i + 1]) / 2;
            ctx.quadraticCurveTo(s.x[i], s.y[i], midX, midY);
          }
          ctx.lineTo(s.x[s.x.length - 1], s.y[s.y.length - 1]);
        }
        ctx.stroke();
      }
    },
    [penSize]
  );

  const initCanvas = useCallback(() => {
    if (autoCommitTimerRef.current) clearTimeout(autoCommitTimerRef.current);
    if (livePreviewTimerRef.current) clearTimeout(livePreviewTimerRef.current);
    strokesRef.current = [];
    currentStrokeRef.current = null;
    strokeStartEpochRef.current = 0;
    setHasInk(false);
    setLivePreviewSentence("");
    setDetectedWordCount(0);
    redrawCanvas([]);
  }, [redrawCanvas]);

  useEffect(() => {
    if (isOpen && inputMode === "inkpad") {
      setTimeout(() => initCanvas(), 40);
    }
  }, [isOpen, inputMode, canvasHeight, initCanvas]);

  // ============================================================================
  // CORE ALGORITHM: SPATIAL WORD-CLUSTER SEGMENTATION
  // Groups strokes into lines (Y) and words (X-gap) so every word is recognized
  // individually with 100% clean spaces between words!
  // ============================================================================
  const segmentStrokesIntoWordClusters = useCallback(
    (strokes: InkStroke[]): WordCluster[] => {
      if (strokes.length === 0) return [];

      // 1. Group strokes into horizontal writing lines based on vertical center
      const lineStep = 105;
      const lineBuckets = new Map<number, InkStroke[]>();

      for (const s of strokes) {
        const centerY = (s.minY + s.maxY) / 2;
        const lineIdx = Math.floor(centerY / lineStep);
        if (!lineBuckets.has(lineIdx)) {
          lineBuckets.set(lineIdx, []);
        }
        lineBuckets.get(lineIdx)!.push(s);
      }

      const sortedLineIndices = Array.from(lineBuckets.keys()).sort((a, b) => a - b);
      const allClusters: WordCluster[] = [];

      // 2. Within each line, sort strokes left-to-right and split into words when X-gap > threshold
      for (const lineIdx of sortedLineIndices) {
        const lineStrokes = lineBuckets
          .get(lineIdx)!
          .slice()
          .sort((a, b) => a.minX - b.minX);

        let currentCluster: WordCluster | null = null;

        for (const s of lineStrokes) {
          if (!currentCluster) {
            currentCluster = {
              strokes: [s],
              minX: s.minX,
              maxX: s.maxX,
              minY: s.minY,
              maxY: s.maxY,
              lineIndex: lineIdx,
            };
          } else {
            const horizontalGap = s.minX - currentCluster.maxX;
            // If stroke overlaps or is closer than wordGapSensitivity (e.g. dot on 'i', cross on 't', or next letter in same word)
            if (horizontalGap <= wordGapSensitivity) {
              currentCluster.strokes.push(s);
              currentCluster.minX = Math.min(currentCluster.minX, s.minX);
              currentCluster.maxX = Math.max(currentCluster.maxX, s.maxX);
              currentCluster.minY = Math.min(currentCluster.minY, s.minY);
              currentCluster.maxY = Math.max(currentCluster.maxY, s.maxY);
            } else {
              // Gap is larger than threshold -> Start a NEW word!
              allClusters.push(currentCluster);
              currentCluster = {
                strokes: [s],
                minX: s.minX,
                maxX: s.maxX,
                minY: s.minY,
                maxY: s.maxY,
                lineIndex: lineIdx,
              };
            }
          }
        }

        if (currentCluster) {
          allClusters.push(currentCluster);
        }
      }

      return allClusters;
    },
    [wordGapSensitivity]
  );

  // Recognize a single normalized WordCluster via Vector Ink API (with tight coordinate normalization!)
  const recognizeSingleWordCluster = async (
    cluster: WordCluster
  ): Promise<{ best: string; alts: string[] }> => {
    const pad = 20;
    const width = Math.max(60, Math.round(cluster.maxX - cluster.minX + pad * 2));
    const height = Math.max(60, Math.round(cluster.maxY - cluster.minY + pad * 2));
    const baseTime = cluster.strokes[0]?.t[0] || 0;

    // Normalize coordinates so every word starts cleanly near (20, 20) with t=0
    const normalizedInk = cluster.strokes.map((s) => [
      s.x.map((x) => Math.round(x - cluster.minX + pad)),
      s.y.map((y) => Math.round(y - cluster.minY + pad)),
      s.t.map((t) => Math.max(0, t - baseTime)),
    ]);

    const response = await fetch(
      "https://inputtools.google.com/request?ime=handwriting&app=mobilesearch&cs=1&oe=UTF-8",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          options: "enable_pre_space",
          requests: [
            {
              writing_guide: {
                writing_area_width: width,
                writing_area_height: height,
              },
              ink: normalizedInk,
              language: "en",
            },
          ],
        }),
      }
    );

    if (response.ok) {
      const data = await response.json();
      if (data && data[0] === "SUCCESS" && data[1]?.[0]?.[1]?.length > 0) {
        const list: string[] = data[1][0][1];
        return { best: list[0].trim(), alts: list.slice(0, 4) };
      }
    }
    return { best: "", alts: [] };
  };

  // Recognize all word clusters on canvas and join them with clean single spaces!
  const evaluateCanvasWords = useCallback(async (): Promise<{
    sentence: string;
    alternatives: string[];
  }> => {
    const strokes = strokesRef.current;
    if (strokes.length === 0) return { sentence: "", alternatives: [] };

    const clusters = segmentStrokesIntoWordClusters(strokes);
    setDetectedWordCount(clusters.length);
    redrawCanvas(clusters);

    // Recognize every word cluster in parallel for instant speed
    const results = await Promise.all(clusters.map((c) => recognizeSingleWordCluster(c)));

    const words = results.map((r) => r.best).filter(Boolean);
    const fullSentence = words
      .join(" ")
      .replace(/\s+/g, " ")
      .replace(/\s+([.,!?;:])/g, "$1")
      .trim();

    // Build alternative sentence variations from top candidates
    const altSentences: string[] = [];
    if (fullSentence) altSentences.push(fullSentence);
    for (let altIdx = 1; altIdx <= 3; altIdx++) {
      const altWords = results
        .map((r) => (r.alts[altIdx] ? r.alts[altIdx].trim() : r.best))
        .filter(Boolean);
      const altStr = altWords.join(" ").replace(/\s+/g, " ").trim();
      if (altStr && !altSentences.includes(altStr)) {
        altSentences.push(altStr);
      }
    }

    return { sentence: fullSentence, alternatives: altSentences };
  }, [segmentStrokesIntoWordClusters, redrawCanvas]);

  const appendRecognizedText = useCallback((recognized: string, suggestions: string[] = []) => {
    const clean = recognized.replace(/\s+/g, " ").trim();
    if (!clean) return;

    setCandidates(suggestions.length > 0 ? suggestions : [clean]);
    setLastAppendedChunk(clean);

    setTypedText((prev) => {
      if (!prev) return clean;
      if (prev.endsWith("\n") || prev.endsWith(" ")) {
        return `${prev}${clean}`;
      }
      return `${prev} ${clean}`;
    });
  }, []);

  const handleSelectCandidate = (candidate: string) => {
    const cleanCandidate = candidate.trim();
    if (!cleanCandidate) return;

    setTypedText((prev) => {
      if (lastAppendedChunk && prev.endsWith(lastAppendedChunk)) {
        const base = prev.slice(0, prev.length - lastAppendedChunk.length);
        return `${base}${cleanCandidate}`;
      }
      return prev ? `${prev} ${cleanCandidate}` : cleanCandidate;
    });
    setLastAppendedChunk(cleanCandidate);
  };

  // Convert & Commit current canvas words into the document sheet
  const handleConvertInkToText = useCallback(async () => {
    if (strokesRef.current.length === 0 || isRecognizing) return;
    if (autoCommitTimerRef.current) clearTimeout(autoCommitTimerRef.current);
    if (livePreviewTimerRef.current) clearTimeout(livePreviewTimerRef.current);

    setIsRecognizing(true);
    try {
      const { sentence, alternatives } = await evaluateCanvasWords();
      if (sentence) {
        appendRecognizedText(sentence, alternatives);
        initCanvas();
      }
    } catch {
      // Ignore errors
    } finally {
      setIsRecognizing(false);
    }
  }, [isRecognizing, evaluateCanvasWords, appendRecognizedText, initCanvas]);

  if (!isOpen) return null;

  const getCoordinates = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if (strokeStartEpochRef.current === 0) {
      strokeStartEpochRef.current = Date.now();
    }
    return {
      x: Math.round((e.clientX - rect.left) * scaleX),
      y: Math.round((e.clientY - rect.top) * scaleY),
      t: Date.now() - strokeStartEpochRef.current,
    };
  };

  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (autoCommitTimerRef.current) clearTimeout(autoCommitTimerRef.current);
    if (livePreviewTimerRef.current) clearTimeout(livePreviewTimerRef.current);

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    canvas.setPointerCapture(e.pointerId);
    ctx.strokeStyle = "#09090B";
    ctx.lineWidth = penSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const pt = getCoordinates(e);
    currentStrokeRef.current = {
      x: [pt.x],
      y: [pt.y],
      t: [pt.t],
      minX: pt.x,
      maxX: pt.x,
      minY: pt.y,
      maxY: pt.y,
    };

    ctx.beginPath();
    ctx.moveTo(pt.x, pt.y);
    setIsDrawing(true);
    setHasInk(true);
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !currentStrokeRef.current) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;

    const pt = getCoordinates(e);
    const s = currentStrokeRef.current;

    // Filter out sub-pixel jitter (< 2px) for cleaner vector curves
    const lastX = s.x[s.x.length - 1];
    const lastY = s.y[s.y.length - 1];
    if (Math.hypot(pt.x - lastX, pt.y - lastY) < 2) return;

    s.x.push(pt.x);
    s.y.push(pt.y);
    s.t.push(pt.t);
    s.minX = Math.min(s.minX, pt.x);
    s.maxX = Math.max(s.maxX, pt.x);
    s.minY = Math.min(s.minY, pt.y);
    s.maxY = Math.max(s.maxY, pt.y);

    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (currentStrokeRef.current && currentStrokeRef.current.x.length > 0) {
      strokesRef.current.push(currentStrokeRef.current);
      currentStrokeRef.current = null;
    }

    // Show visual green word-cluster boxes immediately
    const clusters = segmentStrokesIntoWordClusters(strokesRef.current);
    setDetectedWordCount(clusters.length);
    redrawCanvas(clusters);

    // 1. Live Ghost Preview after 450ms pause (so user sees exact sentence before it commits!)
    if (livePreviewTimerRef.current) clearTimeout(livePreviewTimerRef.current);
    livePreviewTimerRef.current = setTimeout(async () => {
      if (strokesRef.current.length > 0) {
        const { sentence } = await evaluateCanvasWords();
        setLivePreviewSentence(sentence);
      }
    }, 450);

    // 2. Auto-Commit to page after 2.0s pause (gives plenty of time to dot 'i's or write full sentences!)
    if (autoConvert) {
      if (autoCommitTimerRef.current) clearTimeout(autoCommitTimerRef.current);
      autoCommitTimerRef.current = setTimeout(() => {
        handleConvertInkToText();
      }, 2000);
    }
  };

  const handleUndoLastStroke = () => {
    if (strokesRef.current.length === 0) return;
    if (autoCommitTimerRef.current) clearTimeout(autoCommitTimerRef.current);
    strokesRef.current.pop();
    const clusters = segmentStrokesIntoWordClusters(strokesRef.current);
    setDetectedWordCount(clusters.length);
    setHasInk(strokesRef.current.length > 0);
    redrawCanvas(clusters);
  };

  const handleBackspaceWord = () => {
    setTypedText((prev) => {
      const trimmed = prev.trimEnd();
      const lastSpace = trimmed.lastIndexOf(" ");
      const lastNewline = trimmed.lastIndexOf("\n");
      const cutIdx = Math.max(lastSpace, lastNewline);
      return cutIdx === -1 ? "" : trimmed.slice(0, cutIdx + 1);
    });
  };

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
        appendRecognizedText(transcript);
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
            : "w-full h-full sm:h-auto sm:max-h-[95vh] max-w-5xl sm:rounded-xl"
        }`}
      >
        {/* Top Bar */}
        <div className="px-4 sm:px-6 py-3 border-b border-zinc-200 flex items-center justify-between bg-zinc-50 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded bg-zinc-900 text-white flex items-center justify-center shrink-0">
              <FilePlus className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs sm:text-sm font-semibold text-zinc-900 truncate">
                Smart Word-Cluster Handwriting Studio (After Page #{insertAfterPage})
              </h3>
              <p className="text-[11px] text-zinc-500 hidden sm:block">
                Green Word-Boxes show automatic word segmentation & spacing in real time
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

        {/* Mode & Quick Editing Controls */}
        <div className="px-3 sm:px-6 py-2 bg-white border-b border-zinc-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex flex-wrap items-center gap-1.5">
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
              <span>Stylus Ink Pad (Word-Cluster Engine)</span>
            </button>

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
              <span>Direct Keyboard / Native S-Pen</span>
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
              <span className="hidden sm:inline">{isListening ? "Listening..." : "Voice"}</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setTypedText((prev) => `${prev} `)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-mono bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-medium"
            >
              <Space className="w-3.5 h-3.5" />
              <span>Space</span>
            </button>
            <button
              type="button"
              onClick={handleBackspaceWord}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-mono bg-zinc-100 hover:bg-red-50 hover:text-red-600 text-zinc-800 font-medium"
            >
              <Delete className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Delete Word</span>
            </button>
            <button
              type="button"
              onClick={() => setTypedText((prev) => `${prev}\n`)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-mono bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-medium"
            >
              <CornerDownLeft className="w-3.5 h-3.5" />
              <span>Enter</span>
            </button>
          </div>
        </div>

        {/* Main Workspace Body */}
        <div className="p-3 sm:p-6 overflow-y-auto space-y-3.5 flex-1 bg-[#F8F9FA]">
          <input
            type="text"
            placeholder="Page Heading (e.g. Lecture Notes / Summary)..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3.5 py-2 text-xs sm:text-sm font-semibold bg-white border border-zinc-300 rounded-lg focus:outline-none focus:border-zinc-900"
          />

          {/* Word-Cluster Ink Canvas */}
          {inputMode === "inkpad" && (
            <div className="bg-white border-2 border-zinc-300 rounded-xl overflow-hidden shadow-xs">
              <div className="bg-zinc-100 px-3 sm:px-4 py-2 border-b border-zinc-200 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoConvert}
                      onChange={(e) => setAutoConvert(e.target.checked)}
                      className="rounded accent-zinc-900"
                    />
                    <span>Auto-Type (2.0s pause)</span>
                  </label>

                  {/* Word Space Sensitivity Control */}
                  <div className="flex items-center gap-1.5 text-xs text-zinc-600">
                    <span className="font-mono text-[10px] uppercase">Word Gap:</span>
                    <select
                      value={wordGapSensitivity}
                      onChange={(e) => setWordGapSensitivity(Number(e.target.value))}
                      className="px-2 py-0.5 text-xs bg-white border border-zinc-300 rounded"
                    >
                      <option value={22}>Tight Writing (22px)</option>
                      <option value={34}>Normal Spacing (34px)</option>
                      <option value={50}>Wide Spacing (50px)</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleUndoLastStroke}
                    disabled={!hasInk}
                    className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium bg-white border border-zinc-300 hover:bg-zinc-50 disabled:opacity-40 text-zinc-700"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                    Undo Stroke
                  </button>

                  <button
                    type="button"
                    onClick={() => setCanvasHeight((h) => (h < 540 ? h + 140 : 340))}
                    className="px-2.5 py-1 rounded text-xs font-medium bg-white border border-zinc-300 hover:bg-zinc-50 text-zinc-700"
                  >
                    {canvasHeight < 540 ? "+ Expand Pad" : "Compact Pad"}
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
                    {isRecognizing ? "Reading..." : "Insert Words Now"}
                  </button>
                </div>
              </div>

              {/* Live Ghost Preview & Word Counter Bar */}
              {(livePreviewSentence || detectedWordCount > 0 || candidates.length > 0) && (
                <div className="px-3 sm:px-4 py-1.5 bg-emerald-50/70 border-b border-zinc-200 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-emerald-600 text-white shrink-0">
                      {detectedWordCount} {detectedWordCount === 1 ? "WORD" : "WORDS"}
                    </span>
                    {livePreviewSentence && (
                      <span className="text-xs font-semibold text-zinc-900 truncate">
                        Preview: &ldquo;{livePreviewSentence}&rdquo;
                      </span>
                    )}
                  </div>

                  {candidates.length > 0 && (
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                      <span className="font-mono text-[10px] text-zinc-500 shrink-0">Tap to fix:</span>
                      {candidates.map((cand, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSelectCandidate(cand)}
                          className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-all shrink-0 ${
                            cand === lastAppendedChunk
                              ? "bg-zinc-900 text-white"
                              : "bg-white border border-zinc-300 text-zinc-700 hover:border-zinc-900"
                          }`}
                        >
                          {cand}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="relative w-full overflow-hidden">
                <canvas
                  ref={canvasRef}
                  width={1000}
                  height={canvasHeight}
                  onPointerDown={startDrawing}
                  onPointerMove={draw}
                  onPointerUp={stopDrawing}
                  onPointerCancel={stopDrawing}
                  style={{ height: `${canvasHeight}px`, touchAction: "none" }}
                  className="w-full cursor-crosshair bg-white block select-none"
                />
                {isRecognizing && (
                  <div className="absolute top-2 right-3 bg-zinc-900 text-white px-2.5 py-1 rounded-md font-mono text-[10px] shadow-sm">
                    SEGMENTING & RECOGNIZING WORDS...
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Formatted Typed Output Sheet */}
          <div className="bg-white border border-zinc-300 rounded-xl p-3.5 sm:p-5 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2 pb-1.5 border-b border-zinc-100">
              <span className="text-xs font-semibold text-zinc-800">
                📄 Live Typed Document Page (Editable):
              </span>
              <span className="font-mono text-[11px] text-zinc-400">
                {typedText.length} CHARS
              </span>
            </div>

            <textarea
              ref={textareaRef}
              rows={inputMode === "continuous" ? 13 : 6}
              value={typedText}
              onChange={(e) => setTypedText(e.target.value)}
              placeholder="Write words or full sentences on the pad above — each word is boxed in green (`W1`, `W2`, `W3`) and joined with clean spaces automatically!"
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
          <span className="text-[11px] font-mono text-zinc-500 hidden sm:inline">
            SPATIAL WORD-CLUSTER ENGINE • AUTO MULTI-PAGE OVERFLOW
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