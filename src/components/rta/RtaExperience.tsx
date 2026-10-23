"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AppLink } from "@/components/ui/AppLink";
import { ArchitectOrb, type RtaCallState } from "@/components/rta/ArchitectOrb";
import { ApiError, api } from "@/lib/client/api";
import { actionErrorMessage } from "@/lib/client/asyncAction";
import { trackConciergeEvent } from "@/lib/concierge/analytics";
import { RTA_CONVERSATION_NOTE, RTA_PRESENCE } from "@/lib/concierge/identity";
import {
  clearConciergeSession,
  createConciergeMessage,
  emptyConciergeSession,
  historyForRequest,
  mergeFacts,
  readConciergeSession,
  writeConciergeSession
} from "@/lib/concierge/persist";
import { detectBrowserVoice } from "@/lib/concierge/voice";
import {
  emptyConciergeFacts,
  type ConciergeFacts,
  type ConciergeMessage,
  type ConciergeTurnResult
} from "@/lib/concierge/types";
import { RTA_HISTORY_LIMIT, RTA_MESSAGE_MAX, RTA_STORAGE_KEY } from "@/lib/rta/limits";
import {
  chunkSpokenText,
  mergeTranscript,
  rmsFromTimeDomain,
  shouldRestartRecognition,
  speakEnvelope,
  spokenForRta
} from "@/lib/rta/speech";

type SpeechRec = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: {
    resultIndex: number;
    results: ArrayLike<ArrayLike<{ transcript?: string }> & { isFinal?: boolean }>;
  }) => void) | null;
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

function statusLabel(state: RtaCallState, muted: boolean, started: boolean) {
  if (!started) return "Ready";
  if (muted && state !== "speaking" && state !== "thinking") return "Muted";
  if (state === "listening") return "Listening";
  if (state === "thinking") return "Considering";
  if (state === "speaking") return "Speaking";
  if (state === "ended") return "Ended";
  return "Here";
}

