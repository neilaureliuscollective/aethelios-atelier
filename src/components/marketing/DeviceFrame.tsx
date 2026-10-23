import type { ReactNode } from "react";
import {
  CoteauFieldSite,
  CoteauYard,
  NightjarRoast,
  SableReserve
} from "@/components/marketing/ExampleBusinesses";

export function DeviceFrame({
  variant,
  label,
  depth = "stage",
  children
}: {
  variant: "desktop" | "tablet" | "phone";
  label: string;
  depth?: "hero" | "stage" | "tile";
  children: ReactNode;
}) {
  return (
    <figure className={`device device-${variant} device-depth-${depth}`}>
      <div className="device-bezel" aria-hidden="true">
        <span className="device-camera" />
        {variant === "desktop" ? <span className="device-chrome">yourbrand.com</span> : null}
        <span className="device-glass" />
      </div>
      <div className="device-screen">{children}</div>
      <div className="device-edge" aria-hidden="true" />
      <figcaption className="sr-only">{label}</figcaption>
    </figure>
  );
}

export function DemoWebsite() {
  return <CoteauFieldSite />;
}

export function DemoApp() {
  return <CoteauYard />;
}

export function DemoStore() {
  return <NightjarRoast />;
}

export function DemoInfra() {
  return <SableReserve />;
}
