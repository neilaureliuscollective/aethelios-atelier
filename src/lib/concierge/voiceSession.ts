import "server-only";
import { aetheliosSpokenPrompt } from "@/lib/aethelios/persona";
import { DomainError, UnconfiguredError } from "@/lib/domain/errors";
import { readOpenAiApiKey } from "@/lib/runtime/hosted";

export function conciergeVoiceName(env: NodeJS.ProcessEnv = process.env) {
  return (env.OPENAI_VOICE_NAME || env.OPENAI_VOICE_ID || "verse").trim() || "verse";
}

export function conciergeVoiceModel(env: NodeJS.ProcessEnv = process.env) {
  return (env.OPENAI_VOICE_MODEL || "gpt-realtime").trim() || "gpt-realtime";
}

export function conciergeVoiceReady(env: NodeJS.ProcessEnv = process.env) {
  return Boolean(readOpenAiApiKey(env));
}

export function conciergeVoiceValue(env: NodeJS.ProcessEnv = process.env) {
  const name = conciergeVoiceName(env);
  return name.startsWith("voice_") ? { id: name } : name;
}

export function conciergeVoiceInstructions() {
  return aetheliosSpokenPrompt();
}

export function conciergeRealtimeSession(env: NodeJS.ProcessEnv = process.env) {
  return {
    type: "realtime" as const,
    model: conciergeVoiceModel(env),
    instructions: conciergeVoiceInstructions(),
    output_modalities: ["audio"] as const,
    audio: {
      input: {
        transcription: { model: "whisper-1" },
        turn_detection: { type: "server_vad", create_response: true, interrupt_response: true }
      },
      output: { voice: conciergeVoiceValue(env) }
    }
  };
}

type VoiceFetch = typeof fetch;

async function readErrorDetail(response: Response) {
  const text = await response.text();
  try {
    const payload = JSON.parse(text) as { error?: { message?: string } };
    return payload.error?.message?.trim() || text.slice(0, 180);
  } catch {
    return text.slice(0, 180);
  }
}

async function readAnswerSdp(response: Response) {
  const text = await response.text();
  const trimmed = text.trim();
  if (trimmed.startsWith("v=")) return text;
  if (trimmed.startsWith("{")) {
    const payload = JSON.parse(text) as { transport?: { sdp?: string }; sdp?: string };
    return payload.transport?.sdp ?? payload.sdp ?? "";
  }
  return text;
}

function refused(path: string, status: number, detail: string) {
  const extra = detail ? ` ${detail}` : "";
  return new UnconfiguredError(
    `OpenAI voice handshake refused (${status} on ${path}).${extra} The orb could not speak.`
  );
}

async function createWithUnifiedCalls(apiKey: string, sdp: string, fetchImpl: VoiceFetch) {
  const session = conciergeRealtimeSession();
  const body = new FormData();
  body.set("sdp", sdp);
  body.set("session", JSON.stringify(session));
  const response = await fetchImpl("https://api.openai.com/v1/realtime/calls", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`
    },
    body
  });
  if (!response.ok) {
    throw refused("/v1/realtime/calls", response.status, await readErrorDetail(response));
  }
  return { sdp: await readAnswerSdp(response), model: session.model, voice: conciergeVoiceName() };
}

async function createWithClientSecret(apiKey: string, sdp: string, fetchImpl: VoiceFetch) {
  const session = conciergeRealtimeSession();
  const minted = await fetchImpl("https://api.openai.com/v1/realtime/client_secrets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ session })
  });
  if (!minted.ok) {
    throw refused("/v1/realtime/client_secrets", minted.status, await readErrorDetail(minted));
  }
  const payload = (await minted.json()) as { value?: string; client_secret?: { value?: string } };
  const secret = payload.value ?? payload.client_secret?.value ?? "";
  if (!secret) {
    throw new UnconfiguredError("OpenAI returned a voice token without a secret. The orb could not speak.");
  }
  const call = await fetchImpl("https://api.openai.com/v1/realtime/calls", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/sdp"
    },
    body: sdp
  });
  if (!call.ok) {
    throw refused("/v1/realtime/calls", call.status, await readErrorDetail(call));
  }
  return { sdp: await readAnswerSdp(call), model: session.model, voice: conciergeVoiceName() };
}

async function createWithLiveSession(apiKey: string, sdp: string, fetchImpl: VoiceFetch) {
  const model = (process.env.OPENAI_LIVE_MODEL || "gpt-live-1").trim() || "gpt-live-1";
  const live = await fetchImpl("https://api.openai.com/v1/live/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      session: {
        model,
        instructions: conciergeVoiceInstructions()
      },
      transport: { type: "webrtc", sdp }
    })
  });
  if (!live.ok) {
    throw refused("/v1/live/sessions", live.status, await readErrorDetail(live));
  }
  const answer = await readAnswerSdp(live);
  if (!answer) {
    throw new UnconfiguredError("OpenAI returned a voice session without audio. The orb could not speak.");
  }
  return { sdp: answer, model, voice: conciergeVoiceName() };
}

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

  const attempts = [createWithUnifiedCalls, createWithClientSecret, createWithLiveSession];
  const failures: UnconfiguredError[] = [];
  for (const attempt of attempts) {
    try {
      const session = await attempt(apiKey, sdp, fetchImpl);
      if (session.sdp.trim()) return session;
    } catch (error) {
      if (!(error instanceof UnconfiguredError)) throw error;
      failures.push(error);
    }
  }
  throw (
    failures[0] ??
    new UnconfiguredError("OpenAI returned a voice session without audio. The orb could not speak.")
  );
}
