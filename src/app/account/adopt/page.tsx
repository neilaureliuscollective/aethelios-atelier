import type { Metadata } from "next";
import { AdoptClient } from "@/components/account/AdoptClient";

export const metadata: Metadata = { title: "Review guest draft" };
export const dynamic = "force-dynamic";

export default function AdoptPage() {
  return <AdoptClient />;
}
