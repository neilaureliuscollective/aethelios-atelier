import type { Metadata } from "next";
import { TodayClient } from "@/components/cofounder/TodayClient";

export const metadata: Metadata = { title: "Companion" };

export default function CompanionPage() {
  return <TodayClient />;
}
