"use client";

import { useEffect, useRef, useState } from "react";
import { useAethelios } from "@/components/aethelios/AetheliosProvider";
import { INTELLIGENCE_DISPLAY_NAME } from "@/lib/copy";
import { ConciergeHandoff } from "./ConciergeHandoff";
import { ConciergeOrb } from "./ConciergeOrb";
import { PresentationCanvas } from "./PresentationCanvas";
import { StageAtmosphere } from "./StageAtmosphere";
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

  function engageOrb() {
    if (pending) return;
    if (input.trim()) {
      void send(input);
      return;
    }
    if (workspace === "idle") {
      setWorkspace("listening");
      setOrbSize("hero");
      focusComposer();
      return;
    }
    if (workspace === "listening") {
      focusComposer();
      return;
    }
    setOrbSize((current) => (current === "hero" ? "docked" : "hero"));
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
                Tap the orb to begin. Describe the business you actually run, and {INTELLIGENCE_DISPLAY_NAME}{" "}
                composes a live presentation beside you — a sketch, not a commission.
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
              state={orbCentered && workspace === "listening" ? "listening" : orbState}
              label={
                input.trim()
                  ? `Send this to ${INTELLIGENCE_DISPLAY_NAME}`
                  : workspace === "idle"
                    ? `Begin with ${INTELLIGENCE_DISPLAY_NAME}`
                    : workspace === "listening"
                      ? `Speak to ${INTELLIGENCE_DISPLAY_NAME}, or type below`
                      : `Resize the ${INTELLIGENCE_DISPLAY_NAME} orb`
              }
              onToggle={engageOrb}
            />
            <p className={styles.orbStatus} aria-live="polite">
              {orbState === "composing"
                ? `${INTELLIGENCE_DISPLAY_NAME} is composing`
                : orbState === "thinking"
                  ? `${INTELLIGENCE_DISPLAY_NAME} is listening through what you said`
                  : workspace === "listening"
                    ? "Listening · type or send an invitation"
                    : workspace === "idle"
                      ? `Tap the orb to begin with ${INTELLIGENCE_DISPLAY_NAME}`
                      : `${INTELLIGENCE_DISPLAY_NAME} is ready`}
            </p>
          </div>

          {orbCentered ? (
            <div className={styles.orbEntry}>
              <form
                className={styles.whisper}
                onSubmit={(event) => {
                  event.preventDefault();
                  void send(input);
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
                      void send(input);
                    }
                  }}
                  placeholder="I run a quiet studio in…"
                />
              </form>
              <p className={styles.invitesLabel}>Try speaking as a founder would</p>
              <div className={styles.prompts}>
                {PROMPTS.map((prompt) => (
                  <button key={prompt} className={styles.prompt} type="button" onClick={() => void send(prompt)}>
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
                    void send(input);
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
                  {error ? <p className="notice notice-warn">{error}</p> : null}
                </form>
                <ConciergeHandoff />
              </div>
            </div>
          )}
        </div>

        <PresentationCanvas document={document} preview={preview} index={slideIndex} onSelect={setSlideIndex} />
      </div>
    </section>
  );
}
