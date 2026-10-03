/** @type {import('next').NextConfig} */
const nextConfig = {
  // React Strict Mode සක්‍රීය කිරීම
  reactStrictMode: true,

  // Next.js version info එක HTTP headers වලින් සඟවා තැබීම (Security Hardening)
  poweredByHeader: false,

  // pdfjs-dist සඳහා අවශ්‍ය Webpack Canvas Fix එක
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },

  // Browser Security Headers (Clickjacking, MIME Sniffing, XSS ආරක්ෂාව)
  headers: async () => {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },

  // Next.js Frontend එක සහ Python FastAPI Backend එක සම්බන්ධ කරන පාලම
  rewrites: async () => {
    return [
      {
        source: "/api/py/:path*",
        destination:
          process.env.NODE_ENV === "development"
            ? "http://127.0.0.1:8000/api/py/:path*"
            : "/api/",
      },
    ];
  },
};

export default nextConfig;