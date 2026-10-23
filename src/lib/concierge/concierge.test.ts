import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { composePresentation, composeReply } from "./compose";
import { CONCIERGE_RENDER_CONTRACT, containsForbiddenPayload } from "./contract";
import { extractBusinessSketch, sketchLabel } from "./extract";
import { isRevisionRequest, shouldOpenCanvas } from "./intent";
import { applySlide, mergePresentation } from "./merge";
import { presentationSchema } from "./schema";
import { encodeConciergeEvent, parseConciergeChunk } from "./stream";
import { runConciergeTurn } from "./talk";

describe("concierge display contract", () => {
  it("rejects HTML and executable strings", () => {
    expect(containsForbiddenPayload({ headline: "<script>alert(1)</script>" })).toBe(true);
    expect(containsForbiddenPayload({ body: "javascript:alert(1)" })).toBe(true);
    expect(containsForbiddenPayload({ body: "A considered barbershop in Austin." })).toBe(false);
    expect(CONCIERGE_RENDER_CONTRACT.forbidden).toContain("dangerouslySetInnerHTML");
  });

  it("opens a canvas for business talk and stays in chat for greetings", () => {
    expect(shouldOpenCanvas("hello")).toBe(false);
    expect(shouldOpenCanvas("I run a barbershop in Austin and need a site that feels considered.")).toBe(true);
    expect(isRevisionRequest("make it quieter and more gold", true)).toBe(true);
    expect(isRevisionRequest("make it quieter", false)).toBe(false);
  });

  it("extracts a named local business and composes a valid deck", () => {
    const sketch = extractBusinessSketch(
      "I run a barbershop called Northridge in Austin. I want it quiet and considered."
    );
    expect(sketch.kind).toBe("barber");
    expect(sketch.place).toBe("Austin");
    expect(sketch.name).toMatch(/Northridge/i);
    expect(sketchLabel(sketch)).toBe("Northridge in Austin");
    const deck = composePresentation(
      "I run a barbershop called Northridge in Austin. I want it quiet and considered."
    );
    expect(presentationSchema.safeParse(deck).success).toBe(true);
    expect(deck.slides).toHaveLength(6);
    expect(deck.title).toMatch(/Northridge/);
    expect(JSON.stringify(deck)).not.toMatch(/\$79|testimonial|dangerouslySetInnerHTML|<script/i);
    expect(composeReply(sketch, true)).toMatch(/sketch/);
  });

  it("merges streamed slides without dropping earlier ones", () => {
    const first = composePresentation("We run a custom home studio in Denver.");
    const opened = mergePresentation(null, { ...first, slides: [] });
    expect(opened?.slides).toEqual([]);
    const withHero = applySlide(opened, first.slides[0]!);
    expect(withHero?.slides[0]?.id).toBe("slide_hero");
    const merged = mergePresentation(withHero, first);
    expect(merged?.slides).toHaveLength(first.slides.length);
  });

  it("streams SSE events the client can parse", () => {
    const encoded = [
      encodeConciergeEvent({ type: "delta", text: "Composing." }),
      encodeConciergeEvent({
        type: "done",
        reply: "Composing.",
        liveAi: false,
        presented: true
      })
    ].join("");
    const events = parseConciergeChunk(encoded);
    expect(events.map((item) => item.type)).toEqual(["delta", "done"]);
  });

  it("runs a guest turn without a live model and never emits HTML", async () => {
    process.env.ATELIER_OPENAI_ENABLED = "false";
    delete process.env.OPENAI_API_KEY;
    const events: string[] = [];
    const turn = await runConciergeTurn({
      message: "I run a salon in Chicago and I already use a booking system.",
      onEvent: (event) => events.push(event.type)
    });
    expect(turn.presented).toBe(true);
    expect(turn.liveAi).toBe(false);
    expect(turn.document?.slides.length).toBeGreaterThan(3);
    expect(events).toContain("canvas.open");
    expect(events).toContain("canvas.slide");
    expect(events).toContain("canvas.complete");
    expect(containsForbiddenPayload(turn.document)).toBe(false);
  });
});

describe("concierge homepage seating", () => {
  it("makes the concierge the first homepage stage", () => {
    const home = readFileSync("src/app/page.tsx", "utf8");
    expect(home).toContain("<ConciergeStage");
    expect(home.indexOf("<ConciergeStage")).toBeLessThan(home.indexOf('variant="featured"'));
    expect(home.indexOf('variant="featured"')).toBeLessThan(home.indexOf("<PossibilitiesStage"));
    const renderer = readFileSync("src/components/concierge/SlideView.tsx", "utf8");
    expect(renderer).not.toContain("dangerouslySetInnerHTML");
    expect(renderer).not.toContain("eval(");
    expect(renderer).toContain("SlideField");
    expect(renderer).toContain("data-layout");
    const orb = readFileSync("src/components/concierge/ConciergeOrb.tsx", "utf8");
    expect(orb).toContain("ArchitectOrb");
    expect(orb).not.toContain("gl_FragColor");
    const stage = readFileSync("src/components/concierge/ConciergeStage.tsx", "utf8");
    expect(stage).toContain("Meet {INTELLIGENCE_DISPLAY_NAME}");
    expect(stage).toContain("StageAtmosphere");
    expect(stage).not.toContain("colonnade.webp");
    expect(stage).not.toContain("Talk with Aethelios");
    expect(stage).not.toMatch(/btn-gold/);
  });
});
