"use client";

import { useRef } from "react";
import { usePathname } from "next/navigation";
import { ConciergeOrb } from "@/components/concierge/ConciergeOrb";
import { SlideView } from "@/components/concierge/SlideView";
import { useOrbVoice } from "@/components/concierge/useOrbVoice";
import { appendTranscript } from "@/lib/concierge/voiceText";
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
  const latestInput = useRef(input);
  latestInput.current = input;
  const voice = useOrbVoice({
    onHeard: (spoken) => {
      setInput(appendTranscript(latestInput.current, spoken));
      setPanelOpen(true);
    }
  });
  const voiceLive = voice.phase !== "idle";

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
              if (voiceLive) voice.stop();
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
                  if (voiceLive) voice.stop();
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
        <audio ref={voice.audioRef} autoPlay playsInline className={styles.voiceOut} />
        <ConciergeOrb
          size="docked"
          liveLevelRef={voice.levelRef}
          state={voice.phase === "speaking" ? "speaking" : voiceLive ? "listening" : orbState}
          label={
            voiceLive
              ? `End the spoken conversation with ${INTELLIGENCE_DISPLAY_NAME}`
              : `Talk with ${INTELLIGENCE_DISPLAY_NAME} from this page`
          }
          onToggle={() => {
            void (async () => {
              if (pending) return;
              if (voiceLive) {
                voice.stop();
                return;
              }
              setPanelOpen(true);
              await voice.start();
            })();
          }}
        />
        <p className={styles.caption}>
          {voice.phase === "speaking" ? "Speaking" : voiceLive ? "Listening" : INTELLIGENCE_DISPLAY_NAME}
        </p>
      </div>
    </div>
  );
}
