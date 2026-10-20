import type { Metadata } from "next";
import { FounderGuard, FounderHome } from "@/components/founder/FounderClient";

export const metadata: Metadata = { title: "Founder" };
export const dynamic = "force-dynamic";

export default function FounderPage() {
  return (
    <FounderGuard>
      <FounderHome />
    </FounderGuard>
  );
}
