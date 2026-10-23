"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ConciergePanel } from "@/components/concierge/ConciergePanel";
import { ApiError, api } from "@/lib/client/api";
import { actionErrorMessage } from "@/lib/client/asyncAction";
import { trackConciergeEvent } from "@/lib/concierge/analytics";
import { conversationHasUsefulContext } from "@/lib/concierge/brief";
import {
  conciergeInlineOnPath,
  conciergeVisibleOnPath,
  normalizeConciergePath
} from "@/lib/concierge/pages";
import {
  clearConciergeSession,
  createConciergeMessage,
  emptyConciergeSession,
  historyForRequest,
  mergeFacts,
  readConciergeSession,
  writeConciergeSession
} from "@/lib/concierge/persist";
import { messageForStarter } from "@/lib/concierge/starting";
import {
  CONCIERGE_OPEN_EVENT,
  emptyConciergeFacts,
  type ConciergeAction,
  type ConciergeFacts,
  type ConciergeMessage,
  type ConciergeSuggestion,
  type ConciergeTurnResult,
  type ConciergeWelcome
} from "@/lib/concierge/types";

export function ConciergeRoot() {
  const pathname = usePathname();
  const path = normalizeConciergePath(pathname);
  const visible = conciergeVisibleOnPath(path);
  const inline = conciergeInlineOnPath(path);
  const [open, setOpen] = useState(false);
  const [welcome, setWelcome] = useState<ConciergeWelcome | null>(null);
  const [messages, setMessages] = useState<ConciergeMessage[]>([]);
  const [facts, setFacts] = useState<ConciergeFacts>(emptyConciergeFacts());
  const [suggestions, setSuggestions] = useState<ConciergeSuggestion[]>([]);
  const [actions, setActions] = useState<ConciergeAction[]>([]);
  const [composer, setComposer] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [inquiryOpen, setInquiryOpen] = useState(false);
  const [spoken, setSpoken] = useState(false);
  const [spokenText, setSpokenText] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const userTurns = useRef(0);
  const openedOnce = useRef(false);
  const abandonArmed = useRef(false);

  const persist = useCallback((nextMessages: ConciergeMessage[], nextFacts: ConciergeFacts) => {
    writeConciergeSession(
      {
        version: 1,
        messages: nextMessages,
        facts: nextFacts,
        updatedAt: new Date().toISOString()
      },
      typeof window === "undefined" ? null : window.localStorage
    );
  }, []);

  useEffect(() => {
    const stored = readConciergeSession(typeof window === "undefined" ? null : window.localStorage);
    setMessages(stored.messages);
    setFacts(stored.facts);
    setHydrated(true);
    if (inline) setOpen(true);
  }, [inline]);

  useEffect(() => {
    if (!visible) return;
    void api<ConciergeWelcome>(`/api/concierge/talk?path=${encodeURIComponent(path)}`)
      .then((value) => setWelcome(value))
      .catch(() => setWelcome(null));
  }, [path, visible]);

  const openPanel = useCallback(
    (starter?: string) => {
      setOpen(true);
      if (!openedOnce.current) {
        openedOnce.current = true;
        void trackConciergeEvent("opened", path);
      }
      abandonArmed.current = conversationHasUsefulContext(facts, messages);
      if (starter) {
        setComposer(messageForStarter(starter));
      }
    },
    [facts, messages, path]
  );

  useEffect(() => {
    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<{ starter?: string }>).detail;
      openPanel(detail?.starter);
    };
    window.addEventListener(CONCIERGE_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(CONCIERGE_OPEN_EVENT, onOpen);
  }, [openPanel]);

  useEffect(() => {
    if (!open || inline) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, inline]);

  useEffect(() => {
    if (open || !abandonArmed.current) return;
    if (conversationHasUsefulContext(facts, messages) && !inquiryOpen) {
      void trackConciergeEvent("abandoned", path);
    }
    abandonArmed.current = false;
  }, [open, facts, messages, inquiryOpen, path]);

  const send = useCallback(
    async (raw?: string, fromVoice = false) => {
      const text = (raw ?? composer).trim();
      if (!text || pending) return;
      setPending(true);
      setError("");
      setComposer("");
      const userMessage = createConciergeMessage("user", text);
      const nextMessages = [...messages, userMessage];
      setMessages(nextMessages);
      persist(nextMessages, facts);
      userTurns.current += 1;
      if (fromVoice) setSpoken(true);
      if (userTurns.current === 1) void trackConciergeEvent("first_message", path);
      if (userTurns.current === 3) void trackConciergeEvent("engaged", path);
      try {
        const result = await api<ConciergeTurnResult>("/api/concierge/talk", {
          method: "POST",
          body: JSON.stringify({
            message: text,
            history: historyForRequest(messages),
            facts,
            pagePath: path,
            spoken: fromVoice || spoken,
            idempotencyKey:
              typeof crypto !== "undefined" && crypto.randomUUID
                ? crypto.randomUUID()
                : `cturn_${Date.now()}`
          })
        });
        const assistant = createConciergeMessage("assistant", result.message, { liveAi: result.liveAi });
        const merged = mergeFacts(facts, result.facts);
        const all = [...nextMessages, assistant];
        setMessages(all);
        setFacts(merged);
        setSuggestions(result.suggestions);
        setActions(result.actions);
        setSpokenText(result.spokenText || result.message);
        persist(all, merged);
        if (result.reason === "request_failed") void trackConciergeEvent("response_failed", path);
        if (result.inquiryReady) setInquiryOpen(false);
      } catch (err) {
        setError(actionErrorMessage(err, "Aethelios could not complete that reply. Retry or send a request to Neil."));
        void trackConciergeEvent("response_failed", path);
        if (err instanceof ApiError && err.status === 429) {
          setError("Too many messages from this connection. Wait a moment, then try again.");
        }
      } finally {
        setPending(false);
      }
    },
    [composer, facts, messages, path, pending, persist, spoken]
  );

  const onSuggestion = useCallback(
    (suggestion: ConciergeSuggestion) => {
      void trackConciergeEvent("suggestion_selected", path);
      void send(messageForStarter(suggestion.id, suggestion.label));
    },
    [path, send]
  );

  const startOver = useCallback(() => {
    const empty = emptyConciergeSession();
    setMessages(empty.messages);
    setFacts(empty.facts);
    setSuggestions([]);
    setActions([]);
    setInquiryOpen(false);
    setError("");
    setComposer("");
    setSpoken(false);
    setSpokenText("");
    userTurns.current = 0;
    clearConciergeSession(typeof window === "undefined" ? null : window.localStorage);
  }, []);

  const panel = useMemo(
    () => (
      <ConciergePanel
        variant={inline ? "inline" : "dock"}
        welcome={welcome}
        messages={messages}
        facts={facts}
        suggestions={suggestions}
        actions={actions}
        pending={pending}
        error={error}
        inquiryOpen={inquiryOpen}
        composer={composer}
        onComposerChange={setComposer}
        onSend={(text) => void send(text)}
        spokenText={spokenText}
        onVoiceTranscript={(text) => void send(text, true)}
        onSuggestion={onSuggestion}
        onClose={() => setOpen(false)}
        onStartOver={startOver}
        onInquiryOpen={() => {
          setInquiryOpen(true);
          void trackConciergeEvent("inquiry_started", path);
        }}
        onInquiryClose={() => setInquiryOpen(false)}
        onInquirySubmitted={() => setInquiryOpen(true)}
        onAction={(action) => {
          if (action.kind === "link" || action.kind === "start_brief") {
            void trackConciergeEvent("link_clicked", path);
          }
          if (action.kind === "start_inquiry") {
            void trackConciergeEvent("handoff_requested", path);
          }
        }}
        path={path}
      />
    ),
    [actions, composer, error, facts, inline, inquiryOpen, messages, onSuggestion, path, pending, send, spokenText, startOver, suggestions, welcome]
  );

  if (!visible || !hydrated) return null;

  if (inline) {
    return <div className="concierge-inline-host">{panel}</div>;
  }

  return (
    <>
      {open ? (
        <div className="concierge-dock" id="aethelios-concierge">
          {panel}
        </div>
      ) : (
        <button
          type="button"
          className="concierge-launcher"
          aria-expanded={false}
          aria-controls="aethelios-concierge"
          onClick={() => openPanel()}
        >
          <span className="concierge-launcher-mark" aria-hidden="true">
            Æ
          </span>
          <span>Ask Aethelios</span>
        </button>
      )}
    </>
  );
}
