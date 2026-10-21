export type PublicSignInProvider = {
  id: "google" | "email";
  label: string;
};

export function signInProviderSentence(providers: PublicSignInProvider[]): string {
  const labels = providers.map((provider) => provider.label).filter(Boolean);
  const review =
    "Signing in is free. It does not start a subscription, create a payment, or grant founder access. You will review any device draft before it belongs to this account.";
  if (labels.length === 0) {
    return `Sign-in options will appear here when they are available. ${review}`;
  }
  if (labels.length === 1) {
    return `Sign in with ${labels[0]}. ${review}`;
  }
  if (labels.length === 2) {
    return `Sign in with ${labels[0]} or ${labels[1]}. ${review}`;
  }
  const last = labels[labels.length - 1];
  return `Sign in with ${labels.slice(0, -1).join(", ")}, or ${last}. ${review}`;
}

export function authSurfaceState(input: {
  config: { auth: { ready: boolean } } | null;
  error: string;
}): "loading" | "unavailable" | "ready" {
  if (!input.config) return input.error ? "unavailable" : "loading";
  return input.config.auth.ready ? "ready" : "unavailable";
}
