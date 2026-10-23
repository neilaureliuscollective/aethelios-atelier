import { afterEach, describe, expect, it } from "vitest";
import { createEmptyBrief } from "@/lib/brief";
import { applyClientValue } from "@/lib/brief";
import { LimitError, UnconfiguredError } from "@/lib/domain/errors";
import { resetInquiryCapturesForTests } from "@/lib/inquiry/capture";
import {
  isPlaceholderInquiryEmail,
  publicInquiryState,
  resolveInquiryDelivery
} from "@/lib/inquiry/destination";
import { inquiryRateLimited, resetInquiryRateLimitForTests } from "@/lib/inquiry/rateLimit";
import { explainResendFailure } from "@/lib/inquiry/send";
import { resetInquiryServiceForTests, submitInquiry } from "@/lib/inquiry/service";
import { formatInquiryText, summarizeBrief } from "@/lib/inquiry/summary";

const original = { ...process.env };

afterEach(() => {
  process.env = { ...original };
  resetInquiryCapturesForTests();
  resetInquiryRateLimitForTests();
  resetInquiryServiceForTests();
});

function isolatedCapture(extra: Record<string, string> = {}) {
  process.env.ATELIER_INQUIRY_CAPTURE = "true";
  process.env.ATELIER_ISOLATED_LOCAL = "true";
  delete process.env.VERCEL;
  delete process.env.ATELIER_HOSTED;
  delete process.env.AUTH_RESEND_KEY;
  delete process.env.AUTH_RESEND_FROM;
  process.env.ATELIER_DATA_DIR = ".data";
  Object.assign(process.env, extra);
}

describe("inquiry destination", () => {
  it("treats .invalid and example domains as placeholders", () => {
    expect(isPlaceholderInquiryEmail("neil.local@atelier.invalid")).toBe(true);
    expect(isPlaceholderInquiryEmail("owner@example.com")).toBe(true);
    expect(isPlaceholderInquiryEmail("neil@stutes.co")).toBe(false);
  });

  it("refuses capture on hosted platforms", () => {
    process.env.ATELIER_INQUIRY_CAPTURE = "true";
    process.env.VERCEL = "1";
    const resolved = resolveInquiryDelivery();
    expect(resolved.delivery).toBe("unconfigured");
    expect(publicInquiryState().accept).toBe(false);
    expect(JSON.stringify(publicInquiryState())).not.toContain("stutes");
  });

  it("uses mailto when a real inbox exists without Resend", () => {
    delete process.env.ATELIER_INQUIRY_CAPTURE;
    delete process.env.VERCEL;
    process.env.ATELIER_INQUIRY_TO = "neil@stutes.co";
    expect(resolveInquiryDelivery().delivery).toBe("mailto");
    expect(publicInquiryState()).toMatchObject({ accept: false, canMailto: true, labeled: false });
  });
});

describe("inquiry summary", () => {
  it("omits empty brief fields and keeps client wording", () => {
    let brief = createEmptyBrief();
    brief = applyClientValue(brief, "vision", "A quiet shop site");
    brief = applyClientValue(brief, "projectType", "website");
    const summary = summarizeBrief(brief);
    expect(summary?.title).toMatch(/website/i);
    expect(summary?.lines.map((line) => line.key)).toEqual(["vision", "projectType"]);
    expect(
      formatInquiryText({
        name: "Ada",
        email: "ada@client.test",
        business: "Northridge",
        need: "Need a clearer public site.",
        source: "brief",
        brief: summary
      })
    ).toContain("Need a clearer public site.");
  });
});

