import type { Metadata } from "next";
import { AppLink } from "@/components/ui/AppLink";

export const metadata: Metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <section className="container section">
      <article className="surface-dense" style={{ padding: 28, maxWidth: 720 }}>
        <p className="kicker">Offline</p>
        <h1>A generic shell is available. Submissions are not.</h1>
        <p className="lede">
          This device appears to be offline. This page is a public offline shell, not a cached
          workspace or account. A guest draft on this device is not a delivered brief. Nothing has
          been sent to Neil.
        </p>
        <AppLink className="btn btn-gold" href="/">
          Return home
        </AppLink>
      </article>
    </section>
  );
}
