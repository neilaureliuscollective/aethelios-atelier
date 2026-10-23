"use client";

import { useEffect, useRef, useState } from "react";
import { useAethelios } from "@/components/aethelios/AetheliosProvider";
import { shouldOpenCanvas } from "@/lib/concierge/intent";
import { orbPresenceLabel } from "@/lib/concierge/voiceListen";
import { INTELLIGENCE_DISPLAY_NAME } from "@/lib/copy";
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
    composeDocument,
    abort,
    voice
  } = useAethelios();
  const [workspace, setWorkspace] = useState<Workspace>(document ? "canvas" : messages.length ? "chat" : "idle");
  const [orbSize, setOrbSize] = useState<"hero" | "docked">(document || messages.length ? "docked" : "hero");
  const [writing, setWriting] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const pinnedRef = useRef(true);
  const voiceLive = voice.phase !== "idle";
  const lastSpoken = messages.at(-1);

  useEffect(() => {
    if (document || writing) {
      setWorkspace("canvas");
      setOrbSize("docked");
    } else if ((messages.length || pending) && !voiceLive) {
      setWorkspace("chat");
      setOrbSize("docked");
    }
  }, [document, messages.length, pending, voiceLive, writing]);

  useEffect(() => {
    if (!writing) return;
    // On a phone the document stacks first; bring it into view as it starts writing.
    if (!window.matchMedia("(max-width: 980px)").matches) return;
    globalThis.document
      ?.getElementById("live-document")
      ?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  }, [writing]);

  useEffect(() => {
    if (document) setWriting(false);
  }, [document]);

  // New turns scroll inside the conversation panel only — never the page —
  // and only while the visitor is reading the latest line.
  useEffect(() => {
    const panel = messagesRef.current;
    if (panel && pinnedRef.current) panel.scrollTop = panel.scrollHeight;
  }, [messages.length, streaming]);

  function submitText(value: string, compose = false) {
    if (voiceLive) voice.stop();
    if (compose || shouldOpenCanvas(value, Boolean(document), compose)) {
      setWriting(true);
      setWorkspace("canvas");
      setOrbSize("docked");
    }
    void send(value, compose ? { compose: true } : undefined);
  }

  async function writeDocument() {
    if (voiceLive) voice.stop();
    setWriting(true);
    setWorkspace("canvas");
    setOrbSize("docked");
    await composeDocument();
  }

  async function engageOrb() {
    if (pending) return;
    if (voiceLive) {
      voice.stop();
      setWorkspace(document || writing ? "canvas" : "idle");
      return;
    }
    setWorkspace("listening");
    setOrbSize("hero");
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
        <div className={styles.sanctum} />
        <StageAtmosphere />
        <div className={styles.hall} />
        <div className={styles.well} />
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
                Tap the orb and speak. {INTELLIGENCE_DISPLAY_NAME} answers out loud — a conversation, then a
                sketch, not a commission. You can still type below.
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
              liveInputRef={voice.inputLevelRef}
              liveOutputRef={voice.outputLevelRef}
              state={
                voice.phase === "speaking"
                  ? "speaking"
                  : voiceLive || (workspace === "listening" && !voice.error)
                    ? "listening"
                    : orbState
              }
              label={
                voiceLive
                  ? `End the spoken conversation with ${INTELLIGENCE_DISPLAY_NAME}`
                  : `Talk with ${INTELLIGENCE_DISPLAY_NAME}`
              }
              onToggle={() => void engageOrb()}
            />
            <p className={styles.orbStatus} data-tone={voice.error ? "warn" : undefined}>
              {orbPresenceLabel({
                name: INTELLIGENCE_DISPLAY_NAME,
                error: voice.error,
                phase: voice.phase,
                pending,
                hasDocument: Boolean(document)
              })}
            </p>
            {voiceLive ? (
              <p className={styles.caption} aria-live="polite" data-role={lastSpoken?.role}>
                {lastSpoken ? `${lastSpoken.role === "user" ? "You" : INTELLIGENCE_DISPLAY_NAME}: ${lastSpoken.body}` : null}
              </p>
            ) : null}
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
              <div className={styles.actions}>
                <button
                  className="btn btn-ghost"
                  type="button"
                  onClick={() => void writeDocument()}
                >
                  Compose a document
                </button>
              </div>
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
                <div
                  className={styles.messages}
                  aria-live="polite"
                  ref={messagesRef}
                  onScroll={(event) => {
                    const panel = event.currentTarget;
                    pinnedRef.current = panel.scrollHeight - panel.scrollTop - panel.clientHeight < 48;
                  }}
                >
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
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        submitText(input);
                      }
                    }}
                    placeholder="Add a fact, a place, or ask to make it quieter."
                  />
                  <button
                    className={styles.composerSend}
                    type="submit"
                    disabled={pending || !input.trim()}
                    aria-label={`Send to ${INTELLIGENCE_DISPLAY_NAME}`}
                  >
                    ↑
                  </button>
                  {voice.error || error ? <p className="notice notice-warn">{voice.error || error}</p> : null}
                </form>
                <button
                  className={`btn ${document ? "btn-ghost" : "btn-emerald-glass"} ${styles.composeButton}`}
                  type="button"
                  onClick={() => void writeDocument()}
                  disabled={pending}
                >
                  {document ? "Update the document" : "Compose a document"}
                </button>
              </div>
            </div>
          )}
        </div>

        <PresentationCanvas document={document} preview={preview} index={slideIndex} onSelect={setSlideIndex} />
      </div>
    </section>
  );
}
