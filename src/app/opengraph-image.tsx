import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "DocuForge Studio — Precision PDF & Study Workspace";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#09090B",
          color: "#FFFFFF",
          padding: "64px",
          fontFamily: "sans-serif",
        }}
      >
        {/* Top Brand Row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div
              style={{
                width: "52px",
                height: "52px",
                borderRadius: "12px",
                backgroundColor: "#FFFFFF",
                color: "#09090B",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "24px",
                fontWeight: 800,
              }}
            >
              DF
            </div>
            <span style={{ fontSize: "28px", fontWeight: 700, letterSpacing: "-0.02em" }}>
              DocuForge Studio
            </span>
          </div>

          <div
            style={{
              padding: "8px 18px",
              borderRadius: "999px",
              backgroundColor: "#18181B",
              border: "1px solid #27272A",
              color: "#10B981",
              fontSize: "16px",
              fontWeight: 600,
            }}
          >
            ZERO-STORAGE PRIVACY ENGINE
          </div>
        </div>

        {/* Center Headline */}
        <div style={{ display: "flex", flexDirection: "column", gap: "18px", maxWidth: "960px" }}>
          <div
            style={{
              fontSize: "60px",
              fontWeight: 800,
              lineHeight: 1.1,
              letterSpacing: "-0.03em",
            }}
          >
            Precision PDF Engineering, Smart Stylus Notes & Study Quiz Lab.
          </div>
          <div style={{ fontSize: "24px", color: "#A1A1AA", lineHeight: 1.4 }}>
            Organize 100+ Page PDFs • Handwriting-to-Typed Pages • Auto Short Notes & MCQs • 13+ Office Converters
          </div>
        </div>

        {/* Bottom Feature Pills */}
        <div style={{ display: "flex", gap: "14px" }}>
          {[
            "PDF ↔ DOCX / PPTX / XLSX",
            "SMART INK-TO-TEXT",
            "SHORT NOTES & QUIZ",
            "IMAGES TO PDF",
            "MERGE & COMPRESS",
          ].map((tag) => (
            <div
              key={tag}
              style={{
                padding: "10px 20px",
                borderRadius: "8px",
                backgroundColor: "#18181B",
                border: "1px solid #27272A",
                color: "#E4E4E7",
                fontSize: "15px",
                fontWeight: 600,
              }}
            >
              {tag}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  );
}