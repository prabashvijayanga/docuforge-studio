"use client";
import React, { useState } from "react";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { StudyPackResponse } from "@/types/document";
import {
  BookOpen,
  HelpCircle,
  Download,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Sparkles,
  Clock,
  FileText,
  Award,
} from "lucide-react";

interface StudyPackViewProps {
  data: StudyPackResponse;
  onReset: () => void;
}

function wrapLine(text: string, maxChars = 82): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    if ((current + " " + w).trim().length <= maxChars) {
      current = (current + " " + w).trim();
    } else {
      if (current) lines.push(current);
      current = w;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
}

export function StudyPackView({ data, onReset }: StudyPackViewProps) {
  const [activeTab, setActiveTab] = useState<"notes" | "quiz">("notes");
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [showResults, setShowResults] = useState(false);

  const handleSelectOption = (qId: number, optIdx: number) => {
    if (showResults) return;
    setSelectedAnswers((prev) => ({ ...prev, [qId]: optIdx }));
  };

  const totalQuestions = data.quiz.length;
  const answeredCount = Object.keys(selectedAnswers).length;
  const correctCount = data.quiz.reduce((acc, q) => {
    return acc + (selectedAnswers[q.id] === q.correctIndex ? 1 : 0);
  }, 0);

  // Export clean printable PDF of either the Short Note or the Practice Quiz!
  const handleDownloadStudyPdf = async (mode: "short_note" | "quiz_sheet") => {
    const pdfDoc = await PDFDocument.create();
    const fontReg = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const pw = 595.28;
    const ph = 841.89;
    let page = pdfDoc.addPage([pw, ph]);
    let y = ph - 50;

    const ensureSpace = (needed: number) => {
      if (y - needed < 50) {
        page = pdfDoc.addPage([pw, ph]);
        y = ph - 50;
      }
    };

    const drawWrapped = (text: string, size: number, bold = false, indent = 45, color = rgb(0.12, 0.12, 0.15)) => {
      const clean = text.replace(/[^\x20-\x7E\n]/g, "");
      const lines = wrapLine(clean, bold ? 72 : 82);
      for (const ln of lines) {
        ensureSpace(size + 8);
        page.drawText(ln, {
          x: indent,
          y,
          size,
          font: bold ? fontBold : fontReg,
          color,
        });
        y -= size + 6;
      }
    };

    if (mode === "short_note") {
      drawWrapped(`SHORT NOTE: ${data.documentTitle.toUpperCase()}`, 16, true, 45, rgb(0.05, 0.05, 0.08));
      drawWrapped(
        `Pages: ${data.pageCount}  |  Words: ${data.wordCount}  |  Est. Revision Time: ${data.readingTimeMinutes} min`,
        9.5,
        false,
        45,
        rgb(0.45, 0.45, 0.5)
      );
      y -= 10;

      if (data.keyTopics.length > 0) {
        drawWrapped("KEY CONCEPTS & TOPICS", 12, true);
        drawWrapped(data.keyTopics.join("  •  "), 10, false, 45);
        y -= 10;
      }

      if (data.definitions.length > 0) {
        drawWrapped("IMPORTANT DEFINITIONS & FORMULAS", 12, true);
        for (const d of data.definitions) {
          drawWrapped(`• ${d.term} (P.${d.page}): ${d.meaning}`, 10, false, 52);
        }
        y -= 10;
      }

      drawWrapped("HIGH-YIELD REVISION NOTES BY SECTION", 12, true);
      for (const sec of data.sections) {
        y -= 4;
        drawWrapped(`${sec.heading} (Page ${sec.page})`, 11, true, 45);
        for (const b of sec.bullets) {
          drawWrapped(`- ${b}`, 10, false, 55);
        }
      }
    } else {
      drawWrapped(`PRACTICE QUIZ: ${data.documentTitle.toUpperCase()}`, 16, true);
      drawWrapped(`Total Questions: ${data.quiz.length} Multiple-Choice Questions`, 10, false);
      y -= 12;

      data.quiz.forEach((q, idx) => {
        ensureSpace(90);
        drawWrapped(`Q${idx + 1}. ${q.question.replace(/\n/g, " ")}`, 10.5, true, 45);
        q.options.forEach((opt, oIdx) => {
          const letter = String.fromCharCode(65 + oIdx);
          drawWrapped(`${letter}) ${opt}`, 10, false, 60);
        });
        y -= 8;
      });

      // Answer Key at the bottom
      ensureSpace(120);
      y -= 12;
      drawWrapped("ANSWER KEY & EXPLANATIONS", 13, true);
      data.quiz.forEach((q, idx) => {
        const correctLetter = String.fromCharCode(65 + q.correctIndex);
        drawWrapped(
          `Q${idx + 1}: ${correctLetter} (${q.options[q.correctIndex]}) — ${q.explanation}`,
          9.5,
          false,
          45
        );
      });
    }

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download =
      mode === "short_note"
        ? `${data.documentTitle}_Short_Note.pdf`
        : `${data.documentTitle}_Practice_Quiz.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-[#F8F9FA]">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Top Summary Header Card */}
        <div className="bg-white border border-zinc-200 rounded-xl p-5 sm:p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-100">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 mb-2">
                <Sparkles className="w-3 h-3" />
                Smart Study Pack Generated
              </div>
              <h2 className="text-lg sm:text-2xl font-bold text-zinc-900 tracking-tight">
                {data.documentTitle}
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleDownloadStudyPdf("short_note")}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-white transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span> Short Note PDF</span>
              </button>
              <button
                type="button"
                onClick={() => handleDownloadStudyPdf("quiz_sheet")}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border border-zinc-200 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Quiz PDF</span>
              </button>
              <button
                type="button"
                onClick={onReset}
                className="p-2 rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100"
                title="Upload another document"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Telemetry & Mode Switcher */}
          <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-zinc-500">
              <span className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-zinc-400" />
                {data.pageCount} PAGES ANALYZED
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-zinc-400" />
                ~{data.readingTimeMinutes} MIN REVISION
              </span>
            </div>

            <div className="inline-flex bg-zinc-100 p-1 rounded-lg border border-zinc-200">
              <button
                type="button"
                onClick={() => setActiveTab("notes")}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  activeTab === "notes"
                    ? "bg-white text-zinc-900 shadow-xs"
                    : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Structured Short Note ({data.sections.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("quiz")}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  activeTab === "quiz"
                    ? "bg-white text-zinc-900 shadow-xs"
                    : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Interactive Quiz ({data.quiz.length} MCQs)</span>
              </button>
            </div>
          </div>
        </div>

        {/* TAB 1: STRUCTURED SHORT NOTE */}
        {activeTab === "notes" && (
          <div className="space-y-5">
            {/* Key Topics Cloud */}
            {data.keyTopics.length > 0 && (
              <div className="bg-white border border-zinc-200 rounded-xl p-5">
                <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-400 mb-3">
                  Core Concepts & Keywords
                </h3>
                <div className="flex flex-wrap gap-2">
                  {data.keyTopics.map((topic, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-800 border border-zinc-200"
                    >
                      #{topic}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Key Definitions & Formulas */}
            {data.definitions.length > 0 && (
              <div className="bg-white border border-zinc-200 rounded-xl p-5">
                <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-400 mb-3">
                  Key Definitions, Laws & Formulas
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {data.definitions.map((def, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-lg bg-zinc-50 border border-zinc-200/80 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-xs font-bold text-zinc-900">{def.term}</span>
                          <span className="font-mono text-[10px] px-1.5 py-0.5 bg-white border border-zinc-200 rounded text-zinc-500">
                            P.{def.page}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-600 leading-relaxed">{def.meaning}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Section-by-Section Bullet Summary */}
            <div className="space-y-4">
              {data.sections.map((sec, idx) => (
                <div key={idx} className="bg-white border border-zinc-200 rounded-xl p-5">
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-100">
                    <h4 className="text-sm font-bold text-zinc-900">{sec.heading}</h4>
                    <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-zinc-100 text-zinc-600">
                      PAGE {sec.page}
                    </span>
                  </div>
                  <ul className="space-y-2.5">
                    {sec.bullets.map((b, bIdx) => (
                      <li
                        key={bIdx}
                        className="flex items-start gap-2.5 text-xs sm:text-sm text-zinc-700 leading-relaxed"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-900 mt-2 shrink-0" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 2: INTERACTIVE PRACTICE QUIZ */}
        {activeTab === "quiz" && (
          <div className="space-y-5">
            {/* Score Banner */}
            {showResults && (
              <div className="bg-zinc-900 text-white rounded-xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0">
                    <Award className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-base sm:text-lg font-bold">
                      Your Quiz Score: {correctCount} / {totalQuestions} (
                      {Math.round((correctCount / Math.max(1, totalQuestions)) * 100)}%)
                    </div>
                    <p className="text-xs text-zinc-400">
                      Review the detailed explanations and source page numbers below.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedAnswers({});
                    setShowResults(false);
                  }}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-white text-zinc-900 hover:bg-zinc-100 shrink-0"
                >
                  Retry Quiz
                </button>
              </div>
            )}

            {/* Questions List */}
            {data.quiz.map((q, qIdx) => {
              const userChoice = selectedAnswers[q.id];
              return (
                <div key={q.id} className="bg-white border border-zinc-200 rounded-xl p-5">
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <span className="font-mono text-xs font-bold text-zinc-400">
                      QUESTION {String(qIdx + 1).padStart(2, "0")}
                    </span>
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-zinc-100 text-zinc-600">
                      SOURCE: PAGE {q.sourcePage}
                    </span>
                  </div>

                  <p className="text-xs sm:text-sm font-semibold text-zinc-900 whitespace-pre-line leading-relaxed mb-4">
                    {q.question}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {q.options.map((opt, optIdx) => {
                      const isSelected = userChoice === optIdx;
                      const isCorrect = q.correctIndex === optIdx;

                      let btnStyle = "border-zinc-200 bg-zinc-50/60 hover:border-zinc-400 text-zinc-800";
                      if (showResults) {
                        if (isCorrect) {
                          btnStyle = "border-emerald-600 bg-emerald-50 text-emerald-950 font-semibold";
                        } else if (isSelected && !isCorrect) {
                          btnStyle = "border-red-500 bg-red-50 text-red-900";
                        }
                      } else if (isSelected) {
                        btnStyle = "border-zinc-900 bg-zinc-900 text-white font-medium";
                      }

                      return (
                        <button
                          key={optIdx}
                          type="button"
                          onClick={() => handleSelectOption(q.id, optIdx)}
                          className={`p-3 rounded-lg border text-left text-xs transition-all flex items-center justify-between gap-2 ${btnStyle}`}
                        >
                          <span>
                            <strong className="font-mono mr-2">
                              {String.fromCharCode(65 + optIdx)}.
                            </strong>
                            {opt}
                          </span>
                          {showResults && isCorrect && (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          )}
                          {showResults && isSelected && !isCorrect && (
                            <XCircle className="w-4 h-4 text-red-600 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {showResults && (
                    <div className="mt-3.5 pt-3 border-t border-zinc-100 text-xs text-zinc-600 bg-zinc-50 p-3 rounded-lg">
                      <strong className="text-zinc-900">Explanation: </strong>
                      {q.explanation}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Submit Quiz Bar */}
            {!showResults && data.quiz.length > 0 && (
              <div className="bg-white border border-zinc-200 rounded-xl p-4 flex items-center justify-between">
                <span className="text-xs font-mono text-zinc-500">
                  ANSWERED: {answeredCount} OF {totalQuestions}
                </span>
                <button
                  type="button"
                  onClick={() => setShowResults(true)}
                  className="px-5 py-2.5 rounded-lg text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-white"
                >
                  Check Answers & View Score
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}