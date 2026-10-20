import type { Metadata } from "next";
import { Outfit, Syne } from "next/font/google";
import { DiscoveryStudio } from "@/components/discovery/DiscoveryStudio";

const hearth = Outfit({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-hearth",
  display: "swap",
  preload: false
});

const signal = Syne({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-signal",
  display: "swap",
  preload: false
});

export const metadata: Metadata = {
  title: "Discover your direction",
  description:
    "Explore curated website directions for your business. Neil Stutes personally reviews and delivers commissions. No account is required to begin."
};

export default function DiscoverPage() {
  return (
    <div className={`${hearth.variable} ${signal.variable}`}>
      <DiscoveryStudio />
    </div>
  );
}
