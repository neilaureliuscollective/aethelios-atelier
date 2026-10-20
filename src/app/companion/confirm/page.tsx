import type { Metadata } from "next";
import { Suspense } from "react";
import { ConfirmClient } from "@/components/cofounder/ConfirmClient";

export const metadata: Metadata = { title: "Confirm business" };

export default function ConfirmPage() {
  return (
    <Suspense
      fallback={
        <section className="container section">
          <p className="kicker">Confirm</p>
          <h1>Opening the confirmation…</h1>
        </section>
      }
    >
      <ConfirmClient />
    </Suspense>
  );
}
