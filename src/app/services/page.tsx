import type { Metadata } from "next";
import { SERVICE_CATALOG } from "@/lib/catalog";

export const metadata: Metadata = { title: "Services" };

export default function ServicesPage() {
  return (
    <section className="container section">
      <p className="kicker">Services</p>
      <h1>What can be commissioned now.</h1>
      <p className="lede">
        Pricing and commercial terms are not finalized. Aurelius may explain only these approved
        options. Neil confirms every proposal. Other business niches can be discussed; they are not
        pretended to be packaged products.
      </p>
      <div className="stack" style={{ marginTop: 28 }}>
        {SERVICE_CATALOG.offers.filter((offer) => offer.id !== "undecided").map((offer) => (
          <article className="panel" style={{ padding: 28 }} key={offer.id}>
            <p className="tiny">{offer.status === "offered" ? "Offered" : "Exploratory"}</p>
            <h2>{offer.title}</h2>
            <p className="muted">{offer.summary}</p>
            <h3>Includes</h3>
            <ul>
              {offer.includes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <h3>Does not include</h3>
            <ul>
              {offer.excludes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
