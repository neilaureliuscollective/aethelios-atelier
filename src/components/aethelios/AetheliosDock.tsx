"use client";

import { usePathname } from "next/navigation";
import { ConciergeOrb } from "@/components/concierge/ConciergeOrb";
import { SlideView } from "@/components/concierge/SlideView";
import { appendTranscript, useOrbTranscription } from "@/components/concierge/useOrbTranscription";
import { aetheliosDockVisible } from "@/lib/aethelios/presence";
import { INTELLIGENCE_DISPLAY_NAME } from "@/lib/copy";
import { useAethelios } from "./AetheliosProvider";
import styles from "./aetheliosDock.module.css";

export function AetheliosDock() {
  const pathname = usePathname();
  const {
    messages,
    document,
    slideIndex,
    pending,
    streaming,
    error,
    input,
    setInput,
    panelOpen,
    setPanelOpen,
    orbState,
    send,
    abort
  } = useAethelios();
  const voice = useOrbTranscription();
  const voiceListening = voice.phase === "starting" || voice.phase === "recording";

  if (!aetheliosDockVisible(pathname)) return null;

  const slide = document?.slides[Math.min(Math.max(slideIndex, 0), Math.max((document?.slides.length ?? 1) - 1, 0))];

  return (
    <div className={styles.root} data-open={panelOpen}>
      {panelOpen ? (
        <section className={styles.panel} aria-label={`${INTELLIGENCE_DISPLAY_NAME} conversation`}>
          <header className={styles.panelHead}>
            <p className={styles.kicker}>{INTELLIGENCE_DISPLAY_NAME}</p>
            <button className="btn btn-ghost btn-compact" type="button" onClick={() => setPanelOpen(false)}>
              Close
            </button>
          </header>
          <div className={styles.messages} aria-live="polite">
            {messages.length === 0 && !streaming ? (
              <p className={styles.empty}>
                Speak from any page. {INTELLIGENCE_DISPLAY_NAME} keeps this conversation as you move through the
                atelier.
              </p>
            ) : null}
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
          {slide && document ? (
            <div className={styles.miniCanvas}>
              <SlideView slide={slide} theme={document.theme} />
            </div>
          ) : null}
          <form
            className={styles.composer}
            onSubmit={(event) => {
              event.preventDefault();
              if (voiceListening || voice.phase === "transcribing") voice.cancel();
              void send(input);
            }}
          >
            <label htmlFor="aethelios-dock-input">Message {INTELLIGENCE_DISPLAY_NAME}</label>
            <textarea
              id="aethelios-dock-input"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  if (voiceListening || voice.phase === "transcribing") voice.cancel();
                  void send(input);
                }
              }}
              placeholder="Describe the business, or continue from here."
            />
            {voice.error || error ? <p className="notice notice-warn">{voice.error || error}</p> : null}
            {pending ? (
              <button className="btn btn-ghost btn-compact" type="button" onClick={abort}>
                Interrupt
              </button>
            ) : null}
          </form>
        </section>
      ) : null}
      <div className={styles.orbWrap}>
        <ConciergeOrb
          size="docked"
          state={voiceListening ? "listening" : voice.phase === "transcribing" ? "thinking" : orbState}
          label={
            voiceListening
              ? `Stop speaking and write it for ${INTELLIGENCE_DISPLAY_NAME}`
              : voice.phase === "transcribing"
                ? `Hearing your words for ${INTELLIGENCE_DISPLAY_NAME}`
                : input.trim() && !panelOpen
                  ? `Send this to ${INTELLIGENCE_DISPLAY_NAME}`
                  : `Speak with ${INTELLIGENCE_DISPLAY_NAME} from this page`
          }
          onToggle={() => {
            void (async () => {
              if (pending || voice.phase === "transcribing") return;
              if (voiceListening) {
                const spoken = await voice.stop();
                if (spoken) setInput(appendTranscript(input, spoken));
                setPanelOpen(true);
                return;
              }
              if (input.trim() && !panelOpen) {
                void send(input);
                return;
              }
              if (panelOpen && input.trim()) {
                setPanelOpen(false);
                return;
              }
              setPanelOpen(true);
              if (!input.trim()) await voice.start();
            })();
          }}
        />
        <p className={styles.caption}>
          {voice.phase === "transcribing"
            ? "Hearing…"
            : voiceListening
              ? "Listening"
              : INTELLIGENCE_DISPLAY_NAME}
        </p>
      </div>
    </div>
  );
}
