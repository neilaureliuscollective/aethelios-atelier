import { ZodError, z } from "zod";
import { aureliusStatus } from "@/lib/aurelius/boundary";
import { ConciergeEngine } from "@/lib/concierge/engine";
import { emptyConciergeFacts, isConciergeIntent } from "@/lib/concierge/types";
import { buildWelcome } from "@/lib/concierge/starting";
import { conciergeRateLimited } from "@/lib/concierge/rateLimit";
import { clipHistory, looksLikeMaliciousInput, sanitizeConciergeMessage } from "@/lib/concierge/safety";
import { handleError, json, readJson } from "@/lib/http";
import { LimitError } from "@/lib/domain/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const turnSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        body: z.string().max(2000)
      })
    )
    .max(20)
    .optional()
    .default([]),
  facts: z
    .object({
      business: z.string().max(240).optional(),
      audience: z.string().max(240).optional(),
      problem: z.string().max(400).optional(),
      outcome: z.string().max(400).optional(),
      currentSite: z.string().max(240).optional(),
      intent: z.string().max(40).optional(),
      timeline: z.string().max(120).optional(),
      budget: z.string().max(120).optional(),
      asked: z.array(z.string().max(40)).max(20).optional()
    })
    .optional(),
  pagePath: z.string().max(180).optional().default("/"),
  spoken: z.boolean().optional().default(false),
  idempotencyKey: z.string().min(8).max(80).optional()
});

const recent = new Map<string, unknown>();

function clientKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") || "unknown";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const path = url.searchParams.get("path") || "/";
  const status = aureliusStatus();
  return json({ ok: true, ...buildWelcome(path, status.ready) });
}

export async function POST(request: Request) {
  try {
    const key = clientKey(request);
    if (conciergeRateLimited(key)) {
      throw new LimitError("Too many concierge messages from this connection. Try again later.");
    }
    const parsed = turnSchema.parse(await readJson(request));
    if (parsed.idempotencyKey && recent.has(parsed.idempotencyKey)) {
      return json(recent.get(parsed.idempotencyKey));
    }
    const message = sanitizeConciergeMessage(parsed.message);
    if (!message) {
      return json({ ok: false, error: "invalid", message: "Write a short question or choose a starting point." }, 400);
    }
    const facts = emptyConciergeFacts({
      ...parsed.facts,
      intent: isConciergeIntent(parsed.facts?.intent) ? parsed.facts?.intent : undefined,
      asked: parsed.facts?.asked ?? []
    });
    if (looksLikeMaliciousInput(message)) {
      facts.intent = /api[_-]?key|secret|password|internal/i.test(message) ? "secrets" : "injection";
    }
    const engine = new ConciergeEngine();
    const result = await engine.turn({
      message,
      history: clipHistory(parsed.history),
      facts,
      pagePath: parsed.pagePath,
      spoken: parsed.spoken,
      signal: request.signal
    });
    if (parsed.idempotencyKey) recent.set(parsed.idempotencyKey, result);
    return json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      return json(
        { ok: false, error: "invalid", message: "That message could not be accepted. Try a shorter question in your own words." },
        400
      );
    }
    return handleError(error);
  }
}
