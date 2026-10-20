import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  devIndicators: false,
  typedRoutes: true,
  distDir: process.env.ATELIER_DIST_DIR || ".next",
  serverExternalPackages: ["postgres"],
  images: {
    formats: ["image/webp"],
    dangerouslyAllowSVG: false
  },
  headers: async () => [
    {
      source: "/sw.js",
      headers: [
        { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        { key: "Service-Worker-Allowed", value: "/" }
      ]
    },
    {
      source: "/manifest.webmanifest",
      headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }]
    },
    {
      source: "/favicon.ico",
      headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }]
    },
    {
      source: "/apple-touch-icon.png",
      headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }]
    },
    {
      source: "/(.*)",
      headers: [
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "SAMEORIGIN" }
      ]
    }
  ]
};

export default nextConfig;
