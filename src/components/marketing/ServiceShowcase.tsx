import { AppLink } from "@/components/ui/AppLink";
import { AppsIcon, GlobeIcon, NodesIcon, StoreIcon } from "@/components/ui/Icons";
import {
  DemoApp,
  DemoInfra,
  DemoStore,
  DemoWebsite,
  DeviceFrame
} from "@/components/marketing/DeviceFrame";
import { SERVICE_CATALOG } from "@/lib/catalog";
import { SERVICE_CATEGORY_COPY } from "@/lib/serviceCategories";

const CARDS = [
  {
    id: "website" as const,
    href: "/discover?interest=website",
    icon: GlobeIcon,
    visual: (
      <DeviceFrame variant="tablet" depth="tile" label="Branded website demonstration">
        <DemoWebsite />
      </DeviceFrame>
    )
  },
  {
    id: "custom_apps_platforms" as const,
    href: "/project?interest=custom_apps_platforms&purpose=business",
    icon: AppsIcon,
    visual: (
      <DeviceFrame variant="tablet" depth="tile" label="Custom app demonstration">
        <DemoApp />
      </DeviceFrame>
    )
  },
  {
    id: "ecommerce_storefronts" as const,
    href: "/discover?interest=ecommerce_storefronts",
    icon: StoreIcon,
    visual: (
      <DeviceFrame variant="tablet" depth="tile" label="Storefront demonstration">
        <DemoStore />
      </DeviceFrame>
    )
  },
  {
    id: "digital_infrastructure" as const,
    href: "/project?interest=digital_infrastructure&purpose=business",
    icon: NodesIcon,
    visual: (
      <DeviceFrame variant="tablet" depth="tile" label="Infrastructure demonstration">
        <DemoInfra />
      </DeviceFrame>
    )
  }
];

export function ServiceShowcase() {
  return (
    <div className="service-showcase">
      {CARDS.map((card) => {
        const offer = SERVICE_CATALOG.offers.find((item) => item.id === card.id);
        const Icon = card.icon;
        const copy = SERVICE_CATEGORY_COPY[card.id];
        return (
          <AppLink className="service-link" href={card.href} key={card.id}>
            <article className="service-tile">
              <div className="service-tile-visual" aria-hidden="true">
                {card.visual}
              </div>
              <div className="service-tile-copy">
                <Icon />
                <p className="tiny">{copy.short}</p>
                <h3>{offer?.title ?? copy.title}</h3>
                <p className="muted">{copy.summary}</p>
                <p className="service-tile-action">
                  {copy.action}
                  <span aria-hidden="true"> →</span>
                </p>
              </div>
            </article>
          </AppLink>
        );
      })}
    </div>
  );
}
