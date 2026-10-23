import type { Metadata } from "next";
import { AppLink } from "@/components/ui/AppLink";

export const metadata: Metadata = {
  title: "Aethelios",
  description:
    "Talk with Aethelios, the digital concierge for Aethelios Atelier. Explore what your business needs and prepare a request for Neil Stutes."
};

export default function ConciergePage() {
  return (
    <section className="container section concierge-page">
      <p className="kicker">Digital concierge</p>
      <h1>Aethelios</h1>
      <p className="lede">
        An AI guide for Aethelios Atelier — not a person, and not a substitute for Neil Stutes. Use it to
        understand the problem, see which path may fit, and prepare a request when you are ready.
      </p>
      <div className="row">
        <AppLink className="btn btn-gold" href="/rta">
          Open the voice room
        </AppLink>
      </div>
    </section>
  );
}
