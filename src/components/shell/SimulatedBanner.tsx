import type { User } from "@/lib/types";

export function SimulatedBanner({
  auth,
  user
}: {
  auth: { adapter: string; labeled: boolean; ready: boolean };
  user: User | null;
}) {
  if (!auth.ready && !auth.labeled) return null;
  return (
    <div className="sim-banner" role="status">
      Local candidate · {auth.adapter === "simulated" ? "simulated identity adapter" : "auth unconfigured"}
      {user ? ` · signed in as ${user.email}` : " · guest drafts stay on this device"}
    </div>
  );
}
