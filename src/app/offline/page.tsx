import type { Metadata } from "next";
import { AppLink } from "@/components/ui/AppLink";

export const metadata: Metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <section className="container section">
      <p className="kicker">Offline</p>
      <h1>Public pages may be available. Submissions are not.</h1>
      <p className="lede">
        This device appears to be offline. Cached public pages can still be read. A guest draft on
        this device is not a delivered brief. Nothing has been sent to Neil.
      </p>
      <AppLink className="btn btn-gold" href="/">
        Return home
      </AppLink>
    </section>
  );
}
