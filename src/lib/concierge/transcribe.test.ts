import { afterEach, describe, expect, it } from "vitest";
import { DomainError, UnconfiguredError } from "@/lib/domain/errors";
import { resetInquiryRateLimitForTests } from "@/lib/inquiry/rateLimit";
import { GET, POST } from "@/app/api/concierge/transcribe/route";
import { appendTranscript, documentSourceFromTalk, shouldCommitSpoken } from "./voiceText";
import { extensionForType, transcribeAudio, transcribeConfigured, TRANSCRIBE_MAX_BYTES } from "./transcribe";

const original = { ...process.env };

afterEach(() => {
  process.env = { ...original };
  resetInquiryRateLimitForTests();
});

function clearOpenAiKeys() {
  delete process.env.OPENAI_API_KEY;
  delete process.env.ATELIER_OPENAI_API_KEY;
  delete process.env.OPENAI_KEY;
  delete process.env.AUTH_OPENAI_KEY;
}

describe("homepage voice transcription", () => {
  it("is ready from an aliased key without ATELIER_OPENAI_ENABLED", () => {
    clearOpenAiKeys();
    delete process.env.ATELIER_OPENAI_ENABLED;
    expect(transcribeConfigured()).toBe(false);
    process.env.ATELIER_OPENAI_API_KEY = "sk-voice-only";
    expect(transcribeConfigured()).toBe(true);
  });

  it("fails closed without a key and refuses empty recordings", async () => {
    clearOpenAiKeys();
    await expect(transcribeAudio({ bytes: Buffer.alloc(200), type: "audio/webm" })).rejects.toBeInstanceOf(
      UnconfiguredError
    );
    process.env.OPENAI_API_KEY = "sk-test";
    await expect(transcribeAudio({ bytes: Buffer.alloc(8), type: "audio/webm" })).rejects.toBeInstanceOf(DomainError);
    await expect(
      transcribeAudio({ bytes: Buffer.alloc(TRANSCRIBE_MAX_BYTES + 1), type: "audio/webm" })
    ).rejects.toBeInstanceOf(DomainError);
  });

  it("maps recorder types and joins spoken text into the box", () => {
    expect(extensionForType("audio/webm;codecs=opus")).toBe("webm");
    expect(extensionForType("audio/mp4")).toBe("mp4");
    expect(extensionForType("audio/mpeg")).toBe("mp3");
    expect(appendTranscript("", "I run a barbershop in Austin.")).toBe("I run a barbershop in Austin.");
    expect(appendTranscript("I run a shop.", "It is in Austin.")).toBe("I run a shop. It is in Austin.");
    expect(shouldCommitSpoken("hello")).toBe(false);
    expect(shouldCommitSpoken("I run a barbershop in Austin.")).toBe(true);
    expect(documentSourceFromTalk("", [])).toMatch(/first document/);
    expect(documentSourceFromTalk("I run a shop in Austin.", [])).toBe("I run a shop in Austin.");
  });

  it("GET reports not ready and POST refuses audio when the key is missing", async () => {
    clearOpenAiKeys();
    const status = await GET();
    const body = (await status.json()) as { ready?: boolean; note?: string };
    expect(status.status).toBe(200);
    expect(body.ready).toBe(false);
    expect(body.note).toMatch(/does not enable live sketch AI/i);

    const empty = await POST(
      new Request("http://localhost/api/concierge/transcribe", { method: "POST", body: new FormData() })
    );
    expect(empty.status).toBe(400);

    const form = new FormData();
    form.append("audio", new File([new Uint8Array(200)], "speech.webm", { type: "audio/webm" }));
    const missing = await POST(
      new Request("http://localhost/api/concierge/transcribe", { method: "POST", body: form })
    );
    const missingBody = (await missing.json()) as { error?: string };
    expect(missing.status).toBe(503);
    expect(missingBody.error).toBe("unconfigured");
  });
});