export function RtaExperience() {
  const support = detectBrowserVoice();
  const [started, setStarted] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const [state, setState] = useState<RtaCallState>("idle");
  const [messages, setMessages] = useState<ConciergeMessage[]>([]);
  const [facts, setFacts] = useState<ConciergeFacts>(emptyConciergeFacts());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [composer, setComposer] = useState("");
  const [liveLine, setLiveLine] = useState("");
  const levelRef = useRef(0);
  const pulseRef = useRef(0);
  const recRef = useRef<SpeechRec | null>(null);
  const finalsRef = useRef<string[]>([]);
  const flushTimer = useRef<number>(0);
  const liveRef = useRef(false);
  const mutedRef = useRef(false);
  const pendingRef = useRef(false);
  const speakingRef = useRef(false);
  const restartingRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sampleRef = useRef<Uint8Array | null>(null);
  const messagesRef = useRef<ConciergeMessage[]>([]);
  const factsRef = useRef<ConciergeFacts>(emptyConciergeFacts());
  const threadRef = useRef<HTMLDivElement>(null);
  const sendTurnRef = useRef<(text: string) => Promise<void>>(async () => {});

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  useEffect(() => {
    factsRef.current = facts;
  }, [facts]);
  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);
  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  useEffect(() => {
    const stored = readConciergeSession(
      typeof window === "undefined" ? null : window.localStorage,
      RTA_STORAGE_KEY
    );
    setMessages(stored.messages);
    setFacts(stored.facts);
  }, []);

  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [messages, liveLine, transcriptOpen]);

  const persist = useCallback((nextMessages: ConciergeMessage[], nextFacts: ConciergeFacts) => {
    writeConciergeSession(
      {
        version: 1,
        messages: nextMessages,
        facts: nextFacts,
        updatedAt: new Date().toISOString()
      },
      typeof window === "undefined" ? null : window.localStorage,
      RTA_STORAGE_KEY
    );
  }, []);

  const stopAudioGraph = useCallback(() => {
    analyserRef.current = null;
    sampleRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (audioRef.current) {
      void audioRef.current.close();
      audioRef.current = null;
    }
  }, []);

  const attachMicAnalyser = useCallback(async () => {
    if (analyserRef.current || !navigator.mediaDevices?.getUserMedia) return;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true }
    });
    streamRef.current = stream;
    const context = new AudioContext();
    audioRef.current = context;
    const source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.72;
    source.connect(analyser);
    analyserRef.current = analyser;
    sampleRef.current = new Uint8Array(analyser.frequencyBinCount);
    if (context.state === "suspended") await context.resume();
  }, []);

  const listen = useCallback(() => {
    if (!liveRef.current || mutedRef.current || pendingRef.current || speakingRef.current) return;
    if (!support.listen) {
      setState("idle");
      return;
    }
    recRef.current?.abort();
    const rec = createRecognizer();
    if (!rec) {
      setState("idle");
      void trackConciergeEvent("voice_unsupported", "/rta");
      return;
    }
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = true;
    rec.onresult = (event) => {
      const fresh: string[] = [];
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const text = result?.[0]?.transcript ?? "";
        if (result?.isFinal) fresh.push(text);
        else interim = text;
      }
      if (fresh.length) finalsRef.current = [...finalsRef.current, ...fresh];
      const assembled = mergeTranscript(finalsRef.current, interim);
      setLiveLine(assembled);
      window.clearTimeout(flushTimer.current);
      flushTimer.current = window.setTimeout(() => {
        const text = mergeTranscript(finalsRef.current, "");
        finalsRef.current = [];
        setLiveLine("");
        if (text.trim().length >= 8) void sendTurnRef.current(text);
      }, 1800);
    };
    rec.onerror = (event) => {
      if (!shouldRestartRecognition(event.error)) {
        mutedRef.current = true;
        setMuted(true);
        setTranscriptOpen(true);
        setState("idle");
        void trackConciergeEvent("voice_denied", "/rta");
        setError("The microphone was blocked. You can still type in the transcript.");
        return;
      }
    };
    rec.onend = () => {
      if (!liveRef.current || mutedRef.current || pendingRef.current || speakingRef.current) return;
      if (restartingRef.current) return;
      restartingRef.current = true;
      window.setTimeout(() => {
        restartingRef.current = false;
        if (!liveRef.current || mutedRef.current || pendingRef.current || speakingRef.current) return;
        try {
          rec.start();
          setState("listening");
        } catch {
          window.setTimeout(() => {
            if (liveRef.current && !mutedRef.current) listen();
          }, 280);
        }
      }, 120);
    };
    recRef.current = rec;
    try {
      rec.start();
      setState("listening");
    } catch {
      window.setTimeout(() => {
        if (liveRef.current && !mutedRef.current) listen();
      }, 280);
    }
  }, [support.listen]);

  const speakText = useCallback(
    (text: string) => {
      if (!support.speak || !text.trim()) {
        speakingRef.current = false;
        if (liveRef.current && !mutedRef.current) listen();
        else setState(liveRef.current ? "idle" : "ended");
        return;
      }
      window.speechSynthesis.cancel();
      recRef.current?.abort();
      speakingRef.current = true;
      setState("speaking");
      const chunks = chunkSpokenText(spokenForRta(text));
      let index = 0;
      const next = () => {
        if (!liveRef.current) {
          speakingRef.current = false;
          return;
        }
        const chunk = chunks[index];
        index += 1;
        if (!chunk) {
          speakingRef.current = false;
          pulseRef.current = 0;
          if (!mutedRef.current) listen();
          else setState("idle");
          return;
        }
        const utterance = new SpeechSynthesisUtterance(chunk);
        utterance.rate = 0.96;
        utterance.onboundary = () => {
          pulseRef.current = Math.min(1, pulseRef.current + 0.42);
        };
        utterance.onend = next;
        utterance.onerror = next;
        window.speechSynthesis.speak(utterance);
      };
      next();
    },
    [listen, support.speak]
  );

  const sendTurn = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || pendingRef.current || !liveRef.current) return;
      window.clearTimeout(flushTimer.current);
      recRef.current?.abort();
      pendingRef.current = true;
      setPending(true);
      setState("thinking");
      setError("");
      const userMessage = createConciergeMessage("user", text);
      const nextMessages = [...messagesRef.current, userMessage];
      setMessages(nextMessages);
      persist(nextMessages, factsRef.current);
      if (nextMessages.filter((item) => item.role === "user").length === 1) {
        void trackConciergeEvent("first_message", "/rta");
      }
      try {
        const result = await api<ConciergeTurnResult>("/api/concierge/talk", {
          method: "POST",
          body: JSON.stringify({
            message: text.slice(0, RTA_MESSAGE_MAX),
            history: historyForRequest(messagesRef.current).slice(-RTA_HISTORY_LIMIT),
            facts: factsRef.current,
            pagePath: "/rta",
            spoken: true,
            mode: "rta",
            idempotencyKey:
              typeof crypto !== "undefined" && crypto.randomUUID
                ? crypto.randomUUID()
                : `rta_${Date.now()}`
          })
        });
        const assistant = createConciergeMessage("assistant", result.message, { liveAi: result.liveAi });
        const merged = mergeFacts(factsRef.current, result.facts);
        const all = [...nextMessages, assistant];
        setMessages(all);
        setFacts(merged);
        persist(all, merged);
        if (result.reason === "request_failed") void trackConciergeEvent("response_failed", "/rta");
        pendingRef.current = false;
        setPending(false);
        speakText(result.spokenText || result.message);
      } catch (err) {
        pendingRef.current = false;
        setPending(false);
        setError(actionErrorMessage(err, "Aethelios could not complete that reply. Stay here and try again."));
        void trackConciergeEvent("response_failed", "/rta");
        if (err instanceof ApiError && err.status === 429) {
          setError("Too many messages from this connection. Wait a moment, then continue.");
        }
        speakingRef.current = false;
        if (liveRef.current && !mutedRef.current) listen();
      }
    },
    [listen, persist, speakText]
  );
  sendTurnRef.current = sendTurn;

  useEffect(() => {
    let frame = 0;
    const tick = (now: number) => {
      pulseRef.current *= 0.86;
      if (speakingRef.current) {
        levelRef.current = speakEnvelope(now, pulseRef.current);
      } else if (state === "listening" && analyserRef.current && sampleRef.current) {
        const analyser = analyserRef.current;
        const samples = sampleRef.current;
        analyser.getByteTimeDomainData(samples as never);
        levelRef.current = Math.max(rmsFromTimeDomain(samples), pulseRef.current);
      } else if (state === "thinking") {
        levelRef.current = 0.1 + 0.04 * Math.sin(now / 180);
      } else {
        levelRef.current *= 0.94;
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [state]);

  useEffect(() => {
    return () => {
      liveRef.current = false;
      window.clearTimeout(flushTimer.current);
      recRef.current?.abort();
      window.speechSynthesis?.cancel();
      stopAudioGraph();
    };
  }, [stopAudioGraph]);

  const begin = useCallback(async () => {
    liveRef.current = true;
    setStarted(true);
    setMinimized(false);
    setError("");
    if (!support.listen) setTranscriptOpen(true);
    setState(support.listen ? "listening" : "idle");
    void trackConciergeEvent("voice_started", "/rta");
    try {
      await attachMicAnalyser();
    } catch {
      mutedRef.current = true;
      setMuted(true);
      setTranscriptOpen(true);
      setError("The microphone was blocked. You can still type in the transcript.");
      void trackConciergeEvent("voice_denied", "/rta");
    }
    speakText(RTA_PRESENCE);
  }, [attachMicAnalyser, speakText, support.listen]);

  const endCall = useCallback(() => {
    liveRef.current = false;
    speakingRef.current = false;
    pendingRef.current = false;
    window.clearTimeout(flushTimer.current);
    recRef.current?.abort();
    window.speechSynthesis.cancel();
    stopAudioGraph();
    setStarted(false);
    setMuted(false);
    setPending(false);
    setLiveLine("");
    setState("ended");
  }, [stopAudioGraph]);

  const toggleMute = useCallback(() => {
    const next = !mutedRef.current;
    mutedRef.current = next;
    setMuted(next);
    if (next) {
      recRef.current?.abort();
      if (!speakingRef.current && !pendingRef.current) setState("idle");
    } else if (liveRef.current && !speakingRef.current && !pendingRef.current) {
      listen();
    }
  }, [listen]);

  const startOver = useCallback(() => {
    const empty = emptyConciergeSession();
    setMessages(empty.messages);
    setFacts(empty.facts);
    setComposer("");
    setError("");
    setLiveLine("");
    messagesRef.current = empty.messages;
    factsRef.current = empty.facts;
    clearConciergeSession(typeof window === "undefined" ? null : window.localStorage, RTA_STORAGE_KEY);
  }, []);

  return (
    <div className={`rta-stage${minimized ? " is-min" : ""}${transcriptOpen ? " has-transcript" : ""}`}>
      {!minimized ? (
        <header className="rta-brand">
          <p>Aethelios</p>
          <p>RTA</p>
        </header>
      ) : null}

      <button
        type="button"
        className="rta-orb-hit"
        onClick={() => {
          if (!started) void begin();
          else if (minimized) setMinimized(false);
        }}
        aria-label={started ? (minimized ? "Expand Aethelios RTA" : "Aethelios is in the call") : "Start talking with Aethelios"}
      >
        <ArchitectOrb state={started ? state : "idle"} levelRef={levelRef} compact={minimized} />
      </button>

      {!minimized ? (
        <div className="rta-copy">
          <p className="rta-status" role="status">
            {statusLabel(state, muted, started)}
          </p>
          <p className="rta-presence">{RTA_PRESENCE}</p>
          {!started ? <p className="rta-hint">Tap the orb to begin a long conversation.</p> : null}
          {liveLine ? <p className="rta-live">{liveLine}</p> : null}
          {error ? <p className="rta-error">{error}</p> : null}
        </div>
      ) : null}

      {!minimized ? (
        <div className="rta-controls">
          {started ? (
            <>
              <button type="button" className="rta-ctrl" onClick={() => setMinimized(true)}>
                Minimize
              </button>
              <button type="button" className={`rta-ctrl${muted ? " is-on" : ""}`} onClick={toggleMute}>
                {muted ? "Unmute" : "Mute"}
              </button>
              <button
                type="button"
                className={`rta-ctrl${transcriptOpen ? " is-on" : ""}`}
                onClick={() => setTranscriptOpen((value) => !value)}
              >
                Transcript
              </button>
              <button type="button" className="rta-ctrl rta-ctrl-end" onClick={endCall}>
                End
              </button>
            </>
          ) : (
            <button type="button" className="rta-ctrl rta-ctrl-start" onClick={() => void begin()}>
              Begin
            </button>
          )}
        </div>
      ) : (
        <div className="rta-min-controls">
          <button type="button" className="rta-ctrl" onClick={() => setMinimized(false)}>
            Expand
          </button>
          <button type="button" className="rta-ctrl rta-ctrl-end" onClick={endCall}>
            End
          </button>
        </div>
      )}

      {transcriptOpen && !minimized ? (
        <aside className="rta-transcript" aria-label="Conversation transcript">
          <div className="rta-transcript-head">
            <h2>Transcript</h2>
            <button type="button" className="rta-ctrl" onClick={() => setTranscriptOpen(false)}>
              Close
            </button>
          </div>
          <p className="tiny rta-note">{RTA_CONVERSATION_NOTE}</p>
          <div className="rta-thread" ref={threadRef}>
            {messages.length === 0 ? <p className="muted">The conversation will appear here as you talk.</p> : null}
            {messages.map((message) => (
              <article key={message.id} className={`rta-msg rta-msg-${message.role}`}>
                <p>{message.body}</p>
              </article>
            ))}
            {pending ? <p className="tiny">Considering that…</p> : null}
          </div>
          <form
            className="rta-type"
            onSubmit={(event) => {
              event.preventDefault();
              const text = composer.trim();
              if (!text) return;
              setComposer("");
              if (!started) void begin();
              void sendTurn(text);
            }}
          >
            <label className="sr-only" htmlFor="rta-composer">
              Type if you would rather not speak
            </label>
            <textarea
              id="rta-composer"
              value={composer}
              onChange={(event) => setComposer(event.target.value)}
              rows={3}
              placeholder="Type if you would rather not speak."
            />
            <button type="submit" className="rta-ctrl">
              Send
            </button>
          </form>
          <button type="button" className="rta-ctrl" onClick={startOver}>
            Clear conversation
          </button>
        </aside>
      ) : null}

      {state === "ended" && !started ? (
        <div className="rta-ended">
          <p>The call ended. The conversation stays on this device.</p>
          <div className="row">
            <button type="button" className="rta-ctrl rta-ctrl-start" onClick={() => void begin()}>
              Start again
            </button>
            <AppLink className="rta-ctrl" href="/">
              Return home
            </AppLink>
          </div>
        </div>
      ) : null}
    </div>
  );
}
