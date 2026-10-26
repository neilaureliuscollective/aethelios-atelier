import { AppLink } from "@/components/ui/AppLink";

export type LegalSection = { heading: string; body: string[] };

export function LegalDocument({
  kicker,
  title,
  updated,
  intro,
  sections
}: {
  kicker: string;
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
}) {
  return (
    <section className="container section legal-page">
      <p className="kicker">{kicker}</p>
      <h1>{title}</h1>
      <p className="lede">{intro}</p>
      <p className="tiny">Last updated {updated}</p>
      <div className="legal-body surface-ivory">
        {sections.map((section) => (
          <section key={section.heading}>
            <h2>{section.heading}</h2>
            {section.body.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </section>
        ))}
        <section>
          <h2>Contact</h2>
          <p>
            Questions about this page can be sent through the <AppLink href="/inquire">inquiry form</AppLink>.
            Neil Stutes reads every message personally.
          </p>
        </section>
      </div>
    </section>
  );
}
