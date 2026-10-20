"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "@/components/shell/SessionShell";
import { api } from "@/lib/client/api";
import { actionErrorMessage } from "@/lib/client/asyncAction";
import { accountLink } from "@/lib/auth/continuation";
import { readGuestIntent } from "@/lib/guest/intent";
import styles from "./companion.module.css";

type WorkspaceGate = "checking" | "ready" | "confirm" | "error";

export function CompanionShell({
  title,
  lede,
  wide = false,
  compact = false,
  children
}: {
  title: string;
  lede: string;
  wide?: boolean;
  compact?: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const { user, loading } = useSession();
  const [businessName, setBusinessName] = useState("");
  const [signInHref, setSignInHref] = useState(accountLink(pathname));
  const [workspaceError, setWorkspaceError] = useState("");
  const [retryNonce, setRetryNonce] = useState(0);
  const [studioGate, setStudioGate] = useState<WorkspaceGate>("checking");

  useEffect(() => {
    setSignInHref(accountLink(window.location.pathname + window.location.search + window.location.hash));
  }, [pathname]);

  useEffect(() => {
    let active = true;
    setBusinessName("");
    setWorkspaceError("");
    if (!user) return;
    setStudioGate("checking");
    void api<{
      business: { name: string };
      confirmation: { sourceSelectionId: string | null; studioDraftId?: string | null } | null;
    }>("/api/companion/workspace")
      .then((data) => {
        if (!active) return;
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
      .catch((err) => {
        if (!active) return;
        setBusinessName("");
        setWorkspaceError(actionErrorMessage(err, "This workspace could not be verified."));
        setStudioGate("error");
      });
    return () => {
      active = false;
    };
  }, [user, pathname, retryNonce]);

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
          <a className="btn btn-gold" href={signInHref}>
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
          <p className={styles.meta}>{pathname.startsWith("/companion/studio") ? "Studio" : "Workspace"}</p>
          <h1>Checking this workspace</h1>
          <p className="lede">
            Resolving the signed-in owner
            {pathname.startsWith("/companion/studio")
              ? " and any confirmed Discovery draft before a composition is shown."
              : " before private actions are available."}
          </p>
        </div>
      </section>
    );
  }

  if (studioGate === "error") {
    return (
      <section className={`container ${styles.shell}`}>
        <div className={`surface-glass ${styles.gate}`}>
          <p className={styles.meta}>Workspace verification failed</p>
          <h1>This private workspace is not ready</h1>
          <p className="lede">
            {workspaceError || "The signed-in owner could not be verified. Private actions stay blocked."}
          </p>
          <p className={styles.meta}>
            The brief and any unsaved work on this device were not treated as a successful open.
          </p>
          <button
            className="btn btn-gold"
            type="button"
            onClick={() => {
              setStudioGate("checking");
              setRetryNonce((value) => value + 1);
            }}
          >
            Retry verification
          </button>
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
      <header className={`${styles.pageHead} ${compact ? styles.compactHead : ""}`}>
        <p className={styles.context}>
          <strong>{businessName || "Atelier workspace"}</strong>
          <span>{user.displayName || user.email}</span>
        </p>
        <h1>{title}</h1>
        {!compact ? <p className="lede">{lede}</p> : null}
        {!compact ? <p className={styles.meta}>{nextHint}</p> : null}
      </header>
      {children}
    </section>
  );
}
