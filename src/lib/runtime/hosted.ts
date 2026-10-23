const HOSTED_FLAGS = [
  "VERCEL",
  "NETLIFY",
  "FLY_APP_NAME",
  "RAILWAY_ENVIRONMENT",
  "RENDER",
  "CF_PAGES",
  "HEROKU_APP_NAME"
] as const;

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

type Env = Record<string, string | undefined>;

export function hostedPlatformName(env: Env = process.env): string | null {
  if (env.ATELIER_HOSTED === "true") return env.ATELIER_HOSTED_NAME || "hosted";
  for (const flag of HOSTED_FLAGS) {
    if (env[flag]) return flag.toLowerCase();
  }
  return null;
}

export function isIsolatedLocal(env: Env = process.env): boolean {
  return env.ATELIER_ISOLATED_LOCAL === "true";
}

/** Exact hostname only. `localhost.example.com` is not loopback. */
export function parseOriginHostname(origin: string): string | null {
  const trimmed = origin.trim();
  if (!trimmed) return null;
  try {
    const candidate = trimmed.includes("://") ? trimmed : `http://${trimmed}`;
    const url = new URL(candidate);
    const hostname = url.hostname.replace(/^\[/, "").replace(/\]$/, "").toLowerCase();
    return hostname || null;
  } catch {
    return null;
  }
}

export function isExactLoopbackHostname(hostname: string | null): boolean {
  if (!hostname) return false;
  return LOOPBACK_HOSTS.has(hostname);
}

function isExactLoopbackOrigin(env: Env): boolean {
  const origin = env.ATELIER_PUBLIC_ORIGIN ?? "";
  return isExactLoopbackHostname(parseOriginHostname(origin));
}

export function readDatabaseUrl(env: Env = process.env): string {
  return (env.ATELIER_DATABASE_URL || env.POSTGRES_URL || env.DATABASE_URL || "").trim();
}

export function hostedEphemeralPersistenceReason(
  adapter: string,
  env: Env = process.env
): string | null {
  const hosted = hostedPlatformName(env);
  if (!hosted) return null;
  if (adapter === "sqlite_local" || adapter === "memory") {
    return `${adapter} is ephemeral on hosted platform (${hosted}). Set ATELIER_PERSISTENCE_ADAPTER=postgres and DATABASE_URL (or POSTGRES_URL) to a dedicated Atelier database — never the Aethelios production database.`;
  }
  return null;
}

export function simulatedAuthAllowed(env: Env = process.env): {
  allowed: boolean;
  reason?: string;
} {
  if (env.ATELIER_AUTH_ADAPTER !== "simulated") {
    return { allowed: false, reason: "ATELIER_AUTH_ADAPTER is not simulated" };
  }
  if (env.ATELIER_ALLOW_SIMULATED_AUTH !== "true") {
    return {
      allowed: false,
      reason: "Simulated auth requires ATELIER_ALLOW_SIMULATED_AUTH=true"
    };
  }
  const hosted = hostedPlatformName(env);
  if (hosted) {
    return {
      allowed: false,
      reason: `Simulated auth is refused on hosted platform (${hosted}), even if ATELIER_ISOLATED_LOCAL is set.`
    };
  }
  if (env.NODE_ENV === "production") {
    if (!isIsolatedLocal(env) || !isExactLoopbackOrigin(env)) {
      return {
        allowed: false,
        reason:
          "Production-mode simulated auth requires ATELIER_ISOLATED_LOCAL=true and an exact loopback hostname (localhost, 127.0.0.1, or ::1). Hosted execution is refused."
      };
    }
  }
  return { allowed: true };
}

export function readAuthSecret(env: Env = process.env): string {
  return (env.AUTH_SECRET || env.ATELIER_SESSION_SECRET || env.NEXTAUTH_SECRET || "").trim();
}

