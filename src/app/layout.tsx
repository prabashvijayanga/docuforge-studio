import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
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

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://docuforge-studio.vercel.app";

export const viewport: Viewport = {
  themeColor: "#18181B",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "DocuForge Studio | Free PDF Editor, Smart Notes, Quiz & Multi-Format Converter",
    template: "%s | DocuForge Studio",
  },
  description:
    "All-in-one zero-storage PDF workspace. Organize & split 100+ page PDFs, convert handwriting to typed PDF notes, auto-generate study short notes & MCQ quizzes, and convert bi-directionally across PDF, Word (.DOCX), PowerPoint (.PPTX), Excel (.XLSX), Markdown, and Images.",
  keywords: [
    "DocuForge Studio",
    "free PDF editor online",
    "PDF organizer and splitter",
    "handwriting to text PDF note",
    "lecture PDF to short notes generator",
    "PDF to MCQ quiz generator for students",
    "PDF to PowerPoint PPTX converter",
    "PDF to Word DOCX converter",
    "PDF to Excel XLSX table extractor",
    "PPTX to PDF converter",
    "images to PDF compiler",
    "merge PDF files client side",
    "compress PDF online free",
    "zero storage private PDF tools",
  ],
  authors: [{ name: "DocuForge Engineering" }],
  creator: "DocuForge Studio",
  publisher: "DocuForge Studio",
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
    title: "DocuForge Studio — Precision PDF Engineering, Smart Notes & Study Lab",
    description:
      "Organize large PDFs, insert stylus handwriting-to-typed note pages, generate instant revision short notes & quizzes, and convert across 13+ document formats.",
  },
  twitter: {
    card: "summary_large_image",
    title: "DocuForge Studio | Smart PDF Workspace & Study Lab",
    description:
      "Zero-storage PDF organizer, handwriting-to-typed note studio, auto short-note & quiz generator, and bi-directional Office converter.",
  },
  category: "productivity",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        name: "DocuForge Studio",
        url: SITE_URL,
        applicationCategory: "BusinessApplication, EducationalApplication",
        operatingSystem: "All (Web Browser, iOS, Android, Windows, macOS)",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
        featureList: [
          "Interactive PDF Page Organizer, Splitter & Rotator",
          "Smart Stylus Handwriting-to-Typed PDF Note Insertion",
          "Built-In NLP Study Lab: Automatic Short Notes & Interactive MCQ Quiz Generator",
          "Bi-Directional Converter: PDF to DOCX, PPTX, XLSX, Markdown, HTML5, TXT, PNG",
          "Client-Side High-Resolution Images to PDF Compiler & PDF Merger",
          "Zero-Storage Ephemeral RAM Stream Privacy",
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
              text: "Yes. DocuForge Studio runs on a zero-storage architecture. Client-side tools run directly in your browser memory, and server-side conversions use volatile RAM streams that are purged immediately after download.",
            },
          },
          {
            "@type": "Question",
            name: "How does the Short Note and Quiz Generator work?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Students can upload any lecture PDF, PowerPoint (.PPTX), Word (.DOCX), or text handout to automatically extract key concepts, definitions, section-by-section revision bullet points, and an interactive multiple-choice practice quiz.",
            },
          },
          {
            "@type": "Question",
            name: "Can I write with a tablet stylus and convert handwriting to typed PDF pages?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Yes. Using the Smart Note Studio inside the Organize tool, you can write with an S-Pen, Apple Pencil, or finger and automatically convert your handwriting into crisp vector-typed A4 pages inserted anywhere in your PDF.",
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