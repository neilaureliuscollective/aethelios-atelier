import type { Metadata } from "next";
import { Suspense } from "react";
import { StudioClient } from "@/components/cofounder/StudioClient";

export const metadata: Metadata = { title: "Studio" };

export default function StudioPage() {
  return (
    <Suspense fallback={<section className="container section"><p className="kicker">Studio</p><h1>Opening the composition…</h1></section>}>
      <StudioClient />
    </Suspense>
  );
}
