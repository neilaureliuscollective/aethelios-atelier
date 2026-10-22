import localFont from "next/font/local";

/**
 * Self-hosted latin cuts. Hosted `next build` must not call the Google Fonts
 * loader — it dereferences null when that fetch fails (Vercel production).
 */

export const display = localFont({
  src: [
    { path: "./fonts/cormorant-garamond-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/cormorant-garamond-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/cormorant-garamond-700.woff2", weight: "700", style: "normal" }
  ],
  variable: "--font-display-loaded",
  display: "swap",
  fallback: ["Palatino Linotype", "Palatino", "Iowan Old Style", "serif"]
});

export const body = localFont({
  src: [
    { path: "./fonts/figtree-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/figtree-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/figtree-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/figtree-700.woff2", weight: "700", style: "normal" }
  ],
  variable: "--font-body-loaded",
  display: "swap",
  fallback: ["Segoe UI", "system-ui", "Helvetica Neue", "Arial", "sans-serif"]
});

export const hearth = localFont({
  src: [
    { path: "./fonts/outfit-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/outfit-600.woff2", weight: "600", style: "normal" }
  ],
  variable: "--font-hearth",
  display: "swap",
  preload: false,
  fallback: ["Segoe UI", "sans-serif"]
});

export const signal = localFont({
  src: [
    { path: "./fonts/syne-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/syne-700.woff2", weight: "700", style: "normal" }
  ],
  variable: "--font-signal",
  display: "swap",
  preload: false,
  fallback: ["Avenir Next", "sans-serif"]
});
