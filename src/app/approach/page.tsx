import type { Metadata } from "next";
import { BEGIN_HREF, BEGIN_LABEL } from "@/lib/publicSite";
import { AppLink } from "@/components/ui/AppLink";
import { Reveal } from "@/components/motion/Reveal";

export const metadata: Metadata = { title: "Approach" };

export default function ApproachPage() {
  return (
    <section className="container section">
      <p className="kicker">Approach</p>
      <h1>Human-led, with a careful guide.</h1>
      <p className="lede">
        You can start without buying anything or creating an account. Talk the business through
        with Aethelios, review the direction it writes, and send it to Neil when it reads right.
      </p>
      <ol className="approach-steps">
        {([
          ["Talk it through", "Tell Aethelios what you run, who it serves, and what has to work better — websites, apps, storefronts, or the systems behind them.", BEGIN_HREF],
          ["Review your direction", "Aethelios writes the conversation into a direction document. Read it, refine it, and nothing leaves until you choose.", BEGIN_HREF],
          ["Send it to Neil", "You send the direction you reviewed. That is a request for Neil, not a booking or payment.", BEGIN_HREF],
          ["A sent brief is a request", "Neil accepts work only after he opens the commission. There is no implied acceptance or delivery date.", "/about"],
          ["Scope after human review", "Timing and price are confirmed only after that review, never by the brief itself.", "/about"]
        ] as const).map(([title, copy, href], index) => (
          <Reveal as="li" className="surface-ivory approach-step" key={title} delay={(index % 3) as 0 | 1 | 2}>
            <span className="num">{String(index + 1).padStart(2, "0")}</span>
            <div>
              <h2>{title}</h2>
              <p className="muted">{copy}</p>
              <AppLink className="btn btn-ghost btn-compact" href={href}>
                Continue
              </AppLink>
            </div>
          </Reveal>
        ))}
      </ol>
      <p className="muted" style={{ marginTop: 24 }}>
        Neil replies personally by email. Prefer to skip the conversation? A short inquiry reaches
        him just the same.
      </p>
      <div className="row" style={{ marginTop: 20 }}>
        <AppLink className="btn btn-gold" href={BEGIN_HREF}>
          {BEGIN_LABEL}
        </AppLink>
        <AppLink className="btn btn-ghost" href="/inquire">
          Send a short inquiry
        </AppLink>
      </div>
    </section>
  );
}
