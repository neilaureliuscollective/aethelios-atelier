"use client";

import { useState } from "react";
import { DeviceFrame } from "@/components/marketing/DeviceFrame";
import { ValeCrownDemo } from "@/components/marketing/barbers/ValeCrownDemo";
import { DEMO_VIEW_LABELS, DEMO_VIEWS, type DemoView } from "@/lib/offers/demo";

export function BarbersSalonShowcase() {
  const [view, setView] = useState<DemoView>("story");

  return (
    <div className="barbers-showcase">
      <div className="hero-stage barbers-stage">
        <div className="hero-stage-glow" aria-hidden="true" />
        <div className="hero-desktop-wrap">
          <DeviceFrame variant="desktop" depth="hero" label="Fictional Vale & Crown website on a desktop">
            <ValeCrownDemo view={view} onView={setView} density="desktop" />
          </DeviceFrame>
        </div>
        <div className="hero-phone-wrap barbers-phone-wrap">
          <DeviceFrame variant="phone" depth="hero" label="Fictional Vale & Crown website on a phone">
            <ValeCrownDemo view={view} onView={setView} density="phone" compact />
          </DeviceFrame>
        </div>
      </div>
      <div className="barbers-demo-nav" role="group" aria-label="Demonstration views">
        {DEMO_VIEWS.map((item) => (
          <button
            key={item}
            className="chip"
            type="button"
            aria-pressed={view === item}
            onClick={() => setView(item)}
          >
            {DEMO_VIEW_LABELS[item]}
          </button>
        ))}
      </div>
      <p className="hero-stage-note barbers-stage-note">
        One fictional shop, shown at desktop and phone. Navigation stays inside this demonstration.
        Booking explains an external-provider handoff and does not create an appointment.
      </p>
    </div>
  );
}