export function readGoogleOAuth(env: Env = process.env): { id: string; secret: string } {
  return {
    id: (env.AUTH_GOOGLE_ID || env.GOOGLE_CLIENT_ID || "").trim(),
    secret: (env.AUTH_GOOGLE_SECRET || env.GOOGLE_CLIENT_SECRET || "").trim()
  };
}

export function readOpenAiApiKey(env: Env = process.env): string {
  return (
    env.OPENAI_API_KEY ||
    env.ATELIER_OPENAI_API_KEY ||
    env.OPENAI_KEY ||
    env.AUTH_OPENAI_KEY ||
    ""
  ).trim();
}

export function readResendEmail(env: Env = process.env): { apiKey: string; from: string } {
  return {
    apiKey: (env.AUTH_RESEND_KEY || env.RESEND_API_KEY || "").trim(),
    from: (env.AUTH_RESEND_FROM || env.ATELIER_AUTH_EMAIL_FROM || "").trim()
  };
}

export function emailCaptureAllowed(env: Env = process.env): {
  allowed: boolean;
  reason?: string;
} {
  if (env.ATELIER_AUTH_EMAIL_CAPTURE !== "true") {
    return { allowed: false, reason: "ATELIER_AUTH_EMAIL_CAPTURE is not true" };
  }
  const hosted = hostedPlatformName(env);
  if (hosted) {
    return {
      allowed: false,
      reason: `Email capture is refused on hosted platform (${hosted}). Set AUTH_GOOGLE_ID/AUTH_GOOGLE_SECRET and/or AUTH_RESEND_KEY/AUTH_RESEND_FROM.`
    };
  }
  if (env.NODE_ENV === "production") {
    if (!isIsolatedLocal(env) || !isExactLoopbackOrigin(env)) {
      return {
        allowed: false,
        reason:
          "Production-mode email capture requires ATELIER_ISOLATED_LOCAL=true and an exact loopback hostname. It is not production sign-in."
      };
    }
  }
  return { allowed: true };
}

export type AuthjsProviderId = "google" | "email";

export type AuthjsProviderState = {
  id: AuthjsProviderId;
  label: string;
  capture?: boolean;
};

export function authjsProviders(env: Env = process.env): AuthjsProviderState[] {
  const providers: AuthjsProviderState[] = [];
  const google = readGoogleOAuth(env);
  if (google.id && google.secret) {
    providers.push({ id: "google", label: "Google" });
  }
  const resend = readResendEmail(env);
  const capture = emailCaptureAllowed(env);
  if (resend.apiKey && resend.from) {
    providers.push({ id: "email", label: "Email" });
  } else if (capture.allowed) {
    providers.push({ id: "email", label: "Email (captured locally)", capture: true });
  }
  return providers;
}

export function authjsAuthAllowed(env: Env = process.env): {
  allowed: boolean;
  reason?: string;
  providers: AuthjsProviderState[];
} {
  if (env.ATELIER_AUTH_ADAPTER !== "authjs") {
    return { allowed: false, reason: "ATELIER_AUTH_ADAPTER is not authjs", providers: [] };
  }
  const secret = readAuthSecret(env);
  if (secret.length < 32) {
    return {
      allowed: false,
      reason: "Auth.js requires AUTH_SECRET or ATELIER_SESSION_SECRET (32+ characters). Do not guess a hosted value.",
      providers: []
    };
  }
  const providers = authjsProviders(env);
  if (!providers.length) {
    const capture = emailCaptureAllowed(env);
    return {
      allowed: false,
      reason: capture.reason
        ? `No Auth.js provider is configured. Set AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET, or AUTH_RESEND_KEY and AUTH_RESEND_FROM. ${capture.reason}`
        : "No Auth.js provider is configured. Set AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET, or AUTH_RESEND_KEY and AUTH_RESEND_FROM. Do not enable fake production sign-in.",
      providers: []
    };
  }
  return { allowed: true, providers };
}
