import { describe, expect, it } from "vitest";
import {
  PUBLIC_RECURRING_LABEL,
  PUBLIC_SETUP_LABEL,
  formatMonthlyCharge,
  formatSetupCharge,
  formatUsdAmount,
  isFiniteUsdAmount,
  isPublishableUsdAmount
} from "./format";

describe("pricing currency formatting", () => {
  it("formats whole-dollar setup and monthly charges in USD", () => {
    expect(formatUsdAmount(299)).toBe("$299");
    expect(formatUsdAmount(249)).toBe("$249");
    expect(formatSetupCharge(499)).toBe("$499 one-time setup");
    expect(formatMonthlyCharge(399)).toBe("$399/month");
    expect(formatMonthlyCharge(699)).toBe("$699/month");
  });

  it("keeps cents when the amount is not a whole dollar", () => {
    expect(formatUsdAmount(249.5)).toBe("$249.50");
  });

  it("rejects missing or non-finite amounts instead of inventing a price", () => {
    expect(isFiniteUsdAmount(null)).toBe(false);
    expect(isFiniteUsdAmount(undefined)).toBe(false);
    expect(isFiniteUsdAmount(Number.NaN)).toBe(false);
    expect(() => formatUsdAmount(Number.NaN)).toThrow(/finite/i);
  });

  it("treats zero as unpublishable so quoted setup cannot become $0", () => {
    expect(isFiniteUsdAmount(0)).toBe(true);
    expect(isPublishableUsdAmount(0)).toBe(false);
    expect(isPublishableUsdAmount(299)).toBe(true);
    expect(PUBLIC_SETUP_LABEL).toBe("Discuss your scope");
    expect(PUBLIC_RECURRING_LABEL).toBe("Request a proposal");
  });
});
