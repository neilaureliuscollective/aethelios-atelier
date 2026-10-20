import { aureliusStatus } from "@/lib/aurelius/boundary";
import { companionSystemPrompt } from "@/lib/cofounder/instructions";
import { buildAuthorizedModelContext } from "@/lib/cofounder/isolation";
import { CompanionUsage } from "@/lib/cofounder/usage";
import { CompanionWorkspace } from "@/lib/cofounder/workspace";
import { loadConfig } from "@/lib/config";
import { LimitError, UnconfiguredError } from "@/lib/domain/errors";
import type { PersistenceAdapter } from "@/lib/persistence/adapter";
import type { User } from "@/lib/types";

export const VOICE_LIMITATION =
  "Handshake is not a billed voice minute. Live voice stays gated until OpenAI duration evidence can be reconciled. A successful SDP exchange does not commission voice.";

export type VoiceCapability = {
  ready: boolean;
  live: boolean;
  commissioned: boolean;
  transport: "webrtc";
  providerPath: "openai_realtime_sessions" | "unavailable";
  reason?: string;
  prerequisite?: string;
  limitation: string;
};

export function voiceCapability(): VoiceCapability {
  const commissioned = process.env.ATELIER_VOICE_COMMISSIONED === "true";
  const status = aureliusStatus();
  if (!status.ready) {
    const prerequisite =
      status.reason ??
      "Voice requires ATELIER_OPENAI_ENABLED=true and OPENAI_API_KEY. This is not a simulated conversation.";
    return {
      ready: false,
      live: false,
      commissioned: false,
      transport: "webrtc",
      providerPath: "unavailable",
      reason: prerequisite,
      prerequisite,
      limitation: VOICE_LIMITATION
    };
  }
  return {
    ready: commissioned,
    live: commissioned,
    commissioned,
    transport: "webrtc",
    providerPath: "openai_realtime_sessions",
    reason: commissioned ? undefined : VOICE_LIMITATION,
    prerequisite: commissioned ? undefined : VOICE_LIMITATION,
    limitation: VOICE_LIMITATION
  };
}

type VoiceFetch = typeof fetch;

export class CompanionVoice {
  constructor(
    private readonly store: PersistenceAdapter,
    private readonly workspace = new CompanionWorkspace(store),
    private readonly usage = new CompanionUsage(store),
    private readonly fetchImpl: VoiceFetch = fetch
  ) {}

  async createWebRtcSession(input: {
    businessId: string;
    user: User;
    sdp: string;
    operationId?: string;
  }) {
    const capability = voiceCapability();
    if (!aureliusStatus().ready) {
      throw new UnconfiguredError(capability.prerequisite ?? capability.reason ?? "Voice is not configured.");
    }
    if (!capability.commissioned) {
      throw new UnconfiguredError(VOICE_LIMITATION);
    }
    if (!input.sdp.trim()) {
      throw new LimitError("An SDP offer is required to start a voice session.");
    }
    await this.workspace.requireMutable(input.businessId, input.user);
    const context = await this.workspace.requireMembership(input.businessId, input.user);
    const reservation = await this.usage.reserve(
      input.businessId,
      input.user,
      "voice",
      0,
      {
        transport: "webrtc",
        stage: "session_open",
        billed: false
      },
      input.operationId
    );
    const config = loadConfig();
    const modelContext = buildAuthorizedModelContext({ context, history: [] });
    const instructions = `${companionSystemPrompt()}\nAuthorized workspace:\n${JSON.stringify(modelContext)}`;
    try {
      const scoped = await this.configureScopedSession(config.openAiKey, instructions);
      const handshake = scoped.clientSecret
        ? await this.completeWithClientSecret(config.openAiKey, scoped.clientSecret, input.sdp)
        : await this.completeWithLiveSession(config.openAiKey, instructions, input.sdp);
      if (!handshake.sdp) {
        throw new UnconfiguredError("OpenAI returned a voice session without an SDP answer. Voice did not connect.");
      }
      return {
        ok: true as const,
        transport: "webrtc" as const,
        sdp: handshake.sdp,
        instructions,
        workspaceBound: scoped.workspaceBound === true,
        sessionConfigured: scoped.workspaceBound === true,
        usageEventId: reservation.event.id,
        billedMinutes: 0,
        limitation: VOICE_LIMITATION
      };
    } catch (error) {
      await this.usage.release(reservation);
      throw error;
    }
  }

  async endSession(input: { businessId: string; user: User; usageEventId: string; startedAt: string }) {
    const event = await this.store.companion.getUsageEvent(input.usageEventId);
    if (!event || event.businessId !== input.businessId) {
      throw new UnconfiguredError("That voice session is not in this workspace.");
    }
    await this.usage.release({ event });
    const elapsedMs = Math.max(0, Date.now() - new Date(input.startedAt).getTime());
    const minutes = elapsedMs === 0 ? 0 : Math.max(1, Math.ceil(elapsedMs / 60_000));
    if (minutes > 0 && process.env.ATELIER_VOICE_RECONCILE === "true") {
      await this.usage.consume(input.businessId, input.user, "voice", minutes, {
        stage: "session_end",
        elapsedMs,
        note: "Local elapsed time only. Not provider duration evidence."
      });
    }
    return { billedMinutes: 0, elapsedMs, limitation: VOICE_LIMITATION };
  }

  private async configureScopedSession(apiKey: string, instructions: string) {
    const model = process.env.OPENAI_VOICE_MODEL || "gpt-realtime";
    const response = await this.fetchImpl("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        instructions,
        voice: "verse"
      })
    });
    if (!response.ok) {
      return { workspaceBound: false as const, clientSecret: undefined };
    }
    const payload = (await response.json()) as { client_secret?: { value?: string }; id?: string };
    if (!payload.client_secret?.value) {
      return { workspaceBound: false as const, clientSecret: undefined };
    }
    return { workspaceBound: true as const, clientSecret: payload.client_secret.value, sessionId: payload.id };
  }

  private async completeWithClientSecret(apiKey: string, clientSecret: string, sdp: string) {
    const response = await this.fetchImpl("https://api.openai.com/v1/realtime/calls", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${clientSecret || apiKey}`,
        "Content-Type": "application/sdp",
        "OpenAI-Beta": "realtime=v1"
      },
      body: sdp
    });
    if (!response.ok) {
      throw new UnconfiguredError(`OpenAI voice handshake refused (${response.status}). Voice did not connect.`);
    }
    return { sdp: await response.text() };
  }

  private async completeWithLiveSession(apiKey: string, instructions: string, sdp: string) {
    const live = await this.fetchImpl("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENAI_VOICE_MODEL || "gpt-realtime",
        instructions,
        transport: { type: "webrtc", sdp }
      })
    });
    if (!live.ok) {
      throw new UnconfiguredError(`OpenAI voice session refused (${live.status}). This workspace did not start a microphone conversation.`);
    }
    const payload = (await live.json()) as { transport?: { sdp?: string }; sdp?: string };
    return { sdp: payload.transport?.sdp ?? payload.sdp };
  }
}
