"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { BrandMark } from "@/components/brand/BrandMark";
import { AppLink } from "@/components/ui/AppLink";
import { FULL_LOGO } from "@/lib/brand/fullLogo";
import { BEGIN_HREF, BEGIN_LABEL } from "@/lib/publicSite";

export const MOBILE_NAV_ID = "site-mobile-nav";
export const MOBILE_NAV_BREAKPOINT = "(max-width: 720px)";

const links = [
  { href: "/services", label: "Services" },
  { href: "/custom-projects", label: "Custom work" },
  { href: "/pricing", label: "Investment" },
  { href: "/approach", label: "Approach" },
  { href: "/about", label: "About" },
  { href: "/inquire", label: "Inquire" }
];

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const home = pathname === "/";

  const close = useCallback((restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) {
      toggleRef.current?.focus();
    }
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  useEffect(() => {
    const media = window.matchMedia(MOBILE_NAV_BREAKPOINT);
    const onChange = () => {
      if (!media.matches) {
        setOpen(false);
      }
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <BrandMark variant="lockup" withWordmark={false} size={76} priority lockupSrc={FULL_LOGO.lockupSrc} />
        <nav className="nav-desktop" aria-label="Primary">
          {links.map((link) => (
            <AppLink key={link.href} href={link.href} aria-current={pathname === link.href ? "page" : undefined}>
              {link.label}
            </AppLink>
          ))}
        </nav>
        <div className="header-actions">
          {!home ? (
            <AppLink className="btn btn-gold" href={BEGIN_HREF}>
              {BEGIN_LABEL}
            </AppLink>
          ) : null}
          <button
            ref={toggleRef}
            className="menu-toggle"
            type="button"
            aria-expanded={open}
            aria-controls={MOBILE_NAV_ID}
            onClick={() => setOpen((value) => !value)}
          >
            Menu
          </button>
        </div>
      </div>
      <nav
        id={MOBILE_NAV_ID}
        className={`mobile-nav ${open ? "open" : ""}`}
        hidden={!open}
        aria-label="Mobile"
      >
        {links.map((link) => (
          <AppLink
            key={link.href}
            href={link.href}
            aria-current={pathname === link.href ? "page" : undefined}
            onClick={() => close()}
          >
            {link.label}
          </AppLink>
        ))}
        <AppLink className="mobile-nav-cta" href={BEGIN_HREF} onClick={() => close()}>
          {BEGIN_LABEL}
        </AppLink>
      </nav>
    </header>
  );
}
