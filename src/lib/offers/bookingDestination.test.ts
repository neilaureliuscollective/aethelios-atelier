import { describe, expect, it } from "vitest";
import { checkBookingDestination, inferBookingProviderHint } from "@/lib/offers/bookingDestination";

describe("booking destination checks", () => {
  it("leaves unknown destinations unknown", () => {
    expect(checkBookingDestination("")).toMatchObject({ ok: true, kind: "empty", href: null });
  });

  it("accepts a GlossGenius public booking page without fetching it", () => {
    const check = checkBookingDestination("https://fixitshop.glossgenius.com/");
    expect(check.ok).toBe(true);
    expect(check.providerHint).toBe("glossgenius");
    expect(check.message).toMatch(/public booking page is enough/i);
    expect(check.message).toMatch(/rather than embedding a scheduler/i);
  });

  it("names Square and Booksy connection options without promising an embed", () => {
    expect(checkBookingDestination("https://squareup.com/appointments/book/demo").message).toMatch(
      /embed is used only when it has been tested/i
    );
    expect(checkBookingDestination("https://booksy.com/en-us/demo").message).toMatch(/public booking link remains the action/i);
  });

  it("rejects non-http schemes and placeholder hosts", () => {
    expect(checkBookingDestination("javascript:alert(1)")).toMatchObject({ ok: false, kind: "invalid" });
    expect(checkBookingDestination("https://booking.invalid/shop")).toMatchObject({ ok: false, kind: "unsupported" });
  });

  it("accepts a named provider without a URL", () => {
    expect(inferBookingProviderHint("We already use Square Appointments")).toBe("square");
    expect(checkBookingDestination("GlossGenius").ok).toBe(true);
  });

  it("does not treat an unsupported other host as an endorsement", () => {
    const check = checkBookingDestination("https://example.com/book");
    expect(check.ok).toBe(true);
    expect(check.providerHint).toBe("other");
    expect(check.message).toMatch(/will not assume/i);
  });
});
