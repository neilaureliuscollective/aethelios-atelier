import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { aureliusSystemPrompt } from "@/lib/aurelius/instructions";
import { companionSystemPrompt } from "@/lib/cofounder/instructions";
import { composeReply } from "@/lib/concierge/compose";
import { extractBusinessSketch } from "@/lib/concierge/extract";
import { conciergeVoiceInstructions } from "@/lib/concierge/voiceSession";
import {
  AETHELIOS_EXPERTISE,
  AETHELIOS_IDENTITY,
  AETHELIOS_NAME,
  AETHELIOS_TONE,
  aetheliosCanvasPrompt,
  aetheliosComposeReply,
  aetheliosPersonaPrompt,
  aetheliosPreviewPrompt,
  aetheliosSpokenPrompt
} from "./persona";

describe("Aethelios persona", () => {
  it("names him and holds the house rules", () => {
    expect(AETHELIOS_NAME).toBe("Aethelios");
    expect(AETHELIOS_IDENTITY.role).toMatch(/concierge/);
    expect(AETHELIOS_IDENTITY.role).toMatch(/gentleman/);
    expect(AETHELIOS_IDENTITY.role).toMatch(/business advisor/);
    expect(AETHELIOS_IDENTITY.not.join(" ")).toMatch(/Aurelius/);
    expect(aetheliosPersonaPrompt()).toMatch(/Do not mention being an AI/);
    expect(aetheliosPersonaPrompt()).toMatch(/Never invent prices/);
    expect(aetheliosPersonaPrompt()).not.toMatch(/Keep replies concise and editorial/);
  });

  it("covers the expertise this studio actually builds with him", () => {
    const titles = AETHELIOS_EXPERTISE.map((domain) => domain.title).join(" ");
    expect(titles).toMatch(/Business building/);
    expect(titles).toMatch(/Website design/);
    expect(titles).toMatch(/Product design/);
    expect(titles).toMatch(/Brand and verbal identity/);
    expect(titles).toMatch(/Storefronts and digital infrastructure/);
    expect(titles).toMatch(/Local service businesses/);
    expect(aetheliosPersonaPrompt()).toMatch(/Positioning, offer clarity/);
    expect(aetheliosPersonaPrompt()).toMatch(/Purpose-built web tools/);
  });

  it("defines a witty gentleman-advisor, not a dry intake script", () => {
    expect(AETHELIOS_TONE.qualities).toEqual(
      expect.arrayContaining(["smart", "professional", "smooth", "witty", "enjoyable"])
    );
    expect(aetheliosPersonaPrompt()).toMatch(/dry sparkle/);
    expect(aetheliosPersonaPrompt()).toMatch(/Never a lecture\. Never dry/);
    expect(aetheliosSpokenPrompt()).toMatch(/Speak out loud/);
    expect(aetheliosSpokenPrompt()).toMatch(/only in English/);
    expect(aetheliosSpokenPrompt()).toMatch(/Never switch languages/);
    expect(aetheliosSpokenPrompt()).toMatch(/enjoy talking to you/);
    expect(aetheliosSpokenPrompt()).toMatch(/hint of wit/);
  });

  it("is the source of every prompt he speaks from", () => {
    expect(conciergeVoiceInstructions()).toBe(aetheliosSpokenPrompt());
    expect(aureliusSystemPrompt()).toContain(aetheliosPersonaPrompt());
    expect(companionSystemPrompt()).toContain(aetheliosPersonaPrompt());
    expect(companionSystemPrompt()).toMatch(/never Aurelius/);
    expect(aetheliosCanvasPrompt()).toMatch(/gentleman advisor/);
    expect(aetheliosPreviewPrompt()).toMatch(/product and website expert/);
    const sketch = extractBusinessSketch("I run a barbershop called Northridge in Austin.");
    expect(composeReply(sketch, true)).toBe(aetheliosComposeReply("Northridge in Austin", true));
    expect(composeReply(sketch, true)).toMatch(/sketch/);
    expect(composeReply(sketch, false)).toMatch(/business you actually run/);
    expect(composeReply(sketch, false)).not.toMatch(/I can keep this in conversation/);
  });

  it("is imported by the brief, companion, voice, canvas, and preview paths", () => {
    const files = [
      "src/lib/aurelius/instructions.ts",
      "src/lib/cofounder/instructions.ts",
      "src/lib/concierge/voiceSession.ts",
      "src/lib/concierge/talk.ts",
      "src/lib/concierge/sitePreview.ts",
      "src/lib/concierge/compose.ts"
    ];
    for (const file of files) {
      expect(readFileSync(file, "utf8"), file).toMatch(/@\/lib\/aethelios\/persona/);
    }
  });
});
