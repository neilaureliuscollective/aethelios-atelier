"use client";

import { useState } from "react";
import { AppLink } from "@/components/ui/AppLink";
import {
  DemoApp,
  DemoInfra,
  DemoStore,
  DemoWebsite,
  DeviceFrame
} from "@/components/marketing/DeviceFrame";
import { SERVICE_CATEGORY_COPY, type VisibleProjectType } from "@/lib/serviceCategories";

const OPTIONS: Array<{ id: Exclude<VisibleProjectType, "undecided">; href: string }> = [
  { id: "website", href: "/discover?interest=website" },
  { id: "custom_apps_platforms", href: "/discover?interest=custom_apps_platforms" },
  { id: "ecommerce_storefronts", href: "/discover?interest=ecommerce_storefronts" },
  { id: "digital_infrastructure", href: "/discover?interest=digital_infrastructure" }
];

function preview(id: (typeof OPTIONS)[number]["id"]) {
  switch (id) {
    case "website":
      return (
        <DeviceFrame variant="desktop" label="Illustrative branded website">
          <DemoWebsite />
        </DeviceFrame>
      );
    case "custom_apps_platforms":
      return (
        <DeviceFrame variant="desktop" label="Illustrative custom app">
          <DemoApp />
        </DeviceFrame>
      );
    case "ecommerce_storefronts":
      return (
        <DeviceFrame variant="desktop" label="Illustrative storefront">
          <DemoStore />
        </DeviceFrame>
      );
    default:
      return (
        <DeviceFrame variant="desktop" label="Illustrative infrastructure workflow">
          <DemoInfra />
        </DeviceFrame>
      );
  }
}

export function PossibilitiesStage() {
  const [active, setActive] = useState<(typeof OPTIONS)[number]["id"]>("website");
  const current = OPTIONS.find((item) => item.id === active) ?? OPTIONS[0]!;
  const copy = SERVICE_CATEGORY_COPY[active];

  return (
    <div className="possibilities">
      <div className="possibilities-tabs" role="tablist" aria-label="Commission possibilities">
        {OPTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active === item.id}
            id={`possibility-${item.id}`}
            aria-controls="possibility-panel"
            className="possibility-tab"
            onClick={() => setActive(item.id)}
          >
            {SERVICE_CATEGORY_COPY[item.id].title}
          </button>
        ))}
      </div>
      <div
        className="possibilities-panel"
        role="tabpanel"
        id="possibility-panel"
        aria-labelledby={`possibility-${active}`}
      >
        <div className="possibilities-visual">{preview(active)}</div>
        <div className="possibilities-copy">
          <p className="tiny">{copy.short}</p>
          <h3>{copy.title}</h3>
          <p className="muted">{copy.summary}</p>
          <p className="tiny">Illustrative concept — not a completed client project or result.</p>
          <AppLink className="btn btn-emerald-glass" href={current.href}>
            {copy.action}
          </AppLink>
        </div>
      </div>
    </div>
  );
}
