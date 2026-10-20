import type { Metadata } from "next";
import { StudioClient } from "@/components/cofounder/StudioClient";

export const metadata: Metadata = { title: "Studio" };

export default function StudioPage() {
  return <StudioClient />;
}
