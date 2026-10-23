import { describe, expect, it } from "vitest";
import { curatedTurn } from "@/lib/concierge/fallback";
import { detectIntent } from "@/lib/concierge/intent";
import { emptyConciergeFacts } from "@/lib/concierge/types";
import { detectBrowserVoice, spokenSummary, voiceStatusCopy } from "@/lib/concierge/voice";

describe("concierge voice helpers", () => {
  it("speaks a short standalone summary, not a long report", () => {
    const long = [
      "You do not need the service name first. Growth can mean more of the right customers.",
      "Start with the business and who it already serves.",
      "Then we can decide whether this is a website or a systems conversation."
    ].join(" ");
    const spoken = spokenSummary(long);
    expect(spoken.split(/(?<=[.!?])\s+/).length).toBeLessThanOrEqual(2);
    expect(spoken.length).toBeLessThan(long.length);
    expect(spoken).toMatch(/You do not need the service name first/);
  });

  it("detects missing browser speech APIs without throwing", () => {
    const support = detectBrowserVoice({});
    expect(support).toEqual({ listen: false, speak: false });
    expect(voiceStatusCopy("unsupported", support)).toMatch(/cannot take dictation|not available/i);
  });

  it("treats a barbershop growth story as exploration, not a forced website sale", () => {
    const message =
      "I own a barbershop. I've been doing this for eight years, and I want to grow, but I don't know where to start.";
    expect(detectIntent(message)).toBe("explore");
    const result = curatedTurn({ message, facts: emptyConciergeFacts(), liveAi: false });
    expect(result.facts.intent).toBe("explore");
    expect(result.message).toMatch(/do not need the service name first/i);
    expect(result.message).not.toMatch(/I will redesign/i);
    expect(result.spokenText.length).toBeGreaterThan(0);
    expect(result.spokenText.length).toBeLessThanOrEqual(result.message.length);
  });
});
