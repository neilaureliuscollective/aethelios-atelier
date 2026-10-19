import "server-only";
import path from "node:path";
import { z } from "zod";
import { CONSENT_TEXT } from "@/lib/copy";

export { CONSENT_TEXT };

const schema = z.object({
  nodeEnv: z.enum(["development", "test", "production"]).default("development"),
  persistenceAdapter: z.enum(["sqlite_local", "memory", "unconfigured"]).default("unconfigured"),
  dataDir: z.string().default(".data"),
  authAdapter: z.enum(["simulated", "unconfigured"]).default("unconfigured"),
  sessionSecret: z.string().optional().default(""),
  founderEmails: z.string().default("neil.local@atelier.invalid"),
  openAiEnabled: z.string().optional().default("false"),
  openAiKey: z.string().optional().default(""),
  openAiModel: z.string().default("gpt-4o-mini"),
  openAiTimeoutMs: z.coerce.number().int().positive().default(25_000),
  openAiMaxOutputTokens: z.coerce.number().int().positive().default(900),
  openAiDailyLimit: z.coerce.number().int().positive().default(24),
  billingEnabled: z.string().optional().default("false")
});

export type AppConfig = z.infer<typeof schema> & {
  founderEmailList: string[];
  persistence: {
    adapter: "sqlite_local" | "memory" | "unconfigured";
    ready: boolean;
    sqlitePath?: string;
    missing?: string;
  };
  auth: {
    adapter: "simulated" | "unconfigured";
    ready: boolean;
    labeled: boolean;
    missing?: string;
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
    authAdapter: process.env.ATELIER_AUTH_ADAPTER ?? "unconfigured",
    sessionSecret: process.env.ATELIER_SESSION_SECRET ?? "",
    founderEmails: process.env.ATELIER_FOUNDER_EMAILS ?? "neil.local@atelier.invalid",
    openAiEnabled: process.env.ATELIER_OPENAI_ENABLED ?? "false",
    openAiKey: process.env.OPENAI_API_KEY ?? "",
    openAiModel: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    openAiTimeoutMs: process.env.ATELIER_OPENAI_TIMEOUT_MS ?? "25000",
    openAiMaxOutputTokens: process.env.ATELIER_OPENAI_MAX_OUTPUT_TOKENS ?? "900",
    openAiDailyLimit: process.env.ATELIER_OPENAI_DAILY_LIMIT_PER_PROJECT ?? "24",
    billingEnabled: process.env.ATELIER_BILLING_ENABLED ?? "false"
  });
}

export function loadConfig(): AppConfig {
  const env = readEnv();
  const founderEmailList = env.founderEmails
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  const persistenceReady = env.persistenceAdapter !== "unconfigured";
  const authReady = env.authAdapter === "simulated";
  const openAiExplicitlyEnabled = env.openAiEnabled === "true";
  const hasKey = Boolean(env.openAiKey.trim());

  return {
    ...env,
    founderEmailList,
    persistence: persistenceReady
      ? {
          adapter: env.persistenceAdapter,
          ready: true,
          sqlitePath:
            env.persistenceAdapter === "sqlite_local"
              ? path.resolve(env.dataDir, "atelier.sqlite")
              : undefined
        }
      : {
          adapter: "unconfigured",
          ready: false,
          missing: "ATELIER_PERSISTENCE_ADAPTER"
        },
    auth: authReady
      ? { adapter: "simulated", ready: true, labeled: true }
      : {
          adapter: "unconfigured",
          ready: false,
          labeled: false,
          missing: "ATELIER_AUTH_ADAPTER"
        },
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
    persistence: {
      adapter: config.persistence.adapter,
      ready: config.persistence.ready,
      labeled: config.persistence.adapter !== "unconfigured"
    },
    auth: {
      adapter: config.auth.adapter,
      ready: config.auth.ready,
      labeled: config.auth.labeled,
      identities: config.auth.ready
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
      note: "Pricing and commercial terms are not finalized. Estimates are nonbinding until Neil confirms a proposal."
    }
  };
}

