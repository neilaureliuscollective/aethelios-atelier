import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Cormorant_Garamond, Figtree } from "next/font/google";
import { RegisterPwa } from "@/components/pwa/RegisterPwa";
import { SessionShell } from "@/components/shell/SessionShell";
import "./globals.css";

const display = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display-loaded",
  display: "swap"
});

const body = Figtree({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body-loaded",
  display: "swap"
});

export const metadata: Metadata = {
  title: {
    default: "Aethelios Atelier",
    template: "%s · Aethelios Atelier"
  },
  description:
    "Founder-led websites and digital infrastructure. Shape a commission with Aethelios; Neil Stutes reviews, scopes, and delivers.",
  applicationName: "Aethelios Atelier",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/brand/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/install/v7/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/brand/install/v7/icon-512.png", sizes: "512x512", type: "image/png" }
    ],
    apple: [{ url: "/brand/install/v7/apple-touch-icon.png", sizes: "180x180" }]
  },
  appleWebApp: {
    capable: true,
    title: "Atelier",
    statusBarStyle: "black-translucent"
  }
};

export const viewport: Viewport = {
  themeColor: "#080C0B",
  width: "device-width",
  initialScale: 1
};

export const runtime = "nodejs";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        <Script id="atelier-js-motion" strategy="beforeInteractive">
          {`(function(){try{if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches){document.documentElement.classList.add('js-motion');}}catch(e){}})();`}
        </Script>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <SessionShell>{children}</SessionShell>
        <RegisterPwa />
      </body>
    </html>
  );
}
