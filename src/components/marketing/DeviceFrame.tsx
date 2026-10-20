import type { ReactNode } from "react";

export function DeviceFrame({
  variant,
  label,
  children
}: {
  variant: "desktop" | "tablet" | "phone";
  label: string;
  children: ReactNode;
}) {
  return (
    <figure className={`device device-${variant}`}>
      <div className="device-bezel" aria-hidden="true">
        <span className="device-camera" />
      </div>
      <div className="device-screen">{children}</div>
      <figcaption className="sr-only">{label}</figcaption>
    </figure>
  );
}

export function DemoWebsite({
  name,
  kicker,
  headline,
  image,
  imageAlt,
  action
}: {
  name: string;
  kicker: string;
  headline: string;
  image: string;
  imageAlt: string;
  action: string;
}) {
  return (
    <div className="demo-site">
      <header className="demo-nav">
        <strong>{name}</strong>
        <span>Home</span>
        <span>Work</span>
        <span>Contact</span>
      </header>
      <div className="demo-hero">
        <div>
          <p>{kicker}</p>
          <h3>{headline}</h3>
          <span className="demo-cta">{action}</span>
        </div>
        <img src={image} alt={imageAlt} width={640} height={360} />
      </div>
      <p className="demo-label">Demonstration of a digital presence — not a completed client project.</p>
    </div>
  );
}

export function DemoApp() {
  return (
    <div className="demo-app">
      <header className="demo-nav">
        <strong>Studio portal</strong>
        <span>Overview</span>
        <span>Tasks</span>
      </header>
      <div className="demo-app-grid">
        <div>
          <p>Queue</p>
          <strong>12 open items</strong>
        </div>
        <div>
          <p>Next review</p>
          <strong>Thursday</strong>
        </div>
        <div className="demo-app-wide">
          <p>Purpose-built screens</p>
          <span>Demonstration of a web tool. Not a live operations product.</span>
        </div>
      </div>
    </div>
  );
}

export function DemoStore() {
  return (
    <div className="demo-store">
      <header className="demo-nav">
        <strong>Atelier still</strong>
        <span>Shop</span>
        <span>Journal</span>
      </header>
      <div className="demo-store-body">
        <img
          src="/atmosphere/storefront.webp"
          alt="Editorial product still used as storefront demonstration atmosphere, not a sold item"
          width={400}
          height={300}
        />
        <div>
          <p>Seasonal edit</p>
          <h3>Quiet objects, clearly presented.</h3>
          <span className="demo-cta">View the collection</span>
          <p className="demo-label">Demonstration storefront. Payments are not collected here.</p>
        </div>
      </div>
    </div>
  );
}

export function DemoInfra() {
  return (
    <div className="demo-infra">
      <header className="demo-nav">
        <strong>Workflow map</strong>
        <span>Systems</span>
      </header>
      <ol>
        <li>Site</li>
        <li>Existing tools</li>
        <li>Handoff</li>
      </ol>
      <p className="demo-label">Demonstration of practical connections — not a proprietary platform.</p>
    </div>
  );
}
