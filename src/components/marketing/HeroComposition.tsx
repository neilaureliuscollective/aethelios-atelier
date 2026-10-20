import { AppLink } from "@/components/ui/AppLink";
import { DemoWebsite, DeviceFrame } from "@/components/marketing/DeviceFrame";

/** Dimensional product frame using a real website demonstration, not a screenshot of this UI. */
export function HeroComposition() {
  return (
    <div className="hero-composition" aria-label="Demonstration of a digital presence">
      <div className="composition-glow" aria-hidden="true" />
      <DeviceFrame variant="desktop" label="Demonstration website">
        <DemoWebsite
          name="Aethelios Atelier"
          kicker="Your project, given form"
          headline="What would you like to bring to life?"
          image="/atmosphere/colonnade.webp"
          imageAlt="Architectural light used as atmosphere inside a website demonstration"
          action="Begin"
        />
      </DeviceFrame>
      <div className="chips" role="group" aria-label="Commission paths">
        <AppLink className="chip chip-control" href="/discover?interest=website">
          Branded websites
        </AppLink>
        <AppLink className="chip chip-control" href="/discover?interest=custom_apps_platforms">
          Custom apps & platforms
        </AppLink>
        <AppLink className="chip chip-control" href="/discover?interest=ecommerce_storefronts">
          E-commerce & storefronts
        </AppLink>
        <AppLink className="chip chip-control" href="/discover?interest=digital_infrastructure">
          Digital infrastructure
        </AppLink>
      </div>
      <p className="tiny composition-note">Demonstration of digital work — not a completed client project.</p>
    </div>
  );
}
