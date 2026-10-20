"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AppLink } from "@/components/ui/AppLink";
import { useSession } from "@/components/shell/SessionShell";
import styles from "./companion.module.css";

const LINKS = [
  { href: "/companion", label: "Today" },
  { href: "/companion/talk", label: "Talk" },
  { href: "/companion/studio", label: "Studio" },
  { href: "/companion/work", label: "Work" },
  { href: "/companion/business", label: "Business" }
];

export function CompanionShell({
  title,
  lede,
  children
}: {
  title: string;
  lede: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const { user, loading } = useSession();

  if (loading) {
    return (
      <section className="container section">
        <p className="kicker">Aethelios</p>
        <h1>Opening your workspace…</h1>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="container section">
        <p className="kicker">Private companion</p>
        <h1>Sign in to continue with Aethelios</h1>
        <p className="lede">This is your business workspace — not a public chatbot and not a guest draft.</p>
        <a className="btn btn-gold" href="/account?next=/companion">
          Sign in
        </a>
      </section>
    );
  }

  return (
    <section className={`container ${styles.shell}`}>
      <div>
        <p className="kicker">Aethelios · digital co-founder</p>
        <h1>{title}</h1>
        <p className="lede">{lede}</p>
        <p className="tiny">Signed in as {user.email}. Membership is checked on the server for every action.</p>
      </div>
      <nav className={styles.nav} aria-label="Companion">
        {LINKS.map((link) => (
          <AppLink
            key={link.href}
            href={link.href}
            aria-current={pathname === link.href ? "page" : undefined}
          >
            {link.label}
          </AppLink>
        ))}
      </nav>
      {children}
    </section>
  );
}
