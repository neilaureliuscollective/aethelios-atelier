import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { composePresentation, composeReply } from "./compose";
import { spokenTurnFrom } from "./voiceText";
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
    expect(shouldOpenCanvas("Write a first document from this conversation.", false, true)).toBe(true);
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
    expect(deck.theme.mood).toBe("obsidian");
    expect(deck.theme.accent).toBe("gold");
    expect(JSON.stringify(deck.theme)).not.toMatch(/ember/);
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

  it("opens a document when compose is asked even without a business sentence", async () => {
    process.env.ATELIER_OPENAI_ENABLED = "false";
    delete process.env.OPENAI_API_KEY;
    const turn = await runConciergeTurn({
      message: "Write a first document from this conversation.",
      compose: true
    });
    expect(turn.presented).toBe(true);
    expect(turn.document?.slides.length).toBeGreaterThan(3);
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
    expect(renderer).not.toContain("SlideField");
    expect(renderer).toContain("data-layout");
    const orb = readFileSync("src/components/concierge/ConciergeOrb.tsx", "utf8");
    expect(orb).toContain("ArchitectOrb");
    expect(orb).toContain("orbFallback");
    expect(orb).toContain("liveOutputRef");
    expect(orb).toContain("envelopeToward");
    expect(orb).not.toContain("gl_FragColor");
    const stage = readFileSync("src/components/concierge/ConciergeStage.tsx", "utf8");
    expect(stage).toContain("Your ambition.");
    expect(stage).not.toContain("StageAtmosphere");
    expect(stage).not.toContain("ConciergeOrb");
    const css = readFileSync("src/components/concierge/concierge.module.css", "utf8");
    expect(css).toContain("perspective(720px)");
    expect(css).toContain("rotateX(58deg)");
    expect(css).toContain("overflow: hidden");
    expect(css).toContain("clip-path: circle(50%");
    expect(css).toContain("clamp(212px, 38vmin, 300px)");
    expect(css).toContain("atelier-hall.jpg");
    expect(css).toContain(".brief");
    expect(css).not.toContain('data-mood="ember"');
    expect(existsSync("public/atmosphere/atelier-hall.jpg")).toBe(true);
    expect(css).not.toContain("70vw");
    expect(css).not.toContain("colonnade.webp");
    expect(css).toMatch(/listening[\s\S]*canvasWrap[\s\S]*display: none/);
    expect(stage).not.toContain("colonnade.webp");
    expect(stage).not.toContain("Talk with Aethelios");
    expect(stage).toContain("Create my direction");
    expect(stage).toContain("composeDocument");
    expect(stage).toContain('role="log"');
    expect(stage).toContain("event.nativeEvent.isComposing");
    expect(stage).toContain("maxLength={2000}");
    const provider = readFileSync("src/components/aethelios/AetheliosProvider.tsx", "utf8");
    expect(provider).toContain("useOrbVoice");
    expect(provider).toContain("shouldCommitSpoken");
    expect(provider).toContain("compose: true");
    expect(provider).toContain("playsInline");
    expect(provider).not.toContain("SPOKEN_COMMIT_MS");
    const atmosphere = readFileSync("src/components/concierge/StageAtmosphere.tsx", "utf8");
    expect(atmosphere).toContain("paintChamber");
    expect(stage).not.toContain("SpeechRecognition");
    expect(stage).not.toContain("webkitSpeechRecognition");
    const voice = readFileSync("src/components/concierge/useOrbVoice.ts", "utf8");
    expect(voice).toContain("getUserMedia");
    expect(voice).toContain("RTCPeerConnection");
    expect(voice).toContain("/api/concierge/voice");
    expect(voice).toContain("response.create");
    expect(voice).toContain("Speak first");
    expect(voice).toContain("watchLevels");
    expect(voice).toContain('language: "en"');
    expect(voice).toContain("English only");
    expect(voice).not.toContain("SpeechRecognition");
    expect(voice).not.toContain("webkitSpeechRecognition");
    const session = readFileSync("src/lib/concierge/voiceSession.ts", "utf8");
    expect(session).toContain("/v1/realtime/calls");
    expect(session).not.toContain("/v1/realtime/sessions");
    expect(session).toContain("verse");
    expect(session).toContain("aetheliosSpokenPrompt");
    const architect = readFileSync("src/components/orb/ArchitectOrb.tsx", "utf8");
    expect(architect).toContain('setBackend("canvas2d")');
    expect(architect).toContain("failIfMajorPerformanceCaveat");
    expect(architect).toContain("webglcontextlost");
    expect(architect).toContain("getContextAttributes");
    expect(architect).toContain("paintParticleOrb");
    expect(architect).toContain("gl.POINTS");
    expect(architect).toContain('data-ready');
    const canvas = readFileSync("src/components/concierge/PresentationCanvas.tsx", "utf8");
    expect(canvas).toContain("ConciergeHandoff");
    expect(canvas).toContain("Live document");
    expect(canvas).toContain("atelier-brief");
    expect(canvas).not.toContain("SlideField");
    expect(canvas).not.toContain("The room is assembling.");
    const transcribe = readFileSync("src/lib/concierge/transcribe.ts", "utf8");
    expect(transcribe).toContain("gpt-transcribe");
    expect(transcribe).toContain("whisper-1");
    expect(transcribe).toContain("readOpenAiApiKey");
    expect(transcribe).not.toContain("ATELIER_OPENAI_ENABLED");
    expect(transcribe).not.toContain("aureliusStatus");
  });
});

describe("concierge send flow", () => {
  it("offers a handoff with or without a document", () => {
    const stage = readFileSync("src/components/concierge/ConciergeStage.tsx", "utf8");
    const canvas = readFileSync("src/components/concierge/PresentationCanvas.tsx", "utf8");
    expect(stage).toContain("ConciergeHandoff");
    expect(stage).toContain("document ?");
    expect(canvas.match(/<ConciergeHandoff/g)).toHaveLength(1);
    expect(canvas).toContain("sendDock");
    expect(stage).toContain("Send message");
  });

  it("records only finished spoken turns from both speakers", () => {
    expect(spokenTurnFrom({ type: "conversation.item.input_audio_transcription.delta", transcript: "I run" })).toBeNull();
    expect(
      spokenTurnFrom({ type: "conversation.item.input_audio_transcription.completed", transcript: " I run a barbershop. " })
    ).toEqual({ role: "user", text: "I run a barbershop." });
    expect(spokenTurnFrom({ type: "response.output_audio_transcript.done", transcript: "Tell me more." })).toEqual({
      role: "assistant",
      text: "Tell me more."
    });
    expect(spokenTurnFrom({ type: "response.audio_transcript.delta", transcript: "Tell" })).toBeNull();
  });

  it("quotes the visitor and never titles a document 'this business'", () => {
    const deck = composePresentation("I run a barbershop called Northridge in Austin. I want it quiet.");
    const words = deck.slides.find((slide) => slide.id === "slide_words");
    expect(words?.quote).toContain("Northridge");
    const blank = composePresentation("Write a first document from this conversation.");
    expect(blank.title).toBe("Your direction");
    expect(JSON.stringify(blank)).not.toMatch(/this business/);
    expect(presentationSchema.safeParse(blank).success).toBe(true);
  });
});
