import type { Metadata } from "next";
import { PricingExperience } from "@/components/pricing/PricingExperience";

export const metadata: Metadata = {
  title: "Investment",
  description:
    "Every website, app, storefront, and system Aethelios Atelier builds is scoped to the business and priced personally by Neil Stutes in a written proposal. No packages, no subscriptions."
};

export default function PricingPage() {
  return <PricingExperience />;
}
