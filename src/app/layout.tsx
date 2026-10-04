import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
// CSS is bundled by Next.js; TypeScript has no module declaration for this side-effect import.
// @ts-expect-error -- Next.js resolves CSS imports at build time.
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://docuforge-studio.vercel.app";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#09090B",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default:
      "DocuForge Studio | Free PDF Editor, Smart Handwriting Notes, Study Quiz & Bi-Directional Converter",
    template: "%s | DocuForge Studio",
  },
  description:
    "All-in-one privacy-first document studio. Organize, split & merge 100+ page PDFs, convert Handwriting to Typed PDF Notes, generate automatic Short Notes & MCQ Quizzes from lecture slides, and convert bi-directionally across PDF, Word (.DOCX), PowerPoint (.PPTX), Excel (.XLSX), Markdown, and Images with zero storage.",
  keywords: [
    "DocuForge",
    "DocuForge Studio",
    "Free PDF Editor Online",
    "PDF to Word Converter",
    "PDF to PowerPoint PPTX",
    "PDF to Excel XLSX",
    "PPTX to PDF Converter",
    "Word to PDF Converter",
    "Handwriting to Text PDF Note",
    "Stylus PDF Note Taking",
    "Lecture Slides to Short Notes",
    "Automatic MCQ Quiz Generator from PDF",
    "Study Pack Generator",
    "Images to PDF Compiler",
    "Merge PDF Online Free",
    "Compress PDF Without Losing Quality",
    "Zero Storage Privacy PDF Tool",
  ],
  authors: [{ name: "DocuForge Engineering" }],
  creator: "DocuForge Studio",
  publisher: "DocuForge Studio",
  category: "Productivity & Education",
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: "DocuForge Studio",
    title:
      "DocuForge Studio — Smart PDF Workspace, Handwriting-to-Text & Study Quiz Generator",
    description:
      "Edit & reorder PDFs, write with a stylus to insert typed note pages, generate instant Short Notes & MCQ Quizzes, and convert across 13+ formats (DOCX, PPTX, XLSX, MD, HTML, Images).",
  },
  twitter: {
    card: "summary_large_image",
    title:
      "DocuForge Studio | Smart PDF Editor, Handwriting Notes & Study Lab",
    description:
      "Zero-storage PDF workspace with real-time handwriting-to-text pages, automatic Short Note & MCQ Quiz generation, and bi-directional Office converters.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Google Rich Results JSON-LD Schema (SoftwareApplication + FAQPage)
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        name: "DocuForge Studio",
        url: SITE_URL,
        applicationCategory: "BusinessApplication, EducationalApplication",
        operatingSystem: "Any (Web Browser, iOS, Android, Windows, macOS)",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
        description:
          "Precision PDF workspace featuring drag-and-drop page organization, stylus handwriting-to-typed note insertion, automatic lecture Short Notes & MCQ Quiz generation, and 13+ bi-directional document converters.",
        featureList: [
          "Organize, Reorder, Rotate & Bulk Split 100+ Page PDFs",
          "Smart Handwriting-to-Typed Note Page Insertion",
          "Automatic Short Note & Interactive MCQ Quiz Generator for Students",
          "Client-Side High-Resolution Images to PDF Compiler",
          "Instant Multi-PDF Merger with Zero Upload Limits",
          "Bi-Directional PDF Converter (Word DOCX, PowerPoint PPTX, Excel XLSX, Markdown, HTML5, TXT, PNG ZIP)",
          "Zero-Storage Ephemeral RAM Processing",
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: "Is DocuForge Studio completely free and private?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Yes. DocuForge Studio is 100% free with no daily limits. Client-side tools run directly in your browser memory, and server-side conversions use ephemeral RAM streams with zero database or disk storage.",
            },
          },
          {
            "@type": "Question",
            name: "How does the Smart Handwriting-to-Typed PDF Note feature work?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "You can insert a new page after any PDF sheet and write using your tablet stylus (S-Pen, Apple Pencil) or finger. Our Spatial Word-Cluster Engine detects word boundaries and converts your handwriting into crisp vector typed text inside the PDF.",
            },
          },
          {
            "@type": "Question",
            name: "Can I generate Short Notes and Quizzes from lecture slides?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Yes. Drop any PDF, PowerPoint (.PPTX), Word (.DOCX), or text handout into the Short Note & Quiz tool to automatically extract key topics, definitions, section summaries, and an interactive multiple-choice practice quiz.",
            },
          },
        ],
      },
    ],
  };

  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="font-sans antialiased bg-[#F8F9FA] text-zinc-900 selection:bg-zinc-900 selection:text-white">
        {children}
      </body>
    </html>
  );
}