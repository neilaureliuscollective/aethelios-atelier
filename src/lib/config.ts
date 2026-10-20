import "server-only";
import path from "node:path";
import { z } from "zod";
import { CONSENT_TEXT } from "@/lib/copy";
import {
  authjsAuthAllowed,
  hostedEphemeralPersistenceReason,
  hostedPlatformName,
  readAuthSecret,
  readDatabaseUrl,
  simulatedAuthAllowed,
  type AuthjsProviderState
} from "@/lib/runtime/hosted";

export { CONSENT_TEXT };

const schema = z.object({
  nodeEnv: z.enum(["development", "test", "production"]).default("development"),
  persistenceAdapter: z
    .enum(["sqlite_local", "memory", "postgres", "unconfigured"])
    .default("unconfigured"),
  dataDir: z.string().default(".data"),
  databaseUrl: z.string().optional().default(""),
  authAdapter: z.enum(["simulated", "authjs", "unconfigured"]).default("unconfigured"),
  sessionSecret: z.string().optional().default(""),
  founderEmails: z.string().default("neil.local@atelier.invalid"),
  publicOrigin: z.string().optional().default(""),
  openAiEnabled: z.string().optional().default("false"),
  openAiKey: z.string().optional().default(""),
  openAiModel: z.string().default("gpt-4o-mini"),
  openAiTimeoutMs: z.coerce.number().int().positive().default(25_000),
  openAiMaxOutputTokens: z.coerce.number().int().positive().default(900),
  openAiDailyLimit: z.coerce.number().int().positive().default(24),
  billingEnabled: z.string().optional().default("false")
});

export type PersistenceState =
  | {
      adapter: "sqlite_local";
      ready: true;
      sqlitePath: string;
    }
  | {
      adapter: "memory";
      ready: true;
    }
  | {
      adapter: "postgres";
      ready: true;
      databaseUrl: string;
    }
  | {
      adapter: "sqlite_local" | "memory" | "postgres" | "unconfigured";
      ready: false;
      sqlitePath?: string;
      databaseUrl?: string;
      missing?: string;
    };

export type AppConfig = z.infer<typeof schema> & {
  founderEmailList: string[];
  platform: string | null;
  persistence: PersistenceState;
  auth: {
    adapter: "simulated" | "authjs" | "unconfigured";
    ready: boolean;
    labeled: boolean;
    missing?: string;
    providers: AuthjsProviderState[];
    secretConfigured: boolean;
  };
  aurelius: {
    enabled: boolean;
    ready: boolean;
    model: string;
    missing?: string;
  };
  billing: {
    enabled: boolean;
    ready: false;
    message: string;
  };
};

function readEnv() {
  return schema.parse({
    nodeEnv: process.env.NODE_ENV ?? "development",
    persistenceAdapter: process.env.ATELIER_PERSISTENCE_ADAPTER ?? "unconfigured",
    dataDir: process.env.ATELIER_DATA_DIR ?? ".data",
    databaseUrl: readDatabaseUrl(process.env),
    authAdapter: process.env.ATELIER_AUTH_ADAPTER ?? "unconfigured",
    sessionSecret: readAuthSecret(process.env),
    founderEmails: process.env.ATELIER_FOUNDER_EMAILS ?? "neil.local@atelier.invalid",
    publicOrigin:
      process.env.ATELIER_PUBLIC_ORIGIN ||
      (process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : ""),
    openAiEnabled: process.env.ATELIER_OPENAI_ENABLED ?? "false",
    openAiKey: process.env.OPENAI_API_KEY ?? "",
    openAiModel: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    openAiTimeoutMs: process.env.ATELIER_OPENAI_TIMEOUT_MS ?? "25000",
    openAiMaxOutputTokens: process.env.ATELIER_OPENAI_MAX_OUTPUT_TOKENS ?? "900",
    openAiDailyLimit: process.env.ATELIER_OPENAI_DAILY_LIMIT_PER_PROJECT ?? "24",
    billingEnabled: process.env.ATELIER_BILLING_ENABLED ?? "false"
  });
}

