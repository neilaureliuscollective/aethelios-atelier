"use client";

import { useEffect, useRef, useState } from "react";
import { useAethelios } from "@/components/aethelios/AetheliosProvider";
import { INTELLIGENCE_DISPLAY_NAME } from "@/lib/copy";
import { ConciergeOrb } from "./ConciergeOrb";
import { PresentationCanvas } from "./PresentationCanvas";
import { StageAtmosphere } from "./StageAtmosphere";
import { appendTranscript, useOrbTranscription } from "./useOrbTranscription";
import styles from "./concierge.module.css";

const PROMPTS = [
  "I run a barbershop in Austin and need a site that feels as considered as the chair.",
  "We're a custom home studio. I want a digital presence that matches the work.",
  "I have a salon and I already use a booking system."
];

type Workspace = "idle" | "listening" | "chat" | "canvas";

export function ConciergeStage() {
  const {
    messages,
    document,
    preview,
    slideIndex,
    setSlideIndex,
    pending,
    streaming,
    error,
    input,
    setInput,
    orbState,
    send,
    abort
  } = useAethelios();
  const [workspace, setWorkspace] = useState<Workspace>(document ? "canvas" : messages.length ? "chat" : "idle");
  const [orbSize, setOrbSize] = useState<"hero" | "docked">(document || messages.length ? "docked" : "hero");
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const voice = useOrbTranscription();
  const voiceListening = voice.phase === "starting" || voice.phase === "recording";
  const voiceBusy = voiceListening || voice.phase === "transcribing";

  useEffect(() => {
    if (document) {
      setWorkspace("canvas");
      setOrbSize("docked");
    } else if (messages.length || pending) {
      setWorkspace("chat");
      setOrbSize("docked");
    }
  }, [document, messages.length, pending]);

  function focusComposer() {
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }

  function submitText(value: string) {
    if (voiceBusy) voice.cancel();
    void send(value);
  }

  async function engageOrb() {
    if (pending || voice.phase === "transcribing") return;
    if (voiceListening) {
      const spoken = await voice.stop();
      if (spoken) setInput(appendTranscript(input, spoken));
      focusComposer();
      return;
    }
    if (input.trim()) {
      submitText(input);
      return;
    }
    if (workspace === "idle" || workspace === "listening") {
      setWorkspace("listening");
      setOrbSize("hero");
      await voice.start();
      return;
    }
    await voice.start();
  }

  const orbCentered = workspace === "idle" || workspace === "listening";

  return (
    <section
      className={styles.stage}
      data-workspace={workspace}
      data-orb={orbSize}
      aria-labelledby="concierge-heading"
    >
      <div className={styles.media} aria-hidden="true">
        <StageAtmosphere />
        <div className={styles.shade} />
        <div className={styles.field} />
      </div>
      <div className={styles.shell}>
        <header className={styles.intro}>
          <div>
            <p className={styles.kicker}>{INTELLIGENCE_DISPLAY_NAME}</p>
            <h1 id="concierge-heading" className={styles.heading}>
              {orbCentered ? (
                <>
                  Meet {INTELLIGENCE_DISPLAY_NAME}.
                  <br />
                  <em>The orb is the door.</em>
                </>
              ) : (
                <>
                  {INTELLIGENCE_DISPLAY_NAME}
                  <em> is composing.</em>
                </>
              )}
            </h1>
            {orbCentered ? (
              <p className={styles.lede}>
                Tap the orb to speak, or type below. {INTELLIGENCE_DISPLAY_NAME} writes what you said into the
                box and composes a live presentation beside you — a sketch, not a commission.
              </p>
            ) : null}
          </div>
          {workspace === "canvas" || workspace === "chat" ? (
            <div className={styles.actions}>
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => setOrbSize((current) => (current === "hero" ? "docked" : "hero"))}
              >
                {orbSize === "hero" ? "Keep the orb large" : "Dock the orb"}
              </button>
              <button className="btn btn-ghost" type="button" onClick={abort} disabled={!pending}>
                Interrupt
              </button>
            </div>
          ) : null}
        </header>

        <div className={styles.left}>
          <div className={styles.orbDock}>
            <ConciergeOrb
              size={orbSize}
              state={
                voiceListening || (workspace === "listening" && !voice.error)
                  ? "listening"
                  : voice.phase === "transcribing"
                    ? "thinking"
                    : orbState
              }
              label={
                voiceListening
                  ? `Stop speaking and write it for ${INTELLIGENCE_DISPLAY_NAME}`
                  : voice.phase === "transcribing"
                    ? `Hearing your words for ${INTELLIGENCE_DISPLAY_NAME}`
                    : input.trim()
                      ? `Send this to ${INTELLIGENCE_DISPLAY_NAME}`
                      : `Speak to ${INTELLIGENCE_DISPLAY_NAME}`
              }
              onToggle={() => void engageOrb()}
            />
            <p className={styles.orbStatus} data-tone={voice.error ? "warn" : undefined} aria-live="polite">
              {voice.error
                ? voice.error
                : voice.phase === "transcribing"
                  ? "Hearing that into words…"
                  : voiceListening || workspace === "listening"
                    ? "Listening · tap the orb when you are done speaking"
                    : orbState === "composing"
                      ? `${INTELLIGENCE_DISPLAY_NAME} is composing`
                      : orbState === "thinking"
                        ? `${INTELLIGENCE_DISPLAY_NAME} is listening through what you said`
                        : `Tap the orb to speak with ${INTELLIGENCE_DISPLAY_NAME}`}
            </p>
          </div>

          {orbCentered ? (
            <div className={styles.orbEntry}>
              <form
                className={styles.whisper}
                onSubmit={(event) => {
                  event.preventDefault();
                  submitText(input);
                }}
              >
                <label htmlFor="concierge-idle-input">Or type to {INTELLIGENCE_DISPLAY_NAME}</label>
                <textarea
                  id="concierge-idle-input"
                  ref={inputRef}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      submitText(input);
                    }
                  }}
                  placeholder="I run a quiet studio in…"
                />
                {voice.error || error ? <p className="notice notice-warn">{voice.error || error}</p> : null}
              </form>
              <p className={styles.invitesLabel}>Try speaking as a founder would</p>
              <div className={styles.prompts}>
                {PROMPTS.map((prompt) => (
                  <button key={prompt} className={styles.prompt} type="button" onClick={() => submitText(prompt)}>
                    {prompt}
                  </button>
                ))}
              </div>
              <p className={styles.fine}>
                No account is required. Neil Stutes reviews every commission he accepts.
              </p>
            </div>
          ) : (
            <div className={styles.rail}>
              <div className={`${styles.chat} on-glass`}>
                <div className={styles.messages} aria-live="polite">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`${styles.bubble} ${message.role === "user" ? styles.bubbleUser : ""}`}
                    >
                      <p className={styles.meta}>{message.role === "user" ? "You" : INTELLIGENCE_DISPLAY_NAME}</p>
                      <p>{message.body}</p>
                    </div>
                  ))}
                  {streaming ? (
                    <div className={styles.bubble}>
                      <p className={styles.meta}>{INTELLIGENCE_DISPLAY_NAME} · composing</p>
                      <p>{streaming}</p>
                    </div>
                  ) : null}
                </div>
                <form
                  className={styles.composer}
                  onSubmit={(event) => {
                    event.preventDefault();
                    submitText(input);
                  }}
                >
                  <label htmlFor="concierge-input">Continue with {INTELLIGENCE_DISPLAY_NAME}</label>
                  <textarea
                    id="concierge-input"
                    ref={inputRef}
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    placeholder="Add a fact, a place, or ask to make it quieter."
                  />
                  {voice.error || error ? <p className="notice notice-warn">{voice.error || error}</p> : null}
                </form>
              </div>
            </div>
          )}
        </div>

        <PresentationCanvas document={document} preview={preview} index={slideIndex} onSelect={setSlideIndex} />
      </div>
    </section>
  );
}
