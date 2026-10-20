"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { atelierSurfaceForPath } from "@/lib/atelierSurface";
import type { Route } from "next";
import { SiteHeader } from "@/components/shell/SiteHeader";
import { SiteFooter } from "@/components/shell/SiteFooter";
import { SimulatedBanner } from "@/components/shell/SimulatedBanner";
import { api } from "@/lib/client/api";
import { ownerFence } from "@/lib/client/ownerFence";
import { clearOwnerScopedData } from "@/lib/client/ownerScope";
import type { User } from "@/lib/types";

type SessionValue = {
  user: User | null;
  loading: boolean;
  refresh: () => Promise<void>;
  generation: number;
};

type PublicAuth = { adapter: string; labeled: boolean; ready: boolean };

const SessionContext = createContext<SessionValue | null>(null);

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error("useSession must be used inside SessionShell.");
  }
  return value;
}

export function SessionShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const surface = atelierSurfaceForPath(pathname);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [generation, setGeneration] = useState(0);
  const [auth, setAuth] = useState<PublicAuth | null>(null);

  useEffect(() => {
    const onNav = (event: Event) => {
      const href = (event as CustomEvent<string>).detail;
      if (typeof href === "string" && href.startsWith("/")) {
        router.push(href as Route);
      }
    };
    window.addEventListener("atelier:client-navigate", onNav);
    return () => window.removeEventListener("atelier:client-navigate", onNav);
  }, [router]);

  const applyUser = useCallback((next: User | null) => {
    const remembered =
      typeof window === "undefined" ? null : window.sessionStorage.getItem("atelier.lastOwner");
    const previousId = ownerFence.ownerId ?? remembered;
    if (previousId && next === null) {
      ownerFence.markSignOut(previousId);
      clearOwnerScopedData(previousId);
      window.sessionStorage.removeItem("atelier.lastOwner");
    }
    if (next?.id && typeof window !== "undefined") {
      window.sessionStorage.setItem("atelier.lastOwner", next.id);
    }
    const gen = ownerFence.switchTo(next?.id ?? null);
    setGeneration(gen);
    setUser(next);
  }, []);

  const refresh = useCallback(async () => {
    const session = await api<{ user: User | null }>("/api/session");
    applyUser(session.user);
  }, [applyUser]);

  useEffect(() => {
    void refresh().finally(() => setLoading(false));
  }, [refresh]);

  useEffect(() => {
    void api<{ auth: PublicAuth }>("/api/config")
      .then((config) => setAuth(config.auth))
      .catch(() => setAuth({ adapter: "unconfigured", labeled: false, ready: false }));
  }, []);

  const value = useMemo(
    () => ({ user, loading, refresh, generation }),
    [user, loading, refresh, generation]
  );

  return (
    <SessionContext.Provider value={value}>
      <div className="app-root" data-surface={surface}>
        <div className="atmosphere" aria-hidden="true" />
        {auth ? <SimulatedBanner auth={auth} user={user} /> : null}
        <SiteHeader user={user} />
        <main id="main">{children}</main>
        <SiteFooter />
      </div>
    </SessionContext.Provider>
  );
}
