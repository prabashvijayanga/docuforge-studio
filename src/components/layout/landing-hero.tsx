"use client";
import React from "react";
import { ConvertDirection, ConvertTargetFormat, ToolMode } from "@/types/document";
import {
  FileText,
  Image,
  Layers,
  Minimize2,
  RefreshCw,
  ArrowRightLeft,
  PenTool,
  ShieldCheck,
  Zap,
  Cpu,
  ArrowUpRight,
  Sparkles,
  CheckCircle2,
} from "lucide-react";

interface LandingHeroProps {
  engineOnline: boolean;
  onLaunchTool: (
    tool: ToolMode,
    convertDir?: ConvertDirection,
    convertFmt?: ConvertTargetFormat
  ) => void;
}

export function LandingHero({ engineOnline, onLaunchTool }: LandingHeroProps) {
  const TOOL_CARDS = [
    {
      id: "organize" as ToolMode,
      badge: "MOST POPULAR",
      title: "Organize, Split & Smart Notes",
      desc: "Reorder pages via drag-and-drop, remove page ranges, rotate sheets, or insert handwritten-to-typed Smart Note pages anywhere.",
      icon: <FileText className="w-5 h-5" />,
      formats: ["REORDER", "RANGE SPLIT", "SMART INK NOTES", "WATERMARK"],
      actionLabel: "Open Page Studio",
    },

    {
      id: "study" as ToolMode,
      badge: "STUDENT FAVORITE",
      title: "Short Notes & Quiz Generator",
      desc: "Upload any lecture PDF, PowerPoint (.PPTX), or Word handout to automatically generate a structured revision Short Note and an interactive MCQ Practice Quiz.",
      icon: <Sparkles className="w-5 h-5" />,
      formats: ["SHORT NOTES", "AUTO MCQ QUIZ", "DEFINITIONS", "PDF EXPORT"],
      actionLabel: "Generate Study Pack",
    },
    
    {
      id: "convert" as ToolMode,
      convertDir: "pdf_to_other" as ConvertDirection,
      badge: "7 EXPORT ENGINES",
      title: "PDF to Office & Code",
      desc: "Convert PDF documents into editable Microsoft Word, Widescreen PowerPoint slides, Excel tables, Markdown, HTML5, or PNG archives.",
      icon: <RefreshCw className="w-5 h-5" />,
      formats: [".DOCX", ".PPTX", ".XLSX", ".MD", ".HTML", ".TXT", ".ZIP"],
      actionLabel: "Convert from PDF",
    },
    {
      id: "convert" as ToolMode,
      convertDir: "other_to_pdf" as ConvertDirection,
      badge: "REVERSE ENGINE",
      title: "Office & Docs to PDF",
      desc: "Transform Word documents, PowerPoint presentations, Excel spreadsheets, Markdown, and HTML files into standardized ISO PDFs.",
      icon: <ArrowRightLeft className="w-5 h-5" />,
      formats: ["PPTX → PDF", "DOCX → PDF", "XLSX → PDF", "MD → PDF"],
      actionLabel: "Convert to PDF",
    },
    {
      id: "img2pdf" as ToolMode,
      badge: "CLIENT-SIDE TURBO",
      title: "Images to PDF Compiler",
      desc: "Compile high-resolution JPG, PNG, and WebP photos into A4 or original-dimension PDF sheets directly in your browser with zero upload limits.",
      icon: <Image className="w-5 h-5" />,
      formats: ["JPG", "PNG", "WEBP", "100MB+ SUPPORT"],
      actionLabel: "Compile Images",
    },
    {
      id: "merge" as ToolMode,
      badge: "INSTANT MERGE",
      title: "Merge Multiple PDFs",
      desc: "Combine multiple PDF documents, lecture slides, and reports into a single unified file in seconds without server payload restrictions.",
      icon: <Layers className="w-5 h-5" />,
      formats: ["MULTI-FILE", "ZERO QUALITY LOSS", "LOCAL ENGINE"],
      actionLabel: "Merge Documents",
    },
    {
      id: "compress" as ToolMode,
      badge: "SIZE OPTIMIZER",
      title: "Compress & Optimize PDF",
      desc: "Reduce PDF file size for email and portal submissions with Light, Recommended (110 DPI), or Extreme (72 DPI) compression profiles.",
      icon: <Minimize2 className="w-5 h-5" />,
      formats: ["LIGHT 85%", "BALANCED 65%", "EXTREME 40%"],
      actionLabel: "Compress PDF",
    },
  ];

  const QUICK_CONVERTERS: {
    label: string;
    sub: string;
    dir: ConvertDirection;
    fmt?: ConvertTargetFormat;
  }[] = [
    { label: "PDF → Word (.DOCX)", sub: "Editable text", dir: "pdf_to_other", fmt: "docx" },
    { label: "PDF → PowerPoint (.PPTX)", sub: "16:9 slides", dir: "pdf_to_other", fmt: "pptx" },
    { label: "PDF → Excel (.XLSX)", sub: "Table extractor", dir: "pdf_to_other", fmt: "xlsx" },
    { label: "PDF → Markdown (.MD)", sub: "For Notion/AI", dir: "pdf_to_other", fmt: "md" },
    { label: "PDF → Web (.HTML)", sub: "Responsive page", dir: "pdf_to_other", fmt: "html" },
    { label: "PDF → Images (.ZIP)", sub: "150 DPI PNGs", dir: "pdf_to_other", fmt: "png_zip" },
    { label: "PPTX / DOCX → PDF", sub: "Reverse engine", dir: "other_to_pdf" },
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-[#F8F9FA]">
      {/* 1. HERO SECTION */}
      <section className="bg-white border-b border-zinc-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
          <div className="flex flex-wrap items-center gap-2 mb-5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-medium bg-zinc-100 text-zinc-800 border border-zinc-200">
              <span
                className={`w-2 h-2 rounded-full ${
                  engineOnline ? "bg-emerald-600" : "bg-amber-500"
                }`}
              />
              {engineOnline ? "HYBRID PYTHON + WASM ENGINE ONLINE" : "CLIENT-SIDE ENGINE READY"}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono text-zinc-500 bg-zinc-50 border border-zinc-200">
              ZERO-STORAGE PRIVACY
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 space-y-4">
              <h1 className="text-2xl sm:text-4xl lg:text-[42px] font-bold tracking-tight text-zinc-900 leading-[1.15]">
                Precision Document Engineering & Smart PDF Studio.
              </h1>
              <p className="text-sm sm:text-base text-zinc-600 leading-relaxed max-w-2xl">
                A unified workspace to organize 100+ page PDFs, write with a tablet stylus to insert{" "}
                <span className="font-semibold text-zinc-900">auto-typed note pages</span>, and
                convert bi-directionally across Word, PowerPoint, Excel, Markdown, and Images.
              </p>

              <div className="pt-2 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => onLaunchTool("organize")}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs sm:text-sm font-semibold bg-zinc-900 hover:bg-zinc-800 text-white transition-all shadow-xs"
                >
                  <span>Open PDF Workspace</span>
                  <ArrowUpRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onLaunchTool("convert", "pdf_to_other", "docx")}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs sm:text-sm font-semibold bg-zinc-100 hover:bg-zinc-200 text-zinc-800 transition-all"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Explore 13+ Converters</span>
                </button>
              </div>
            </div>

            {/* Interactive Feature Spotlight Card: Smart Handwriting-to-Typed Page */}
            <div className="lg:col-span-5">
              <div className="bg-zinc-950 text-white rounded-xl p-5 border border-zinc-800 shadow-lg">
                <div className="flex items-center justify-between mb-3">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    <Sparkles className="w-3 h-3" />
                    Signature Feature
                  </span>
                  <span className="font-mono text-[10px] text-zinc-400">STYLUS / S-PEN / MOUSE</span>
                </div>

                <h3 className="text-sm sm:text-base font-semibold mb-1.5">
                  Handwriting-to-Typed Note Pages
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed mb-4">
                  Insert a blank sheet anywhere inside a lecture slide or PDF. Write naturally with your stylus—our Spatial Word-Cluster Engine boxes each word and converts it into crisp vector text.
                </p>

                {/* Visual Mockup of W1, W2 Word Cluster Boxes */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 mb-4 font-mono text-xs">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-700 text-emerald-300 text-[10px]">
                      W1: Second
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-700 text-emerald-300 text-[10px]">
                      W2: Law
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-700 text-emerald-300 text-[10px]">
                      W3: Notes
                    </span>
                  </div>
                  <div className="text-[11px] text-zinc-300 border-t border-zinc-800 pt-2">
                    → Output: <span className="text-white font-sans font-medium">&ldquo;Second Law Notes&rdquo;</span> (Vector A4 PDF)
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onLaunchTool("organize")}
                  className="w-full py-2 px-3 rounded-lg bg-white hover:bg-zinc-100 text-zinc-900 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <PenTool className="w-3.5 h-3.5" />
                  <span>Try Smart Note Insertion</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. ALL WORKSPACE TOOLS BENTO GRID */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-12">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-6 gap-2">
          <div>
            <h2 className="text-base sm:text-xl font-bold text-zinc-900 tracking-tight">
              Select a Document Tool to Begin
            </h2>
            <p className="text-xs sm:text-sm text-zinc-500">
              Click any module below to jump straight into its dedicated processing workspace
            </p>
          </div>
          <span className="font-mono text-[11px] text-zinc-400">6 CORE WORKFLOWS AVAILABLE</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {TOOL_CARDS.map((card, i) => (
            <div
              key={i}
              onClick={() => onLaunchTool(card.id, card.convertDir)}
              className="group bg-white border border-zinc-200/90 hover:border-zinc-900 rounded-xl p-5 flex flex-col justify-between cursor-pointer transition-all hover:shadow-md"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-lg bg-zinc-100 group-hover:bg-zinc-900 group-hover:text-white text-zinc-800 flex items-center justify-center transition-colors">
                    {card.icon}
                  </div>
                  <span className="font-mono text-[10px] font-semibold px-2 py-0.5 rounded bg-zinc-100 text-zinc-600 border border-zinc-200">
                    {card.badge}
                  </span>
                </div>

                <h3 className="text-sm sm:text-base font-bold text-zinc-900 mb-1.5 group-hover:underline">
                  {card.title}
                </h3>
                <p className="text-xs text-zinc-500 leading-relaxed mb-4">{card.desc}</p>
              </div>

              <div>
                <div className="flex flex-wrap gap-1 mb-4">
                  {card.formats.map((f, idx) => (
                    <span
                      key={idx}
                      className="font-mono text-[10px] px-1.5 py-0.5 bg-zinc-50 border border-zinc-200/80 text-zinc-600 rounded"
                    >
                      {f}
                    </span>
                  ))}
                </div>

                <div className="pt-3 border-t border-zinc-100 flex items-center justify-between text-xs font-semibold text-zinc-900">
                  <span>{card.actionLabel}</span>
                  <ArrowUpRight className="w-4 h-4 text-zinc-400 group-hover:text-zinc-900 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 3. ONE-CLICK FORMAT CONVERTER MATRIX */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-10">
        <div className="bg-white border border-zinc-200 rounded-xl p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-zinc-900">
                Quick-Launch Format Converters
              </h3>
              <p className="text-xs text-zinc-500">
                Jump directly to a pre-configured document conversion pipeline
              </p>
            </div>
            <span className="font-mono text-[11px] text-zinc-400">BI-DIRECTIONAL ENGINE</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2.5">
            {QUICK_CONVERTERS.map((qc, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onLaunchTool("convert", qc.dir, qc.fmt)}
                className="p-3 rounded-lg border border-zinc-200 hover:border-zinc-900 hover:bg-zinc-50 text-left transition-all group"
              >
                <div className="font-mono text-xs font-bold text-zinc-900 group-hover:underline">
                  {qc.label}
                </div>
                <div className="text-[11px] text-zinc-500 mt-0.5">{qc.sub}</div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 4. HOW IT WORKS & ARCHITECTURE SPECS */}
      <section className="bg-white border-t border-zinc-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex items-start gap-3.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-100 text-zinc-900 flex items-center justify-center shrink-0 mt-0.5">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-zinc-900 mb-1">
                01. Client-Side Acceleration
              </h4>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Page organization, Smart Note generation, Image-to-PDF, and PDF Merging run directly in your browser memory—bypassing cloud upload limits completely.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-100 text-zinc-900 flex items-center justify-center shrink-0 mt-0.5">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-zinc-900 mb-1">
                02. Python PyMuPDF + OpenXML
              </h4>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Deep structural conversions (.DOCX, .PPTX, .XLSX, .MD, .HTML) and DPI stream compression are powered by our high-speed FastAPI backend.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-100 text-zinc-900 flex items-center justify-center shrink-0 mt-0.5">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-zinc-900 mb-1">
                03. Zero-Storage Ephemeral Stream
              </h4>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Your documents are never saved to any database or disk. Every file is processed in volatile RAM streams and purged immediately upon download.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}