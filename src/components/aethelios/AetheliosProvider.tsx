"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { briefReady, emptyBrief, type DiscoveryBrief } from "@/lib/concierge/brief";
import { applySlide, mergePresentation } from "@/lib/concierge/merge";
import { CONCIERGE_HISTORY_LIMIT } from "@/lib/concierge/schema";
import { parseConciergeChunk } from "@/lib/concierge/stream";
import type { ConciergeHistoryItem, PresentationDocument, SitePreview } from "@/lib/concierge/types";
import { documentSourceFromTalk, isUsableDocumentSource } from "@/lib/concierge/documentSource";
import { INTELLIGENCE_DISPLAY_NAME } from "@/lib/copy";

export type AetheliosMessage = { id: string; role: "user" | "assistant"; body: string };

/** Mirrors MAX_VISITOR_TURNS on the server. */
export const MAX_VISITOR_TURNS = 30;

type AetheliosValue = {
  sessionId: string;
  messages: AetheliosMessage[];
  document: PresentationDocument | null;
  preview: SitePreview | null;
  slideIndex: number;
  setSlideIndex: (index: number) => void;
  pending: boolean;
  streaming: string;
  error: string;
  input: string;
  setInput: (value: string) => void;
  brief: DiscoveryBrief;
  ready: boolean;
  atLimit: boolean;
  send: (message: string, options?: SendOptions) => Promise<void>;
  composeDocument: () => Promise<void>;
  abort: () => void;
};

/** quiet: compose from turns already on screen without echoing them as a new bubble. */
type SendOptions = { compose?: boolean; quiet?: boolean };

const AetheliosContext = createContext<AetheliosValue | null>(null);

export function useAethelios() {
  const value = useContext(AetheliosContext);
  if (!value) {
    throw new Error("useAethelios must be used inside AetheliosProvider.");
  }
  return value;
}

export function AetheliosProvider({ children }: { children: ReactNode }) {
  const sessionId = useMemo(
    () => (typeof crypto !== "undefined" && crypto.randomUUID ? `talk_${crypto.randomUUID()}` : `talk_${Date.now()}`),
    []
  );
  const [messages, setMessages] = useState<AetheliosMessage[]>([]);
  const [document, setDocument] = useState<PresentationDocument | null>(null);
  const [preview, setPreview] = useState<SitePreview | null>(null);
  const [slideIndex, setSlideIndex] = useState(0);
  const [pending, setPending] = useState(false);
  const [streaming, setStreaming] = useState("");
  const [error, setError] = useState("");
  const [input, setInput] = useState("");
  const [brief, setBrief] = useState<DiscoveryBrief>(() => emptyBrief());
  const abortRef = useRef<AbortController | null>(null);
  const inputLatest = useRef("");
  const sendLatest = useRef<(message: string, options?: SendOptions) => Promise<void>>(
    async () => undefined
  );
  const pendingLatest = useRef(false);
  const messagesLatest = useRef(messages);
  inputLatest.current = input;
  pendingLatest.current = pending;
  messagesLatest.current = messages;

  const history = useMemo<ConciergeHistoryItem[]>(
    () => messages.slice(-CONCIERGE_HISTORY_LIMIT).map((item) => ({ role: item.role, content: item.body.slice(0, 2000) })),
    [messages]
  );

  const send = useCallback(
    async (message: string, options?: SendOptions) => {
      const text = message.trim();
      if (!text) return;
      if (pendingLatest.current && !options?.compose) return;
      const turn = messagesLatest.current.filter((item) => item.role === "user").length;
      if (!options?.compose && turn >= MAX_VISITOR_TURNS) return;
      setPending(true);
      setError("");
      setStreaming("");
      if (!options?.quiet) {
        setMessages((current) => [...current, { id: `user_${current.length}`, role: "user", body: text }]);
      }
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const response = await fetch("/api/concierge/talk", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
          body: JSON.stringify({
            message: text,
            history,
            brief,
            turn,
            document: document ?? undefined,
            preview: preview ?? undefined,
            compose: options?.compose
          }),
          signal: controller.signal
        });
        if (!response.ok || !response.body) {
          throw new Error(`${INTELLIGENCE_DISPLAY_NAME} could not complete that sketch.`);
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let reply = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const chunks = buffer.split("\n\n");
          buffer = chunks.pop() ?? "";
          for (const event of parseConciergeChunk(chunks.map((chunk) => `${chunk}\n\n`).join(""))) {
            if (event.type === "delta" && event.text) {
              reply += event.text;
              setStreaming(reply);
            }
            if (event.type === "canvas.open") {
              setDocument(event.document);
              setSlideIndex(0);
            }
            if (event.type === "canvas.slide") {
              setDocument((current) => applySlide(current, event.slide));
              setSlideIndex(Number.MAX_SAFE_INTEGER);
            }
            if (event.type === "canvas.replace") {
              setDocument((current) => mergePresentation(current, event.document) ?? event.document);
            }
            if (event.type === "brief") {
              setBrief(event.brief);
            }
            if (event.type === "preview.ready") {
              setPreview(event.preview);
            }
            if (event.type === "canvas.complete") {
              setDocument((current) => mergePresentation(current, event.document) ?? event.document);
              setSlideIndex(0);
            }
            if (event.type === "error") throw new Error(event.message);
            if (event.type === "done") reply = event.reply || reply;
          }
        }
        setMessages((current) => [...current, { id: `assistant_${current.length}`, role: "assistant", body: reply }]);
        setStreaming("");
        setInput("");
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : "That sketch could not be completed.");
        }
      } finally {
        if (abortRef.current === controller) setPending(false);
      }
    },
    [brief, document, history, preview]
  );

  sendLatest.current = send;

  const composeDocument = useCallback(async () => {
    const visitorTurns = messagesLatest.current.filter((item) => item.role === "user").map((item) => item.body);
    const typed = inputLatest.current.trim();
    const source = documentSourceFromTalk(typed, visitorTurns);
    const usable = isUsableDocumentSource(source);
    if (typed && usable) {
      setMessages((current) => [...current, { id: `user_${current.length}`, role: "user", body: typed }]);
      setInput("");
    }
    await sendLatest.current(usable ? source : documentSourceFromTalk("", []), {
      compose: true,
      quiet: usable
    });
  }, []);

  const abort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const value = useMemo(
    () => ({
      sessionId,
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
      brief,
      ready: briefReady(brief),
      atLimit: messages.filter((item) => item.role === "user").length >= MAX_VISITOR_TURNS,
      send,
      composeDocument,
      abort
    }),
    [abort, brief, composeDocument, document, error, input, messages, pending, preview, send, sessionId, slideIndex, streaming]
  );

  return (
    <AetheliosContext.Provider value={value}>
      {children}
    </AetheliosContext.Provider>
  );
}
