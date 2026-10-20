import { AppLink } from "@/components/ui/AppLink";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <p>Aethelios Atelier · Founder-led digital infrastructure</p>
        <nav className="row" aria-label="Footer">
          <AppLink href="/discover">Discover</AppLink>
          <AppLink href="/services">Services</AppLink>
          <AppLink href="/pricing">Pricing</AppLink>
          <AppLink href="/approach">Approach</AppLink>
          <AppLink href="/project">Begin a brief</AppLink>
        </nav>
        <p>Neil Stutes reviews every commission. Aethelios is a guide, not a substitute.</p>
      </div>
    </footer>
  );
}
