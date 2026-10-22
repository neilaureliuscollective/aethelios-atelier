import type { Metadata } from "next";
import { DiscoveryStudio } from "@/components/discovery/DiscoveryStudio";

export const metadata: Metadata = {
  title: "Discover your direction",
  description:
    "Explore curated directions for your business. Neil Stutes personally reviews and delivers commissions. No account is required to begin."
};

export default function DiscoverPage() {
  return <DiscoveryStudio />;
}
