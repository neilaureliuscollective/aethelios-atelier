import type { Metadata } from "next";
import { ContinueClient } from "@/components/account/ContinueClient";

export const metadata: Metadata = { title: "Continue" };
export const dynamic = "force-dynamic";

export default function ContinuePage() {
  return <ContinueClient />;
}
