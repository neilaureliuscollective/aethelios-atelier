"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
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

const SessionContext = createContext<SessionValue | null>(null);

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error("useSession must be used inside SessionShell.");
  }
  return value;
}

export function SessionShell({
  auth,
  children
}: {
  auth: { adapter: string; labeled: boolean; ready: boolean };
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [generation, setGeneration] = useState(0);

  const applyUser = useCallback((next: User | null) => {
    const remembered =
      typeof window === "undefined" ? null : window.sessionStorage.getItem("atelier.lastOwner");
    const previousId = ownerFence.ownerId ?? remembered;
    if (previousId && next === null) {
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

  const value = useMemo(
    () => ({ user, loading, refresh, generation }),
    [user, loading, refresh, generation]
  );

  return (
    <SessionContext.Provider value={value}>
      <SimulatedBanner auth={auth} user={user} />
      <SiteHeader user={user} />
      <main id="main">{children}</main>
      <SiteFooter />
    </SessionContext.Provider>
  );
}
