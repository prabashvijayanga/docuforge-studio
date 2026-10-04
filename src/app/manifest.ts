import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DocuForge Studio — PDF, Smart Notes & Study Quiz",
    short_name: "DocuForge",
    description:
      "Organize PDFs, convert handwriting to typed notes, generate study quizzes, and convert Office files.",
    start_url: "/",
    display: "standalone",
    background_color: "#F8F9FA",
    theme_color: "#09090B",
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}