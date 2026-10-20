import type { Metadata, Viewport } from "next";
import { MotionPreferences } from "@/components/motion/MotionPreferences";
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

const publicOrigin = (() => {
  const value = process.env.ATELIER_PUBLIC_ORIGIN?.trim();
  if (!value) return undefined;
  try {
    return new URL(value);
  } catch {
    return undefined;
  }
})();

export const metadata: Metadata = {
  metadataBase: publicOrigin,
  title: {
    default: "Aethelios Atelier",
    template: "%s · Aethelios Atelier"
  },
  description:
    "Founder-led websites and digital infrastructure. Shape a commission with Aethelios; Neil Stutes reviews, scopes, and delivers.",
  applicationName: "Aethelios Atelier",
  alternates: publicOrigin ? { canonical: "/" } : undefined,
  openGraph: {
    title: "Aethelios Atelier",
    description:
      "Founder-led websites and digital infrastructure. Shape a commission with Aethelios; Neil Stutes reviews, scopes, and delivers.",
    siteName: "Aethelios Atelier",
    locale: "en_US",
    type: "website",
    images: [{ url: "/brand/logo-1024.png", width: 1024, height: 1024, alt: "Aethelios Atelier" }]
  },
  twitter: {
    card: "summary_large_image",
    title: "Aethelios Atelier",
    description:
      "Founder-led websites and digital infrastructure. Shape a commission with Aethelios; Neil Stutes reviews, scopes, and delivers.",
    images: ["/brand/logo-1024.png"]
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/brand/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/install/v8/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/brand/install/v8/icon-512.png", sizes: "512x512", type: "image/png" }
    ],
    apple: [{ url: "/brand/install/v8/apple-touch-icon.png", sizes: "180x180" }]
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
        <MotionPreferences />
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <SessionShell>{children}</SessionShell>
        <RegisterPwa />
      </body>
    </html>
  );
}