function persistenceState(env: z.infer<typeof schema>): PersistenceState {
  if (env.persistenceAdapter === "unconfigured") {
    return { adapter: "unconfigured", ready: false, missing: "ATELIER_PERSISTENCE_ADAPTER" };
  }

  const ephemeral = hostedEphemeralPersistenceReason(env.persistenceAdapter);
  if (ephemeral) {
    return { adapter: env.persistenceAdapter, ready: false, missing: ephemeral };
  }

  if (env.persistenceAdapter === "postgres") {
    const databaseUrl = env.databaseUrl.trim();
    if (!databaseUrl) {
      return {
        adapter: "postgres",
        ready: false,
        missing: "DATABASE_URL (or POSTGRES_URL / ATELIER_DATABASE_URL)"
      };
    }
    return { adapter: "postgres", ready: true, databaseUrl };
  }

  if (env.persistenceAdapter === "sqlite_local") {
    return {
      adapter: "sqlite_local",
      ready: true,
      sqlitePath: path.resolve(env.dataDir, "atelier.sqlite")
    };
  }

  return { adapter: "memory", ready: true };
}

export function loadConfig(): AppConfig {
  const env = readEnv();
  const founderEmailList = env.founderEmails
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  const persistence = persistenceState(env);
  const simulated = simulatedAuthAllowed(process.env);
  const authjs = authjsAuthAllowed(process.env);
  const secretConfigured = env.sessionSecret.length >= 32;
  const openAiExplicitlyEnabled = env.openAiEnabled === "true";
  const hasKey = Boolean(env.openAiKey.trim());

  const auth = simulated.allowed
    ? {
        adapter: "simulated" as const,
        ready: true,
        labeled: true,
        providers: [] as AuthjsProviderState[],
        secretConfigured
      }
    : authjs.allowed
      ? {
          adapter: "authjs" as const,
          ready: true,
          labeled: false,
          providers: authjs.providers,
          secretConfigured
        }
      : {
          adapter:
            env.authAdapter === "simulated"
              ? ("simulated" as const)
              : env.authAdapter === "authjs"
                ? ("authjs" as const)
                : ("unconfigured" as const),
          ready: false,
          labeled: env.authAdapter === "simulated",
          missing:
            env.authAdapter === "authjs"
              ? authjs.reason
              : env.authAdapter === "simulated"
                ? simulated.reason
                : "ATELIER_AUTH_ADAPTER",
          providers: [] as AuthjsProviderState[],
          secretConfigured
        };

  return {
    ...env,
    founderEmailList,
    platform: hostedPlatformName(process.env),
    persistence,
    auth,
    aurelius: {
      enabled: openAiExplicitlyEnabled,
      ready: openAiExplicitlyEnabled && hasKey,
      model: env.openAiModel,
      missing: !openAiExplicitlyEnabled
        ? "ATELIER_OPENAI_ENABLED is not true — live model calls stay off until separately authorized"
        : !hasKey
          ? "OPENAI_API_KEY is not set"
          : undefined
    },
    billing: {
      enabled: false,
      ready: false,
      message:
        "Billing is an isolated future boundary. Stripe is not activated and no payment collection exists."
    }
  };
}

export function publicRuntimeConfig() {
  const config = loadConfig();
  return {
    platform: config.platform,
    persistence: {
      adapter: config.persistence.adapter,
      ready: config.persistence.ready,
      labeled: config.persistence.adapter !== "unconfigured"
    },
    auth: {
      adapter: config.auth.adapter,
      ready: config.auth.ready,
      labeled: config.auth.labeled,
      missing: config.auth.missing,
      providers: config.auth.providers.map((provider) => ({
        id: provider.id,
        label: provider.label,
        capture: provider.capture === true
      })),
      identities:
        config.auth.adapter === "simulated" && config.auth.ready
          ? [
              {
                email: "owner.local@atelier.invalid",
                role: "client",
                label: "Simulated owner"
              },
              {
                email: "owner-two.local@atelier.invalid",
                role: "client",
                label: "Simulated second owner"
              },
              {
                email: "neil.local@atelier.invalid",
                role: "founder",
                label: "Simulated founder"
              }
            ]
          : []
    },
    aurelius: {
      ready: config.aurelius.ready,
      unavailableReason: config.aurelius.ready ? undefined : config.aurelius.missing
    },
    billing: config.billing,
    pricing: {
      status: "not_finalized" as const,
      note: "Plan prices are shown in USD. Payments are not collected here. A written proposal confirms deliverables and remaining terms before work begins."
    },
    companion: {
      routes: ["/companion", "/companion/talk", "/companion/studio", "/companion/work", "/companion/business"],
      voiceReady: false,
      voiceCommissioned: false,
      billingActivated: false,
      note: "Companion entitlements are server-checked. Client flags do not grant access. Commercial prices stay out of this public config until billing is reviewed. Live voice stays gated until provider duration evidence exists."
    }
  };
}
