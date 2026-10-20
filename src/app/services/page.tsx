import type { Metadata } from "next";
import { AppLink } from "@/components/ui/AppLink";
import { AppsIcon, GlobeIcon, NodesIcon, StoreIcon } from "@/components/ui/Icons";
import { Reveal } from "@/components/motion/Reveal";
import { SERVICE_CATALOG } from "@/lib/catalog";
import { SERVICE_CATEGORY_COPY } from "@/lib/serviceCategories";

export const metadata: Metadata = { title: "Services" };

const SECTIONS = [
  { id: "website", href: "/discover?interest=website", icon: GlobeIcon, reverse: false },
  {
    id: "custom_apps_platforms",
    href: "/discover?interest=custom_apps_platforms",
    icon: AppsIcon,
    reverse: true
  },
  {
    id: "ecommerce_storefronts",
    href: "/discover?interest=ecommerce_storefronts",
    icon: StoreIcon,
    reverse: false
  },
  {
    id: "digital_infrastructure",
    href: "/discover?interest=digital_infrastructure",
    icon: NodesIcon,
    reverse: true,
    hash: "digital-infrastructure"
  }
] as const;

export default function ServicesPage() {
  return (
    <section className="container section">
      <p className="kicker">Services</p>
      <h1>What can be commissioned now.</h1>
      <p className="lede">
        Pricing and commercial terms are not finalized. Aethelios may explain only these approved
        options. Neil confirms every proposal. Branding can be part of any of these paths, or a
        separately scoped identity commission — it is not required to begin.
      </p>

      {SECTIONS.map((section, index) => {
        const offer = SERVICE_CATALOG.offers.find((item) => item.id === section.id);
        const copy = SERVICE_CATEGORY_COPY[section.id];
        const Icon = section.icon;
        return (
          <Reveal
            as="article"
            className={`service-feature ${section.reverse ? "service-feature-reverse" : ""} surface-ivory`}
            delay={(index % 3) as 0 | 1 | 2}
            id={"hash" in section ? section.hash : undefined}
            key={section.id}
          >
            <div>
              <p className="tiny">{offer?.status === "exploratory" ? "Exploratory" : copy.short}</p>
              <Icon />
              <h2>{offer?.title}</h2>
              <p className="lede">{copy.summary}</p>
              {section.id === "custom_apps_platforms" ? (
                <p className="notice">
                  An existing booking provider can remain the destination for appointments and payments.
                  Atelier does not operate a scheduling engine.
                </p>
              ) : null}
              <AppLink className="btn btn-emerald-glass" href={section.href}>
                {copy.action}
              </AppLink>
            </div>
            <div className="surface-read service-spec">
              <h3>Includes</h3>
              <ul>
                {offer?.includes.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <h3>Does not include</h3>
              <ul>
                {offer?.excludes.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </Reveal>
        );
      })}

      <div className="row" style={{ marginTop: 28 }}>
        <AppLink className="btn btn-emerald-glass" href="/discover">
          Explore your direction
        </AppLink>
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
