import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Figtree } from "next/font/google";
import { SiteHeader } from "@/components/shell/SiteHeader";
import { SiteFooter } from "@/components/shell/SiteFooter";
import { SimulatedBanner } from "@/components/shell/SimulatedBanner";
import { RegisterPwa } from "@/components/pwa/RegisterPwa";
import { readSession } from "@/lib/auth/session";
import { publicRuntimeConfig } from "@/lib/config";
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
    "Founder-led websites and digital infrastructure. Shape a commission with Aurelius; Neil Stutes reviews, scopes, and delivers.",
  applicationName: "Aethelios Atelier",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/brand/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/brand/icon-512.png", sizes: "512x512", type: "image/png" }
    ],
    apple: [{ url: "/brand/apple-touch-icon.png", sizes: "180x180" }]
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

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const auth = await readSession();
  const runtime = publicRuntimeConfig();
  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable}`}>
        <div className="atmosphere" aria-hidden="true" />
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <div className="app-root">
          <SimulatedBanner auth={runtime.auth} user={auth?.user ?? null} />
          <SiteHeader user={auth?.user ?? null} />
          <main id="main">{children}</main>
          <SiteFooter />
        </div>
        <RegisterPwa />
      </body>
    </html>
  );
}
