import type { Metadata } from "next";
import { AppLink } from "@/components/ui/AppLink";
import { AppsIcon, GlobeIcon, NodesIcon, StoreIcon } from "@/components/ui/Icons";
import { Reveal } from "@/components/motion/Reveal";
import {
  DemoApp,
  DemoInfra,
  DemoStore,
  DemoWebsite,
  DeviceFrame
} from "@/components/marketing/DeviceFrame";
import { SERVICE_CATALOG } from "@/lib/catalog";
import { SERVICE_CATEGORY_COPY, serviceBriefHref } from "@/lib/serviceCategories";

export const metadata: Metadata = { title: "Services" };

const SECTIONS = [
  {
    id: "website",
    href: serviceBriefHref("website"),
    icon: GlobeIcon,
    reverse: false,
    visual: (
      <DeviceFrame variant="desktop" depth="tile" label="Illustrative branded website">
        <DemoWebsite />
      </DeviceFrame>
    )
  },
  {
    id: "custom_apps_platforms",
    href: serviceBriefHref("custom_apps_platforms"),
    icon: AppsIcon,
    reverse: true,
    visual: (
      <DeviceFrame variant="desktop" depth="tile" label="Illustrative custom app">
        <DemoApp />
      </DeviceFrame>
    )
  },
  {
    id: "ecommerce_storefronts",
    href: serviceBriefHref("ecommerce_storefronts"),
    icon: StoreIcon,
    reverse: false,
    visual: (
      <DeviceFrame variant="desktop" depth="tile" label="Illustrative storefront">
        <DemoStore />
      </DeviceFrame>
    )
  },
  {
    id: "digital_infrastructure",
    href: serviceBriefHref("digital_infrastructure"),
    icon: NodesIcon,
    reverse: true,
    hash: "digital-infrastructure",
    visual: (
      <DeviceFrame variant="desktop" depth="tile" label="Illustrative infrastructure workflow">
        <DemoInfra />
      </DeviceFrame>
    )
  }
] as const;

export default function ServicesPage() {
  return (
    <section className="container section">
      <p className="kicker">Services</p>
      <h1>What can be commissioned now.</h1>
      <p className="lede">
        Plan prices are listed on the pricing page. Aethelios may explain only these approved
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
              <div className="service-spec-visual" aria-hidden="true">
                {section.visual}
              </div>
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

      <Reveal as="article" className="service-feature surface-ivory custom-invite-block" delay={1}>
        <div>
          <p className="tiny">Secondary route</p>
          <h2>Have another project in mind?</h2>
          <p className="lede">
            Need a useful tool for your work, studies, or a personal project? Bring the idea. We’ll
            help define what’s worth building. These commissions use the same review path, with a
            scope that fits the request.
          </p>
          <AppLink className="btn btn-emerald-glass" href="/custom-projects">
            Other custom projects
          </AppLink>
        </div>
        <div className="surface-read service-spec">
          <h3>What this is</h3>
          <ul>
            <li>A professional workflow, study tool, or bounded personal utility</li>
            <li>The same founder review, proposal, and delivery path</li>
            <li>A smaller complete scope when the project is smaller</li>
          </ul>
          <h3>What this is not</h3>
          <ul>
            <li>A self-serve coding platform</li>
            <li>A replacement for business clients as the central audience</li>
            <li>A promise that every idea will be accepted</li>
          </ul>
        </div>
      </Reveal>

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
