import type { Metadata } from "next";
import { PricingExperience } from "@/components/pricing/PricingExperience";
import { buildPricingPresentation } from "@/lib/pricing/presentation";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Founder-led commissions and ongoing Atelier relationships. Pricing terms are not finalized. Explore or request a proposal without starting a subscription."
};

export const dynamic = "force-dynamic";

export default function PricingPage() {
  const presentation = buildPricingPresentation();
  return <PricingExperience presentation={presentation} />;
}
