"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import type { OrbState } from "@/components/concierge/ConciergeOrb";
import { applySlide, mergePresentation } from "@/lib/concierge/merge";
import { parseConciergeChunk } from "@/lib/concierge/stream";
import type { ConciergeHistoryItem, PresentationDocument } from "@/lib/concierge/types";
import { INTELLIGENCE_DISPLAY_NAME } from "@/lib/copy";

export type AetheliosMessage = { id: string; role: "user" | "assistant"; body: string };

type AetheliosValue = {
  messages: AetheliosMessage[];
  document: PresentationDocument | null;
  slideIndex: number;
  setSlideIndex: (index: number) => void;
  pending: boolean;
  streaming: string;
  error: string;
  input: string;
  setInput: (value: string) => void;
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
  orbState: OrbState;
  send: (message: string) => Promise<void>;
  abort: () => void;
};

const AetheliosContext = createContext<AetheliosValue | null>(null);

export function useAethelios() {
  const value = useContext(AetheliosContext);
  if (!value) {
    throw new Error("useAethelios must be used inside AetheliosProvider.");
  }
  return value;
}

export function AetheliosProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<AetheliosMessage[]>([]);
  const [document, setDocument] = useState<PresentationDocument | null>(null);
  const [slideIndex, setSlideIndex] = useState(0);
  const [pending, setPending] = useState(false);
  const [streaming, setStreaming] = useState("");
  const [error, setError] = useState("");
  const [input, setInput] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const history = useMemo<ConciergeHistoryItem[]>(
    () => messages.slice(-8).map((item) => ({ role: item.role, content: item.body })),
    [messages]
  );

  const send = useCallback(
    async (message: string) => {
      const text = message.trim();
      if (!text || pending) return;
      setPending(true);
      setError("");
      setStreaming("");
      setPanelOpen(true);
      setMessages((current) => [...current, { id: `user_${current.length}`, role: "user", body: text }]);
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const response = await fetch("/api/concierge/talk", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
          body: JSON.stringify({ message: text, history, document: document ?? undefined }),
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
    [document, history, pending]
  );

  const abort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const orbState: OrbState = pending ? (document ? "composing" : "thinking") : panelOpen ? "listening" : "idle";

  const value = useMemo(
    () => ({
      messages,
      document,
      slideIndex,
      setSlideIndex,
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
    }),
    [abort, document, error, input, messages, orbState, panelOpen, pending, send, slideIndex, streaming]
  );

  return <AetheliosContext.Provider value={value}>{children}</AetheliosContext.Provider>;
}
