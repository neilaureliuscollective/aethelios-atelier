import { BrandMark } from "@/components/brand/BrandMark";
import { AppLink } from "@/components/ui/AppLink";
import { BEGIN_HREF, BEGIN_LABEL } from "@/lib/publicSite";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <div className="footer-brand">
          <BrandMark variant="lockup" withWordmark={false} size={56} />
          <p>Founder-led digital infrastructure</p>
        </div>
        <nav className="row" aria-label="Footer">
          <AppLink href={BEGIN_HREF}>{BEGIN_LABEL}</AppLink>
          <AppLink href="/services">Services</AppLink>
          <AppLink href="/custom-projects">Custom work</AppLink>
          <AppLink href="/pricing">Investment</AppLink>
          <AppLink href="/approach">Approach</AppLink>
          <AppLink href="/about">About</AppLink>
          <AppLink href="/inquire">Inquire</AppLink>
        </nav>
        <nav className="row footer-legal" aria-label="Legal">
          <AppLink href="/privacy">Privacy</AppLink>
          <AppLink href="/terms">Terms</AppLink>
        </nav>
        <p>Neil Stutes reviews every commission. Aethelios is a guide, not a substitute.</p>
      </div>
    </footer>
  );
}
