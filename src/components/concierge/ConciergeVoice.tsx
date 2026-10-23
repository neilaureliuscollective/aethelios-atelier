"use client";

import { useEffect, useRef, useState } from "react";
import { trackConciergeEvent } from "@/lib/concierge/analytics";
import {
  CONCIERGE_VOICE_PRIVACY,
  detectBrowserVoice,
  spokenSummary,
  voiceStatusCopy,
  type ConciergeVoiceState
} from "@/lib/concierge/voice";

type SpeechRec = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript?: string }> & { isFinal?: boolean }> }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

function createRecognizer(): SpeechRec | null {
  const ctor =
    (window as Window & { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec })
      .SpeechRecognition ||
    (window as Window & { webkitSpeechRecognition?: new () => SpeechRec }).webkitSpeechRecognition;
  if (!ctor) return null;
  return new ctor();
}

export function ConciergeVoice({
  path,
  pending,
  spokenText,
  inquiryOpen,
  onTranscript
}: {
  path: string;
  pending: boolean;
  spokenText: string;
  inquiryOpen: boolean;
  onTranscript: (text: string) => void;
}) {
  const support = detectBrowserVoice();
  const [state, setState] = useState<ConciergeVoiceState>(support.listen ? "idle" : "unsupported");
  const [active, setActive] = useState(false);
  const recRef = useRef<SpeechRec | null>(null);
  const activeRef = useRef(false);
  const pendingRef = useRef(pending);
  const lastSpoken = useRef("");

  useEffect(() => {
    pendingRef.current = pending;
    if (pending && activeRef.current) setState("thinking");
  }, [pending]);

  useEffect(() => {
    if (!active || !spokenText || spokenText === lastSpoken.current || !support.speak || inquiryOpen) return;
    lastSpoken.current = spokenText;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(spokenSummary(spokenText));
    utterance.rate = 0.96;
    utterance.onstart = () => setState("speaking");
    utterance.onend = () => {
      if (!activeRef.current || pendingRef.current) return;
      listen();
    };
    utterance.onerror = () => {
      if (activeRef.current) setState("idle");
    };
    window.speechSynthesis.speak(utterance);
    // listen is stable enough via refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spokenText, active, support.speak, inquiryOpen]);

  useEffect(() => {
    return () => {
      activeRef.current = false;
      recRef.current?.abort();
      window.speechSynthesis?.cancel();
    };
  }, []);

  function listen() {
    if (!support.listen || inquiryOpen) return;
    window.speechSynthesis.cancel();
    recRef.current?.abort();
    const rec = createRecognizer();
    if (!rec) {
      setState("unsupported");
      void trackConciergeEvent("voice_unsupported", path);
      return;
    }
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (event) => {
      const last = event.results[event.results.length - 1];
      const text = last?.[0]?.transcript?.trim() ?? "";
      if (last?.isFinal && text) {
        onTranscript(text);
        setState("thinking");
      }
    };
    rec.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setState("denied");
        setActive(false);
        activeRef.current = false;
        void trackConciergeEvent("voice_denied", path);
        return;
      }
      if (activeRef.current) setState("idle");
    };
    rec.onend = () => {
      if (activeRef.current && !pendingRef.current && state !== "speaking") {
        setState((current) => (current === "thinking" || current === "speaking" ? current : "idle"));
      }
    };
    recRef.current = rec;
    try {
      rec.start();
      setState("listening");
    } catch {
      setState("idle");
    }
  }

  function toggle() {
    if (!support.listen) {
      void trackConciergeEvent("voice_unsupported", path);
      setState("unsupported");
      return;
    }
    if (active) {
      activeRef.current = false;
      setActive(false);
      recRef.current?.abort();
      window.speechSynthesis.cancel();
      setState("idle");
      return;
    }
    activeRef.current = true;
    setActive(true);
    void trackConciergeEvent("voice_started", path);
    listen();
  }

  return (
    <div className="concierge-voice">
      <button
        type="button"
        className={`btn btn-ghost btn-compact${active ? " concierge-voice-live" : ""}`}
        onClick={toggle}
        aria-pressed={active}
        disabled={inquiryOpen}
      >
        {active ? (state === "listening" ? "Listening" : state === "speaking" ? "Speaking" : "Stop talk") : "Talk"}
      </button>
      <p className="tiny" role="status">
        {voiceStatusCopy(state, support)} {active ? CONCIERGE_VOICE_PRIVACY : null}
      </p>
    </div>
  );
}
