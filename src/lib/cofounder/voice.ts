import { aureliusStatus } from "@/lib/aurelius/boundary";
import { companionSystemPrompt } from "@/lib/cofounder/instructions";
import { buildAuthorizedModelContext } from "@/lib/cofounder/isolation";
import { CompanionUsage } from "@/lib/cofounder/usage";
import { CompanionWorkspace } from "@/lib/cofounder/workspace";
import { loadConfig } from "@/lib/config";
import { LimitError, UnconfiguredError } from "@/lib/domain/errors";
import type { PersistenceAdapter } from "@/lib/persistence/adapter";
import type { User } from "@/lib/types";

export type VoiceCapability = {
  ready: boolean;
  live: boolean;
  transport: "webrtc";
  providerPath: "openai_live_sessions" | "unavailable";
  reason?: string;
};

export function voiceCapability(): VoiceCapability {
  const status = aureliusStatus();
  if (!status.ready) {
    return {
      ready: false,
      live: false,
      transport: "webrtc",
      providerPath: "unavailable",
      reason:
        status.reason ??
        "Voice requires ATELIER_OPENAI_ENABLED=true and OPENAI_API_KEY. This is not a simulated conversation."
    };
  }
  return {
    ready: true,
    live: true,
    transport: "webrtc",
    providerPath: "openai_live_sessions"
  };
}

export class CompanionVoice {
  constructor(
    private readonly store: PersistenceAdapter,
    private readonly workspace = new CompanionWorkspace(store),
    private readonly usage = new CompanionUsage(store)
  ) {}

  async createWebRtcSession(input: {
    businessId: string;
    user: User;
    sdp: string;
  }) {
    const capability = voiceCapability();
    if (!capability.ready) {
      throw new UnconfiguredError(capability.reason ?? "Voice is not configured.");
    }
    if (!input.sdp.trim()) {
      throw new LimitError("An SDP offer is required to start a voice session.");
    }
    const context = await this.workspace.requireMembership(input.businessId, input.user);
    await this.usage.consume(input.businessId, input.user, "voice", 1, { transport: "webrtc" });
    const config = loadConfig();
    const modelContext = buildAuthorizedModelContext({ context, history: [] });
    const response = await fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.openAiKey}`,
        "Content-Type": "application/sdp",
        "OpenAI-Beta": "realtime=v1"
      },
      body: input.sdp
    });

    if (response.ok) {
      const answer = await response.text();
      return {
        ok: true as const,
        transport: "webrtc" as const,
        sdp: answer,
        instructions: companionSystemPrompt(),
        workspaceBound: true
      };
    }

    const live = await fetch("https://api.openai.com/v1/live/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.openAiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        session: {
          model: process.env.OPENAI_VOICE_MODEL || "gpt-realtime",
          instructions: `${companionSystemPrompt()}\nAuthorized workspace:\n${JSON.stringify(modelContext)}`
        },
        transport: { type: "webrtc", sdp: input.sdp }
      })
    });

    if (!live.ok) {
      const detail = `OpenAI voice session refused (${response.status}/${live.status}). This workspace did not start a microphone conversation.`;
      throw new UnconfiguredError(detail);
    }
    const payload = (await live.json()) as { transport?: { sdp?: string }; sdp?: string };
    const sdp = payload.transport?.sdp ?? payload.sdp;
    if (!sdp) {
      throw new UnconfiguredError("OpenAI returned a voice session without an SDP answer.");
    }
    return {
      ok: true as const,
      transport: "webrtc" as const,
      sdp,
      instructions: companionSystemPrompt(),
      workspaceBound: true
    };
  }
}
