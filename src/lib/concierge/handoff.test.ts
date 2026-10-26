import { afterEach, describe, expect, it } from "vitest";
import { formatHandoffDocument, resetConciergeHandoffForTests, submitConciergeHandoff } from "./handoff";
import { resetInquiryRateLimitForTests } from "@/lib/inquiry/rateLimit";

const original = { ...process.env };

afterEach(() => {
  process.env = { ...original };
  resetConciergeHandoffForTests();
  resetInquiryRateLimitForTests();
});

const session = {
  name: "Ada Lovelace",
  email: "ada@client.test",
  sessionId: "talk_test_session_1",
  messages: [
    {
      role: "user" as const,
      content: "I run a barbershop called Northridge in Austin. I want it quiet and considered."
    },
    {
      role: "assistant" as const,
      content: "I am composing a presentation for Northridge in Austin."
    }
  ],
  document: {
    version: 1 as const,
    id: "canvas_test",
    title: "Northridge in Austin · direction",
    thesis: "The site should feel as precise as the cut.",
    theme: { mood: "ember" as const, accent: "gold" as const, density: "cinematic" as const },
    slides: [
      {
        id: "slide_hero",
        layout: "hero" as const,
        kicker: "Aethelios · live sketch",
        headline: "Northridge in Austin",
        enter: "rise" as const,
        emphasis: "headline" as const
      }
    ]
  },
  previewGenerated: false,
  honeypot: ""
};

describe("concierge handoff", () => {
  it("builds a founder document without inventing a quote", () => {
    const text = formatHandoffDocument(session);
    expect(text).toContain("Ada Lovelace");
    expect(text).toContain("ada@client.test");
    expect(text).toContain("Northridge");
    expect(text).toContain("Austin");
    expect(text).toContain("CONVERSATION");
    expect(text).toContain("Illustrative site preview: no");
    expect(text).toMatch(/not a booking/i);
    expect(text).not.toMatch(/invoice|payment collected/i);
    expect(text).not.toContain("<script>");
  });

  it("offers mailto when Resend is not ready and does not print the inbox in the message", async () => {
    delete process.env.ATELIER_INQUIRY_CAPTURE;
    delete process.env.VERCEL;
    delete process.env.AUTH_RESEND_KEY;
    delete process.env.AUTH_RESEND_FROM;
    process.env.ATELIER_INQUIRY_TO = "neil@stutes.co";
    const result = await submitConciergeHandoff(session);
    expect(result).toMatchObject({ ok: false, error: "unconfigured" });
    if (!result.ok) {
      expect(result.mailto).toMatch(/^mailto:neil%40stutes\.co\?/);
      expect(result.mailto).toContain("Northridge");
      expect(result.message).not.toContain("neil@stutes.co");
    }
  });

  it("rejects a filled honeypot", async () => {
    process.env.ATELIER_INQUIRY_TO = "neil@stutes.co";
    await expect(submitConciergeHandoff({ ...session, honeypot: "http://spam.test" })).rejects.toThrow(
      /could not be sent/
    );
  });
});
