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
  const simulated = auth.ready;
  return (
    <details className="sim-banner" role="status">
      <summary>
        {simulated
          ? "Local rehearsal · this is a labeled simulated session, not a real sign-in"
          : "Sign-in is not configured · guest drafts stay on this device"}
        {user ? ` · ${user.email}` : ""}
      </summary>
      <p>
        {simulated
          ? "The account switcher is a local simulator for rehearsal. It does not prove Google or Resend authentication."
          : "A real Auth.js provider is still required before hosted rehearsal."}{" "}
        Mode: {auth.adapter}.
      </p>
    </details>
  );
}
