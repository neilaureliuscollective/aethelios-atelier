"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "@/components/shell/SessionShell";
import { api } from "@/lib/client/api";
import { readGuestIntent } from "@/lib/guest/intent";
import styles from "./companion.module.css";

export function CompanionShell({
  title,
  lede,
  wide = false,
  children
}: {
  title: string;
  lede: string;
  wide?: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const { user, loading } = useSession();
  const [businessName, setBusinessName] = useState("");
  const [studioGate, setStudioGate] = useState<"checking" | "ready" | "confirm">(
    pathname.startsWith("/companion/studio") ? "checking" : "ready"
  );

  useEffect(() => {
    if (!user) return;
    if (pathname.startsWith("/companion/studio")) {
      setStudioGate("checking");
    }
    void api<{
      business: { name: string };
      confirmation: { sourceSelectionId: string | null; studioDraftId?: string | null } | null;
    }>("/api/companion/workspace")
      .then((data) => {
        setBusinessName(data.business.name);
        const intent = readGuestIntent();
        if (
          pathname.startsWith("/companion/studio") &&
          intent?.selectionId &&
          data.confirmation?.sourceSelectionId !== intent.selectionId
        ) {
          setStudioGate("confirm");
        } else {
          setStudioGate("ready");
        }
      })
      .catch(() => {
        setBusinessName("");
        if (pathname.startsWith("/companion/studio")) {
          setStudioGate("ready");
        }
      });
  }, [user, pathname]);

  if (loading) {
    return (
      <section className={`container ${styles.shell}`}>
        <div className={`surface-glass ${styles.gate}`}>
          <p className={styles.meta}>Aethelios Atelier</p>
          <h1>Opening your workspace</h1>
          <p className="lede">Restoring the signed-in business context.</p>
        </div>
      </section>
    );
  }

  if (!user) {
    return (
      <section className={`container ${styles.shell}`}>
        <div className={`surface-glass ${styles.gate}`}>
          <p className={styles.meta}>Private workspace</p>
          <h1>Sign in to continue with Aethelios</h1>
          <p className="lede">
            This is your business workspace — not a public chatbot and not a guest draft.
          </p>
          <a className="btn btn-gold" href={`/account?next=${encodeURIComponent(pathname || "/companion")}`}>
            Sign in
          </a>
        </div>
      </section>
    );
  }

  if (studioGate === "checking") {
    return (
      <section className={`container ${styles.shell}`}>
        <div className={`surface-glass ${styles.gate}`}>
          <p className={styles.meta}>Studio</p>
          <h1>Checking this workspace</h1>
          <p className="lede">
            Resolving the signed-in owner and any confirmed Discovery draft before a composition is shown.
          </p>
        </div>
      </section>
    );
  }

  if (studioGate === "confirm") {
    return (
      <section className={`container ${styles.shell}`}>
        <div className={`surface-glass ${styles.gate}`}>
          <p className={styles.meta}>Confirm first</p>
          <h1>Review the business before Studio</h1>
          <p className="lede">
            A Discovery direction is waiting. Confirm the business and that exact selection so Studio
            cannot silently adopt another tab’s version.
          </p>
          <a className="btn btn-gold" href="/companion/confirm">
            Confirm business and direction
          </a>
        </div>
      </section>
    );
  }

  const nextHint = pathname.startsWith("/companion/studio")
    ? "Save or export this exact composition."
    : pathname.startsWith("/companion/talk")
      ? "Save copy, then open that exact item in Studio."
      : pathname.startsWith("/companion/work")
        ? "Open the exact saved item in Studio — never another draft."
        : "Choose Talk, Studio, or Work for this project.";

  return (
    <section className={`${wide ? "container-wide" : "container"} ${styles.shell}`}>
      <header className={styles.pageHead}>
        <p className={styles.context}>
          <strong>{businessName || "Atelier workspace"}</strong>
          <span>{user.displayName || user.email}</span>
        </p>
        <h1>{title}</h1>
        <p className="lede">{lede}</p>
        <p className={styles.meta}>{nextHint}</p>
      </header>
      {children}
    </section>
  );
}