describe("inquiry submission", () => {
  it("captures a guest inquiry on an isolated local machine", async () => {
    isolatedCapture();
    const result = await submitInquiry({
      name: "Ada Lovelace",
      email: "ada@client.test",
      business: "Northridge",
      need: "A branded website for the sitting room.",
      source: "brief",
      consent: true,
      idempotencyKey: "inq-key-local-1"
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.delivery).toBe("capture");
      expect(result.labeled).toBe(true);
      expect(result.receiptId).toMatch(/^rcpt_/);
    }
    const retry = await submitInquiry({
      name: "Ada Lovelace",
      email: "ada@client.test",
      need: "A branded website for the sitting room.",
      source: "brief",
      consent: true,
      idempotencyKey: "inq-key-local-1"
    });
    expect(retry.ok && retry.receiptId).toBe(result.ok && result.receiptId);
  });

  it("accepts a concierge inquiry source and keeps it labeled as a request", async () => {
    isolatedCapture();
    const result = await submitInquiry({
      name: "Ada Lovelace",
      email: "ada@client.test",
      business: "Northridge",
      need: "Business: salon\nChallenge: almost no inquiries",
      source: "concierge",
      consent: true,
      idempotencyKey: "inq-key-concierge-1"
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.note).toMatch(/not a hosted delivery/i);
      expect(result.note).toMatch(/not a booking/i);
    }
  });

  it("does not claim a hosted send when only a real inbox exists", async () => {
    delete process.env.ATELIER_INQUIRY_CAPTURE;
    delete process.env.VERCEL;
    process.env.ATELIER_INQUIRY_TO = "neil@stutes.co";
    const result = await submitInquiry({
      name: "Ada Lovelace",
      email: "ada@client.test",
      need: "Need a storefront that stays honest.",
      source: "inquire",
      consent: true
    });
    expect(result).toMatchObject({ ok: false, error: "unconfigured" });
    if (!result.ok) {
      expect(result.mailto).toMatch(/^mailto:neil%40stutes\.co\?/);
      expect(result.mailto).toContain("Need+a+storefront");
    }
  });

  it("maps Resend testing-mode failures without leaking the raw body", () => {
    expect(
      explainResendFailure(403, JSON.stringify({ message: "You can only send testing emails to your own email address." }))
    ).toMatch(/same email/i);
    expect(explainResendFailure(401, "Invalid API key")).toMatch(/API key/i);
    expect(explainResendFailure(422, "Invalid from field")).toMatch(/beth.t@example.com/);
    expect(explainResendFailure(500, "secret token re_abc")).not.toContain("re_abc");
  });

  it("offers mailto when Resend rejects a hosted send", async () => {
    process.env.VERCEL = "1";
    process.env.ATELIER_INQUIRY_TO = "neil@stutes.co";
    process.env.AUTH_RESEND_KEY = "re_test";
    process.env.AUTH_RESEND_FROM = "Aethelios Atelier <beth.t@example.com>";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ message: "You can only send testing emails to your own email address." }), {
        status: 403
      })) as typeof fetch;
    try {
      const result = await submitInquiry({
        name: "Ada Lovelace",
        email: "ada@client.test",
        need: "Need a storefront that stays honest.",
        source: "inquire",
        consent: true
      });
      expect(result).toMatchObject({ ok: false, error: "delivery_failed" });
      if (!result.ok) {
        expect(result.message).toMatch(/same email/i);
        expect(result.mailto).toMatch(/^mailto:neil%40stutes\.co\?/);
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("fails closed without a destination or local capture", async () => {
    delete process.env.ATELIER_INQUIRY_CAPTURE;
    delete process.env.ATELIER_INQUIRY_TO;
    delete process.env.VERCEL;
    await expect(
      submitInquiry({
        name: "Ada",
        email: "ada@client.test",
        need: "Need a website this season.",
        source: "inquire",
        consent: true
      })
    ).rejects.toBeInstanceOf(UnconfiguredError);
  });

  it("rejects a filled honeypot and rate-limits a noisy client", async () => {
    isolatedCapture();
    await expect(
      submitInquiry(
        {
          name: "Bot",
          email: "bot@client.test",
          need: "Need a website this season.",
          source: "inquire",
          consent: true,
          honeypot: "http://spam.test"
        },
        { clientKey: "1.1.1.1" }
      )
    ).rejects.toThrow(/could not be accepted/);

    for (let i = 0; i < 8; i += 1) {
      expect(inquiryRateLimited("noisy")).toBe(false);
    }
    expect(inquiryRateLimited("noisy")).toBe(true);
    await expect(
      submitInquiry(
        {
          name: "Ada",
          email: "ada@client.test",
          need: "Need a website this season.",
          source: "inquire",
          consent: true
        },
        { clientKey: "noisy" }
      )
    ).rejects.toBeInstanceOf(LimitError);
  });
});
