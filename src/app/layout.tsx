import type { Metadata, Viewport } from "next";
import { body, display, hearth, signal } from "@/app/fonts";
import { MotionPreferences } from "@/components/motion/MotionPreferences";
import { RegisterPwa } from "@/components/pwa/RegisterPwa";
import { SessionShell } from "@/components/shell/SessionShell";
import "./globals.css";

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
    images: [{ url: "/brand/og.png", width: 1200, height: 630, alt: "Aethelios Atelier" }]
  },
  twitter: {
    card: "summary_large_image",
    title: "Aethelios Atelier",
    description:
      "Founder-led websites and digital infrastructure. Shape a commission with Aethelios; Neil Stutes reviews, scopes, and delivers.",
    images: ["/brand/og.png"]
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/brand/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/install/v10/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/brand/install/v10/icon-512.png", sizes: "512x512", type: "image/png" }
    ],
    apple: [{ url: "/brand/install/v10/apple-touch-icon.png", sizes: "180x180" }]
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
    <html lang="en" className={`${display.variable} ${body.variable} ${hearth.variable} ${signal.variable}`}>
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
