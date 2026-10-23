import "server-only";
import { DomainError, UnconfiguredError } from "@/lib/domain/errors";
import { INTELLIGENCE_DISPLAY_NAME } from "@/lib/copy";
import { readOpenAiApiKey } from "@/lib/runtime/hosted";

export function conciergeVoiceName(env: NodeJS.ProcessEnv = process.env) {
  return (env.OPENAI_VOICE_NAME || "verse").trim() || "verse";
}

export function conciergeVoiceModel(env: NodeJS.ProcessEnv = process.env) {
  return (env.OPENAI_VOICE_MODEL || "gpt-realtime").trim() || "gpt-realtime";
}

export function conciergeVoiceReady(env: NodeJS.ProcessEnv = process.env) {
  return Boolean(readOpenAiApiKey(env));
}

export function conciergeVoiceInstructions() {
  return [
    `You are ${INTELLIGENCE_DISPLAY_NAME}, the spoken presence of Aethelios Atelier, Neil Stutes's founder-led studio.`,
    "Speak out loud. Keep answers short, warm, and considered. Do not mention being an AI.",
    "Ask what business they actually run and what they need. This is a sketch, not a commission, booking, or quote.",
    "Neil reviews every commission he accepts. Never invent prices, testimonials, or completed work.",
    "When they describe a business, reflect it back in a few spoken sentences and invite the next fact."
  ].join(" ");
}

type VoiceFetch = typeof fetch;

export async function createConciergeVoiceSession(
  sdp: string,
  fetchImpl: VoiceFetch = fetch
) {
  const apiKey = readOpenAiApiKey();
  if (!apiKey) {
    throw new UnconfiguredError(
      "Spoken replies need OPENAI_API_KEY on the server. You can still type."
    );
  }
  if (sdp.trim().length < 10) {
    throw new DomainError("A live microphone offer is required.", "invalid", 400);
  }
  const model = conciergeVoiceModel();
  const voice = conciergeVoiceName();
  const instructions = conciergeVoiceInstructions();
  const session = await fetchImpl("https://api.openai.com/v1/realtime/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ model, instructions, voice })
  });
  if (session.ok) {
    const payload = (await session.json()) as { client_secret?: { value?: string } };
    if (payload.client_secret?.value) {
      const call = await fetchImpl("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${payload.client_secret.value}`,
          "Content-Type": "application/sdp",
          "OpenAI-Beta": "realtime=v1"
        },
        body: sdp
      });
      if (!call.ok) {
        throw new UnconfiguredError(`OpenAI voice handshake refused (${call.status}). The orb could not speak.`);
      }
      return { sdp: await call.text(), model, voice };
    }
  }
  const live = await fetchImpl("https://api.openai.com/v1/realtime/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      instructions,
      voice,
      transport: { type: "webrtc", sdp }
    })
  });
  if (!live.ok) {
    throw new UnconfiguredError(`OpenAI voice session refused (${live.status}). The orb could not speak.`);
  }
  const payload = (await live.json()) as { transport?: { sdp?: string }; sdp?: string };
  const answer = payload.transport?.sdp ?? payload.sdp ?? "";
  if (!answer) {
    throw new UnconfiguredError("OpenAI returned a voice session without audio. The orb could not speak.");
  }
  return { sdp: answer, model, voice };
}
