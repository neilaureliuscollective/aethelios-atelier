import type { Metadata } from "next";
import { FounderDetail, FounderGuard } from "@/components/founder/FounderClient";

export const metadata: Metadata = { title: "Founder review" };

export default async function FounderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <FounderGuard>
      <FounderDetail id={id} />
    </FounderGuard>
  );
}
