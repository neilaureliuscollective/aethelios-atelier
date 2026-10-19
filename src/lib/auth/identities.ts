import type { PersistenceAdapter } from "@/lib/persistence/adapter";
import type { User } from "@/lib/types";

export const SIMULATED_USERS: Array<Omit<User, "createdAt">> = [
  {
    id: "user_owner_local",
    email: "owner.local@atelier.invalid",
    displayName: "Simulated owner",
    role: "client",
    adapter: "simulated"
  },
  {
    id: "user_owner_two_local",
    email: "owner-two.local@atelier.invalid",
    displayName: "Simulated second owner",
    role: "client",
    adapter: "simulated"
  },
  {
    id: "user_founder_local",
    email: "neil.local@atelier.invalid",
    displayName: "Neil Stutes",
    role: "founder",
    adapter: "simulated"
  }
];

export function seedSimulatedUsers(store: PersistenceAdapter, founderEmails: string[]) {
  const now = new Date().toISOString();
  for (const seed of SIMULATED_USERS) {
    const existing = store.getUserByEmail(seed.email);
    const role = founderEmails.includes(seed.email.toLowerCase()) ? "founder" : seed.role;
    store.upsertUser({
      ...(existing ?? { createdAt: now }),
      ...seed,
      role,
      createdAt: existing?.createdAt ?? now
    });
  }
}
