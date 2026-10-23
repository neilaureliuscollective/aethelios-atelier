import { afterEach, describe, expect, it } from "vitest";
import { UnconfiguredError } from "@/lib/domain/errors";
import {
  conciergeVoiceInstructions,
  conciergeVoiceReady,
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
  });

  it("hands an SDP offer to the OpenAI realtime voice path", async () => {
    process.env.OPENAI_API_KEY = "sk-test-voice";
    process.env.OPENAI_VOICE_NAME = "verse";
    const calls: string[] = [];
    const fetchImpl = (async (url: string) => {
      calls.push(String(url));
      if (String(url).includes("/realtime/sessions") && !String(url).includes("/calls")) {
        return Response.json({ client_secret: { value: "secret_guest" } });
      }
      return new Response("v=0\r\nanswer", { status: 200, headers: { "Content-Type": "application/sdp" } });
    }) as typeof fetch;
    const session = await createConciergeVoiceSession("v=0\r\noffer-from-orb", fetchImpl);
    expect(session.sdp).toContain("answer");
    expect(session.voice).toBe("verse");
    expect(calls.some((url) => url.includes("/realtime/sessions"))).toBe(true);
    expect(calls.some((url) => url.includes("/realtime/calls"))).toBe(true);
  });

  it("fails closed when no key is present", async () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.ATELIER_OPENAI_API_KEY;
    delete process.env.OPENAI_KEY;
    delete process.env.AUTH_OPENAI_KEY;
    await expect(createConciergeVoiceSession("v=0\r\noffer")).rejects.toBeInstanceOf(UnconfiguredError);
  });
});
