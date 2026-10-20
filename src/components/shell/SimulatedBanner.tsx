import type { User } from "@/lib/types";

export function SimulatedBanner({
  auth,
  user
}: {
  auth: { adapter: string; labeled: boolean; ready: boolean };
  user: User | null;
}) {
  if (auth.adapter === "authjs" && auth.ready) return null;
  if (!auth.ready && !auth.labeled) return null;
  const identity = auth.ready
    ? "sign-in is a labeled local simulator"
    : "sign-in is not configured";
  return (
    <div className="sim-banner" role="status">
      Development preview · {identity}
      {user ? ` · signed in as ${user.email}` : " · guest drafts stay on this device"}
    </div>
  );
}
