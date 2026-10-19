import type { Metadata } from "next";
import { Fraunces, Outfit, Syne } from "next/font/google";
import { DiscoveryStudio } from "@/components/discovery/DiscoveryStudio";

const lumen = Fraunces({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-lumen",
  display: "swap"
});

const hearth = Outfit({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-hearth",
  display: "swap"
});

const signal = Syne({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-signal",
  display: "swap"
});

export const metadata: Metadata = {
  title: "Discover your direction",
  description:
    "Explore curated website directions for your business. Neil Stutes personally reviews and delivers commissions. No account is required to begin."
};

export default function DiscoverPage() {
  return (
    <div className={`${lumen.variable} ${hearth.variable} ${signal.variable}`}>
      <DiscoveryStudio />
    </div>
  );
}
