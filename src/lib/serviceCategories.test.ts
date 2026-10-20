import { describe, expect, it } from "vitest";
import {
  HISTORICAL_BOOKING_PROJECT_TYPE,
  asksBookingProvider,
  canonicalProjectType,
  displayProjectTypeLabel,
  historicalProjectTypeNote,
  normalizeIncomingServiceInterest,
  optionPressed,
  serviceInterestToStoredProjectType
} from "./serviceCategories";

describe("service category compatibility", () => {
  it("maps historical booking-connected website without deleting the stored id", () => {
    expect(canonicalProjectType(HISTORICAL_BOOKING_PROJECT_TYPE)).toBe("custom_apps_platforms");
    expect(displayProjectTypeLabel(HISTORICAL_BOOKING_PROJECT_TYPE)).toBe("Custom apps & platforms");
    expect(historicalProjectTypeNote(HISTORICAL_BOOKING_PROJECT_TYPE)).toMatch(/saved as a booking-connected website/i);
    expect(serviceInterestToStoredProjectType(HISTORICAL_BOOKING_PROJECT_TYPE)).toBe(
      HISTORICAL_BOOKING_PROJECT_TYPE
    );
  });

  it("keeps new category ids as themselves", () => {
    expect(canonicalProjectType("custom_apps_platforms")).toBe("custom_apps_platforms");
    expect(canonicalProjectType("ecommerce_storefronts")).toBe("ecommerce_storefronts");
    expect(canonicalProjectType("website")).toBe("website");
    expect(canonicalProjectType("digital_infrastructure")).toBe("digital_infrastructure");
    expect(historicalProjectTypeNote("custom_apps_platforms")).toBeNull();
  });

  it("does not invent a mapping for unknown stored values", () => {
    expect(canonicalProjectType("legacy_unknown_package")).toBeNull();
    expect(normalizeIncomingServiceInterest("not-a-category")).toBeNull();
  });

  it("accepts the historical query interest without rewriting it to custom apps", () => {
    expect(normalizeIncomingServiceInterest("booking_connected_website")).toBe(
      "booking_connected_website"
    );
    expect(normalizeIncomingServiceInterest("custom_apps_platforms")).toBe("custom_apps_platforms");
  });

  it("does not treat a historical booking brief as a newly chosen Custom apps selection", () => {
    expect(optionPressed(HISTORICAL_BOOKING_PROJECT_TYPE, "custom_apps_platforms")).toBe(false);
    expect(optionPressed(HISTORICAL_BOOKING_PROJECT_TYPE, HISTORICAL_BOOKING_PROJECT_TYPE)).toBe(true);
    expect(optionPressed("custom_apps_platforms", "custom_apps_platforms")).toBe(true);
  });

  it("asks for a booking provider only inside custom apps or the historical booking type", () => {
    expect(asksBookingProvider(HISTORICAL_BOOKING_PROJECT_TYPE)).toBe(true);
    expect(asksBookingProvider("custom_apps_platforms")).toBe(true);
    expect(asksBookingProvider("website")).toBe(false);
    expect(asksBookingProvider("ecommerce_storefronts")).toBe(false);
  });
});
