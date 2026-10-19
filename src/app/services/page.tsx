import type { Metadata } from "next";
import { AppLink } from "@/components/ui/AppLink";
import { CalendarIcon, GlobeIcon, NodesIcon } from "@/components/ui/Icons";
import { SERVICE_CATALOG } from "@/lib/catalog";

export const metadata: Metadata = { title: "Services" };

export default function ServicesPage() {
  const website = SERVICE_CATALOG.offers.find((o) => o.id === "website");
  const booking = SERVICE_CATALOG.offers.find((o) => o.id === "booking_connected_website");
  const infra = SERVICE_CATALOG.offers.find((o) => o.id === "digital_infrastructure");

  return (
    <section className="container section">
      <p className="kicker">Services</p>
      <h1>What can be commissioned now.</h1>
      <p className="lede">
        Pricing and commercial terms are not finalized. Aethelios may explain only these approved
        options. Neil confirms every proposal. Other business niches can be discussed; they are not
        pretended to be packaged products.
      </p>

      <article className="service-feature surface-dimensional">
        <div>
          <p className="tiny">Offered</p>
          <GlobeIcon />
          <h2>{website?.title}</h2>
          <p className="lede">{website?.summary}</p>
        </div>
        <div className="surface-dense service-spec">
          <h3>Includes</h3>
          <ul>
            {website?.includes.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <h3>Does not include</h3>
          <ul>
            {website?.excludes.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </article>

      <article className="service-feature service-feature-reverse surface-glass">
        <div>
          <p className="tiny">Primary path</p>
          <CalendarIcon />
          <h2>{booking?.title}</h2>
          <p className="lede">{booking?.summary}</p>
          <p className="notice">
            Existing booking providers continue handling appointments and payments. Atelier does not
            operate a scheduling engine in this candidate.
          </p>
        </div>
        <div className="surface-dense service-spec">
          <h3>Includes</h3>
          <ul>
            {booking?.includes.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <h3>Does not include</h3>
          <ul>
            {booking?.excludes.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </article>

      <article className="service-feature surface-dense">
        <div>
          <p className="tiny">Exploratory</p>
          <NodesIcon />
          <h2>{infra?.title}</h2>
          <p className="lede">{infra?.summary}</p>
        </div>
        <div className="service-spec">
          <h3>Includes</h3>
          <ul>
            {infra?.includes.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <h3>Does not include</h3>
          <ul>
            {infra?.excludes.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </article>

      <div className="row" style={{ marginTop: 28 }}>
        <AppLink className="btn btn-gold" href="/project">
          Begin a brief
        </AppLink>
        <AppLink className="btn btn-ghost" href="/approach">
          How a commission proceeds
        </AppLink>
      </div>
    </section>
  );
}
