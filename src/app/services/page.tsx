import type { Metadata } from "next";
import { AppLink } from "@/components/ui/AppLink";
import { CalendarIcon, GlobeIcon, NodesIcon } from "@/components/ui/Icons";
import { Reveal } from "@/components/motion/Reveal";
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

      <Reveal as="article" className="service-feature surface-dimensional">
        <div>
          <p className="tiny">Offered</p>
          <GlobeIcon />
          <h2>{website?.title}</h2>
          <p className="lede">{website?.summary}</p>
          <AppLink className="btn btn-gold" href="/discover?interest=website">
            Explore a website direction
          </AppLink>
        </div>
        <div className="surface-read service-spec">
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
      </Reveal>

      <Reveal as="article" className="service-feature service-feature-reverse surface-glass" delay={1}>
        <div>
          <p className="tiny">Primary path</p>
          <CalendarIcon />
          <h2>{booking?.title}</h2>
          <p className="lede">{booking?.summary}</p>
          <p className="notice">
            Existing booking providers continue handling appointments and payments. Atelier does not
            operate a scheduling engine in this candidate.
          </p>
          <AppLink className="btn btn-gold" href="/discover?interest=booking_connected_website">
            Explore a booking-connected direction
          </AppLink>
        </div>
        <div className="surface-read service-spec">
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
      </Reveal>

      <Reveal as="article" className="service-feature surface-read" delay={2} id="digital-infrastructure">
        <div>
          <p className="tiny">Exploratory</p>
          <NodesIcon />
          <h2>{infra?.title}</h2>
          <p className="lede">{infra?.summary}</p>
          <AppLink className="btn btn-ghost" href="/project">
            Open a brief to discuss this
          </AppLink>
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
      </Reveal>

      <div className="row" style={{ marginTop: 28 }}>
        <AppLink className="btn btn-gold" href="/discover">
          Explore your direction
        </AppLink>
        <AppLink className="btn btn-ghost" href="/project">
          Begin a brief
        </AppLink>
        <AppLink className="btn btn-ghost" href="/approach">
          How a commission proceeds
        </AppLink>
      </div>
    </section>
  );
}
