import { afterEach, describe, expect, it } from "vitest";
import { UnconfiguredError } from "@/lib/domain/errors";
import {
  conciergeRealtimeSession,
  conciergeVoiceInstructions,
  conciergeVoiceReady,
  conciergeVoiceValue,
  createConciergeVoiceSession
} from "./voiceSession";

const original = { ...process.env };

afterEach(() => {
  process.env = { ...original };
});

describe("homepage spoken orb", () => {
  it("stays unready without a key and names Aethelios in the spoken brief", () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.ATELIER_OPENAI_API_KEY;
    delete process.env.OPENAI_KEY;
    delete process.env.AUTH_OPENAI_KEY;
    expect(conciergeVoiceReady()).toBe(false);
    expect(conciergeVoiceInstructions()).toMatch(/Aethelios/);
    expect(conciergeVoiceInstructions()).toMatch(/Speak out loud/);
    expect(conciergeVoiceInstructions()).toMatch(/only in English/);
    expect(conciergeRealtimeSession().type).toBe("realtime");
    expect(conciergeRealtimeSession().audio.output.voice).toBe("verse");
    expect(conciergeRealtimeSession().audio.input.transcription.language).toBe("en");
  });

  it("uses a commissioned OpenAI voice id when one is set", () => {
    process.env.OPENAI_VOICE_NAME = "voice_atelier_orb";
    expect(conciergeVoiceValue()).toEqual({ id: "voice_atelier_orb" });
  });

  it("hands an SDP offer to the current OpenAI realtime calls path", async () => {
    process.env.OPENAI_API_KEY = "sk-test-voice";
    process.env.OPENAI_VOICE_NAME = "verse";
    const calls: string[] = [];
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      calls.push(String(url));
      const body = init?.body;
      expect(body).toBeInstanceOf(FormData);
      const form = body as FormData;
      expect(String(form.get("sdp"))).toContain("offer-from-orb");
      expect(String(form.get("session"))).toContain("verse");
      expect(String(form.get("session"))).toContain("realtime");
      return new Response("v=0\r\nanswer", { status: 200, headers: { "Content-Type": "application/sdp" } });
    }) as typeof fetch;
    const session = await createConciergeVoiceSession("v=0\r\noffer-from-orb", fetchImpl);
    expect(session.sdp).toContain("answer");
    expect(session.voice).toBe("verse");
    expect(calls).toEqual(["https://api.openai.com/v1/realtime/calls"]);
    expect(calls.some((url) => url.includes("/realtime/sessions"))).toBe(false);
  });

  it("falls back to a client secret, then a live session, if the calls form is gone", async () => {
    process.env.OPENAI_API_KEY = "sk-test-voice";
    const calls: string[] = [];
    const fetchImpl = (async (url: string) => {
      calls.push(String(url));
      if (String(url).includes("/realtime/calls") && calls.filter((item) => item.includes("/calls")).length === 1) {
        return Response.json({ error: { message: "not here" } }, { status: 404 });
      }
      if (String(url).includes("/realtime/client_secrets")) {
        return Response.json({ value: "ek_guest" });
      }
      if (String(url).includes("/realtime/calls")) {
        return new Response("v=0\r\nsecret-answer", { status: 200, headers: { "Content-Type": "application/sdp" } });
      }
      return Response.json({ error: { message: "unused" } }, { status: 500 });
    }) as typeof fetch;
    const session = await createConciergeVoiceSession("v=0\r\noffer-from-orb", fetchImpl);
    expect(session.sdp).toContain("secret-answer");
    expect(calls.some((url) => url.includes("/realtime/client_secrets"))).toBe(true);
  });

  it("fails closed when no key is present", async () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.ATELIER_OPENAI_API_KEY;
    delete process.env.OPENAI_KEY;
    delete process.env.AUTH_OPENAI_KEY;
    await expect(createConciergeVoiceSession("v=0\r\noffer")).rejects.toBeInstanceOf(UnconfiguredError);
  });
});
