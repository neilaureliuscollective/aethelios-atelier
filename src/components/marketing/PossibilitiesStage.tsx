"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { AppLink } from "@/components/ui/AppLink";
import {
  DemoApp,
  DemoInfra,
  DemoStore,
  DemoWebsite,
  DeviceFrame
} from "@/components/marketing/DeviceFrame";
import { nextRovingIndex } from "@/lib/a11y/rovingTab";
import { SERVICE_CATEGORY_COPY, serviceBriefHref, type VisibleProjectType } from "@/lib/serviceCategories";

const OPTIONS: Array<Exclude<VisibleProjectType, "undecided">> = [
  "website",
  "custom_apps_platforms",
  "ecommerce_storefronts",
  "digital_infrastructure"
];

function preview(id: (typeof OPTIONS)[number]) {
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
  const [active, setActive] = useState<(typeof OPTIONS)[number]>("website");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const copy = SERVICE_CATEGORY_COPY[active];

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = nextRovingIndex(index, event.key, OPTIONS.length);
    if (next == null) return;
    event.preventDefault();
    const id = OPTIONS[next]!;
    setActive(id);
    tabRefs.current[next]?.focus();
  }

  return (
    <div className="possibilities">
      <div className="possibilities-tabs" role="tablist" aria-label="Commission possibilities">
        {OPTIONS.map((id, index) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active === id}
            tabIndex={active === id ? 0 : -1}
            id={`possibility-${id}`}
            aria-controls="possibility-panel"
            className="possibility-tab"
            ref={(node) => {
              tabRefs.current[index] = node;
            }}
            onClick={() => setActive(id)}
            onKeyDown={(event) => onTabKeyDown(event, index)}
          >
            {SERVICE_CATEGORY_COPY[id].title}
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
          <AppLink className="btn btn-emerald-glass" href={serviceBriefHref(active)}>
            {copy.action}
          </AppLink>
        </div>
      </div>
    </div>
  );
}
