import { safeCallbackUrl } from "./callbackUrl";

/** Keep the complete private-work destination through sign-in and optional draft review. */
export function signInDestination(next: unknown, hasGuestDraft: boolean) {
  const destination = safeCallbackUrl(next);
  if (!hasGuestDraft || destination.startsWith("/account/adopt")) return destination;
  return `/account/adopt?next=${encodeURIComponent(destination)}`;
}

export function afterAdoption(next: unknown, projectId: string) {
  const destination = safeCallbackUrl(next, "");
  if (!destination || destination === "/account" || destination.startsWith("/account/adopt")) {
    return `/workspace/${encodeURIComponent(projectId)}`;
  }
  return destination;
}

export function accountLink(destination: string) {
  return `/account?next=${encodeURIComponent(safeCallbackUrl(destination))}`;
}
