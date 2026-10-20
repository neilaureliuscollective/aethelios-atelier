import { AppLink } from "@/components/ui/AppLink";
import { DemoWebsite, DeviceFrame } from "@/components/marketing/DeviceFrame";
import { SERVICE_CATEGORY_COPY, serviceBriefHref } from "@/lib/serviceCategories";

/** Dimensional product frame using a real website demonstration, not a screenshot of this UI. */
export function HeroComposition() {
  return (
    <div className="hero-composition" aria-label="Demonstration of a digital presence">
      <div className="composition-glow" aria-hidden="true" />
      <DeviceFrame variant="desktop" label="Illustrative branded website">
        <DemoWebsite />
      </DeviceFrame>
      <div className="chips" role="group" aria-label="Commission paths">
        <AppLink className="chip chip-control" href={serviceBriefHref("website")}>
          {SERVICE_CATEGORY_COPY.website.title}
        </AppLink>
        <AppLink className="chip chip-control" href={serviceBriefHref("custom_apps_platforms")}>
          {SERVICE_CATEGORY_COPY.custom_apps_platforms.title}
        </AppLink>
        <AppLink className="chip chip-control" href={serviceBriefHref("ecommerce_storefronts")}>
          {SERVICE_CATEGORY_COPY.ecommerce_storefronts.title}
        </AppLink>
        <AppLink className="chip chip-control" href={serviceBriefHref("digital_infrastructure")}>
          {SERVICE_CATEGORY_COPY.digital_infrastructure.title}
        </AppLink>
      </div>
      <p className="tiny composition-note">Illustrative concept — not a completed client project.</p>
    </div>
  );
}
