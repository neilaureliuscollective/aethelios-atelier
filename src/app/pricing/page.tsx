import type { Metadata } from "next";
import { PricingExperience } from "@/components/pricing/PricingExperience";
import { buildPricingPresentation } from "@/lib/pricing/presentation";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Founder-led commissions and ongoing Atelier plans in USD. Atelier $299 setup + $249/month. Connected $499 setup + $399/month. Partnership setup quoted + $699/month. Payments are not collected here."
};

export const dynamic = "force-dynamic";

export default function PricingPage() {
  const presentation = buildPricingPresentation();
  return <PricingExperience presentation={presentation} />;
}
