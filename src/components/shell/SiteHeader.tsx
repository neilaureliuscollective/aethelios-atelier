"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { BrandMark } from "@/components/brand/BrandMark";
import { AppLink } from "@/components/ui/AppLink";
import { FULL_LOGO } from "@/lib/brand/fullLogo";
import type { User } from "@/lib/types";

export const MOBILE_NAV_ID = "site-mobile-nav";
export const MOBILE_NAV_BREAKPOINT = "(max-width: 720px)";

const links = [
  { href: "/discover", label: "Discover" },
  { href: "/services", label: "Services" },
  { href: "/pricing", label: "Pricing" },
  { href: "/approach", label: "Approach" },
  { href: "/about", label: "About" },
  { href: "/inquire", label: "Inquire" }
];

const workspaceLinks = [
  { href: "/companion", label: "Today" },
  { href: "/companion/talk", label: "Talk" },
  { href: "/companion/studio", label: "Studio" },
  { href: "/companion/work", label: "Work" },
  { href: "/companion/business", label: "Business" },
  { href: "/companion/confirm", label: "Confirm" }
];

function currentWorkspace(pathname: string, href: string) {
  return href === "/companion" ? pathname === "/companion" : pathname.startsWith(href);
}

function currentPublic(pathname: string, href: string) {
  const path = href.split("?")[0] ?? href;
  if (path === "/") return pathname === "/";
  if (path === "/project" || path === "/project/new") return pathname.startsWith("/project");
  if (path === "/account") return pathname.startsWith("/account");
  if (path === "/companion") return pathname.startsWith("/companion");
  return pathname === path;
}

export function SiteHeader({ user }: { user: User | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const companion = pathname.startsWith("/companion");
  const compact =
    companion ||
    pathname.startsWith("/project") ||
    pathname.startsWith("/workspace") ||
    pathname.startsWith("/founder") ||
    pathname.startsWith("/discover");

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
        <BrandMark
          variant={companion ? "mark" : "lockup"}
          withWordmark={false}
          size={companion ? 40 : 76}
          priority
          lockupSrc={companion ? undefined : FULL_LOGO.lockupSrc}
        />
        {companion ? (
          user ? (
          <nav className="nav-desktop workspace-nav" aria-label="Atelier workspace">
            {workspaceLinks.map((link) => (
              <AppLink
                key={link.href}
                href={link.href}
                aria-current={currentWorkspace(pathname, link.href) ? "page" : undefined}
              >
                {link.label}
              </AppLink>
            ))}
          </nav>
          ) : (
            <nav className="nav-desktop workspace-nav" aria-label="Atelier workspace">
              <span className="muted">Private workspace</span>
            </nav>
          )
        ) : (
          <nav className="nav-desktop" aria-label="Primary">
            {links.map((link) => (
              <AppLink key={link.href} href={link.href} aria-current={pathname === link.href ? "page" : undefined}>
                {link.label}
              </AppLink>
            ))}
            {user?.role === "founder" ? <AppLink href="/founder">Founder</AppLink> : null}
            {user ? <AppLink href="/workspace">Commissions</AppLink> : null}
            {user ? <AppLink href="/companion">Business Studio</AppLink> : null}
          </nav>
        )}
        <div className="header-actions">
          {companion ? (
            <AppLink className="btn btn-ghost btn-compact" href="/">
              Public site
            </AppLink>
          ) : null}
          {!compact ? (
            <AppLink className="btn btn-gold" href={user ? "/project/new" : "/project"}>
              Begin your project
            </AppLink>
          ) : null}
          {user ? (
            <AppLink className="btn btn-ghost" href="/account">
              {user.displayName}
            </AppLink>
          ) : (
            <AppLink className="btn btn-ghost" href={companion ? "/account?next=/companion" : "/account"}>
              Sign in
            </AppLink>
          )}
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
        {companion
          ? (user ? workspaceLinks : []).map((link) => (
              <AppLink
                key={link.href}
                href={link.href}
                aria-current={currentWorkspace(pathname, link.href) ? "page" : undefined}
                onClick={() => close()}
              >
                {link.label}
              </AppLink>
            ))
          : links.map((link) => (
              <AppLink
                key={link.href}
                href={link.href}
                aria-current={currentPublic(pathname, link.href) ? "page" : undefined}
                onClick={() => close()}
              >
                {link.label}
              </AppLink>
            ))}
        {companion ? (
          <AppLink href="/" aria-current={currentPublic(pathname, "/") ? "page" : undefined} onClick={() => close()}>
            Public site
          </AppLink>
        ) : (
          <AppLink
            className="mobile-nav-cta"
            href={user ? "/project/new" : "/project"}
            aria-current={currentPublic(pathname, "/project") ? "page" : undefined}
            onClick={() => close()}
          >
            Begin your project
          </AppLink>
        )}
        <AppLink
          href={user ? "/account" : companion ? "/account?next=/companion" : "/account"}
          aria-current={currentPublic(pathname, "/account") ? "page" : undefined}
          onClick={() => close()}
        >
          {user ? "Account" : "Sign in"}
        </AppLink>
        {!companion && user ? (
          <>
            <AppLink
              href="/workspace"
              aria-current={currentPublic(pathname, "/workspace") ? "page" : undefined}
              onClick={() => close()}
            >
              Commissions
            </AppLink>
            <AppLink
              href="/companion"
              aria-current={currentPublic(pathname, "/companion") ? "page" : undefined}
              onClick={() => close()}
            >
              Business Studio
            </AppLink>
          </>
        ) : null}
        {user?.role === "founder" ? (
          <AppLink
            href="/founder"
            aria-current={currentPublic(pathname, "/founder") ? "page" : undefined}
            onClick={() => close()}
          >
            Founder
          </AppLink>
        ) : null}
      </nav>
    </header>
  );
}
