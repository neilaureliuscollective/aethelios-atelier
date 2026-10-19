"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { BrandMark } from "@/components/brand/BrandMark";
import { AppLink } from "@/components/ui/AppLink";
import type { User } from "@/lib/types";

const links = [
  { href: "/services", label: "Services" },
  { href: "/approach", label: "Approach" },
  { href: "/about", label: "About" }
];

export function SiteHeader({ user }: { user: User | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const compact = pathname.startsWith("/project") || pathname.startsWith("/workspace") || pathname.startsWith("/founder");

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <BrandMark />
        <nav className="nav-desktop" aria-label="Primary">
          {links.map((link) => (
            <AppLink key={link.href} href={link.href} aria-current={pathname === link.href ? "page" : undefined}>
              {link.label}
            </AppLink>
          ))}
          {user?.role === "founder" ? <AppLink href="/founder">Founder</AppLink> : null}
          {user ? <AppLink href="/workspace">Workspace</AppLink> : null}
        </nav>
        <div className="header-actions">
          {user ? (
            <AppLink className="btn btn-ghost" href="/account">
              {user.displayName}
            </AppLink>
          ) : (
            <AppLink className="btn btn-ghost" href="/account">
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
        {links.map((link) => (
          <AppLink key={link.href} href={link.href} onClick={() => setOpen(false)}>
            {link.label}
          </AppLink>
        ))}
        <AppLink href={user ? "/project/new" : "/project"} onClick={() => setOpen(false)}>
          Begin your project
        </AppLink>
        <AppLink href={user ? "/workspace" : "/account"} onClick={() => setOpen(false)}>
          {user ? "Workspace" : "Sign in"}
        </AppLink>
        {user?.role === "founder" ? (
          <AppLink href="/founder" onClick={() => setOpen(false)}>
            Founder
          </AppLink>
        ) : null}
      </nav>
    </header>
  );
}
