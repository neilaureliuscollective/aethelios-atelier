"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { BrandMark } from "@/components/brand/BrandMark";
import { AppLink } from "@/components/ui/AppLink";
import { FULL_LOGO } from "@/lib/brand/fullLogo";
import type { User } from "@/lib/types";

const links = [
  { href: "/discover", label: "Discover" },
  { href: "/services", label: "Services" },
  { href: "/pricing", label: "Pricing" },
  { href: "/approach", label: "Approach" },
  { href: "/about", label: "About" }
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

export function SiteHeader({ user }: { user: User | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const companion = pathname.startsWith("/companion");
  const compact =
    companion ||
    pathname.startsWith("/project") ||
    pathname.startsWith("/workspace") ||
    pathname.startsWith("/founder") ||
    pathname.startsWith("/discover");

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
            {user ? <AppLink href="/workspace">Workspace</AppLink> : null}
            {user ? <AppLink href="/companion">Companion</AppLink> : null}
          </nav>
        )}
        <div className="header-actions">
          {companion ? (
            <AppLink className="btn btn-ghost btn-compact" href="/">
              Public site
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
          {!compact ? (
            <AppLink className="btn btn-gold" href={user ? "/project/new" : "/project"}>
              Begin your project
            </AppLink>
          ) : null}
          <button className="menu-toggle" type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            Menu
          </button>
        </div>
      </div>
      <nav className={`mobile-nav ${open ? "open" : ""}`} hidden={!open} aria-label="Mobile">
        {companion
          ? (user ? workspaceLinks : []).map((link) => (
              <AppLink key={link.href} href={link.href} onClick={() => setOpen(false)}>
                {link.label}
              </AppLink>
            ))
          : links.map((link) => (
              <AppLink key={link.href} href={link.href} onClick={() => setOpen(false)}>
                {link.label}
              </AppLink>
            ))}
        {companion ? (
          <AppLink href="/" onClick={() => setOpen(false)}>
            Public site
          </AppLink>
        ) : (
          <AppLink href={user ? "/project/new" : "/project"} onClick={() => setOpen(false)}>
            Begin your project
          </AppLink>
        )}
        <AppLink href={user ? "/account" : companion ? "/account?next=/companion" : "/account"} onClick={() => setOpen(false)}>
          {user ? "Account" : "Sign in"}
        </AppLink>
        {!companion && user ? (
          <AppLink href="/companion" onClick={() => setOpen(false)}>
            Companion
          </AppLink>
        ) : null}
        {user?.role === "founder" ? (
          <AppLink href="/founder" onClick={() => setOpen(false)}>
            Founder
          </AppLink>
        ) : null}
      </nav>
    </header>
  );
}
