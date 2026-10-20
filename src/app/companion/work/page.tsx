import type { Metadata } from "next";
import { Suspense } from "react";
import { WorkClient } from "@/components/cofounder/WorkClient";

export const metadata: Metadata = { title: "Work" };

export default function WorkPage() {
  return (
    <Suspense fallback={<section className="container section"><p className="kicker">Work</p><h1>Opening saved work…</h1></section>}>
      <WorkClient />
    </Suspense>
  );
}
