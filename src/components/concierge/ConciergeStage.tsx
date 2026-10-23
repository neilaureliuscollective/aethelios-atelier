"use client";

import { useMemo, useRef, useState } from "react";
import { FULL_LOGO } from "@/lib/brand/fullLogo";
import { applySlide, mergePresentation } from "@/lib/concierge/merge";
import { parseConciergeChunk } from "@/lib/concierge/stream";
import type { ConciergeHistoryItem, PresentationDocument } from "@/lib/concierge/types";
import { ConciergeOrb, type OrbState } from "./ConciergeOrb";
import { PresentationCanvas } from "./PresentationCanvas";
import styles from "./concierge.module.css";

const PROMPTS = [
  "I run a barbershop in Austin and need a site that feels as considered as the chair.",
  "We're a custom home studio. I want a digital presence that matches the work.",
  "I have a salon and I already use a booking system."
];

type Workspace = "idle" | "chat" | "canvas";
type ChatMessage = { id: string; role: "user" | "assistant"; body: string };

export function ConciergeStage() {
  const [workspace, setWorkspace] = useState<Workspace>("idle");
  const [orbSize, setOrbSize] = useState<"hero" | "docked">("hero");
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [streaming, setStreaming] = useState("");
  const [error, setError] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [document, setDocument] = useState<PresentationDocument | null>(null);
  const [slideIndex, setSlideIndex] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const orbState: OrbState = pending
    ? document
      ? "composing"
      : "thinking"
    : workspace === "idle"
      ? "idle"
      : "listening";

  const history = useMemo<ConciergeHistoryItem[]>(
    () => messages.slice(-8).map((item) => ({ role: item.role, content: item.body })),
    [messages]
  );

  async function send(message: string) {
    const text = message.trim();
    if (!text || pending) return;
    setPending(true);
    setError("");
    setStreaming("");
    setWorkspace((current) => (current === "idle" ? "chat" : current));
    setOrbSize("docked");
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
        throw new Error("Aethelios could not complete that sketch.");
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
            setWorkspace("canvas");
            setDocument(event.document);
            setSlideIndex(0);
          }
          if (event.type === "canvas.slide") {
            setWorkspace("canvas");
            setDocument((current) => applySlide(current, event.slide));
            setSlideIndex(Number.MAX_SAFE_INTEGER);
          }
          if (event.type === "canvas.replace") {
            setWorkspace("canvas");
            setDocument((current) => mergePresentation(current, event.document) ?? event.document);
          }
          if (event.type === "canvas.complete") {
            setWorkspace("canvas");
            setDocument((current) => mergePresentation(current, event.document) ?? event.document);
            setSlideIndex(0);
          }
          if (event.type === "error") throw new Error(event.message);
          if (event.type === "done") {
            reply = event.reply || reply;
          }
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
  }

  function openFromOrb() {
    if (workspace === "idle") {
      setWorkspace("chat");
      return;
    }
    setOrbSize((current) => (current === "hero" ? "docked" : "hero"));
  }

  return (
    <section
      className={styles.stage}
      data-workspace={workspace}
      data-orb={orbSize}
      aria-labelledby="concierge-heading"
    >
      <div className={styles.media} aria-hidden="true">
        <img src="/atmosphere/colonnade.webp" alt="" width={1920} height={1080} />
      </div>
      <div className={styles.shade} aria-hidden="true" />
      <div className={styles.field} aria-hidden="true" />
      <div className={styles.shell}>
        <header className={styles.intro}>
          <div>
            <img
              className={styles.mark}
              src={FULL_LOGO.lockupSrc}
              alt="Aethelios Atelier"
              width={FULL_LOGO.width}
              height={FULL_LOGO.height}
            />
            <p className={styles.kicker}>Aethelios · Concierge</p>
            <h1 id="concierge-heading" className={styles.heading}>
              Speak the business.
              <br />
              <em>Watch it take form.</em>
            </h1>
            {workspace === "idle" ? (
              <p className={styles.lede}>
                Open a conversation with Aethelios. As you describe the work, a presentation is
                composed beside you — a visual sketch, not a finished website or a commission.
              </p>
            ) : null}
          </div>
          {workspace !== "idle" ? (
            <div className={styles.actions}>
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => setOrbSize((current) => (current === "hero" ? "docked" : "hero"))}
              >
                {orbSize === "hero" ? "Shrink orb" : "Enlarge orb"}
              </button>
              <button className="btn btn-ghost" type="button" onClick={() => abortRef.current?.abort()} disabled={!pending}>
                Interrupt
              </button>
            </div>
          ) : null}
        </header>

        <div className={styles.left}>
          <div className={styles.orbDock}>
            <ConciergeOrb
              state={orbState}
              label={workspace === "idle" ? "Open a conversation with Aethelios" : "Resize the Aethelios orb"}
              onToggle={openFromOrb}
            />
            <p className={styles.orbStatus}>
              {orbState === "composing"
                ? "Composing the canvas"
                : orbState === "thinking"
                  ? "Listening through the brief"
                  : workspace === "idle"
                    ? "Idle · tap to speak"
                    : "Ready"}
            </p>
          </div>

          {workspace === "idle" ? (
            <div>
              <div className={styles.prompts}>
                {PROMPTS.map((prompt) => (
                  <button key={prompt} className={styles.prompt} type="button" onClick={() => void send(prompt)}>
                    {prompt}
                  </button>
                ))}
              </div>
              <form
                className={styles.composer}
                style={{ marginTop: 16, maxWidth: 560, marginLeft: "auto", marginRight: "auto" }}
                onSubmit={(event) => {
                  event.preventDefault();
                  void send(input);
                }}
              >
                <label htmlFor="concierge-idle-input">Describe the business</label>
                <textarea
                  id="concierge-idle-input"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="I run a quiet studio in…"
                />
                <div className={styles.actions}>
                  <button className="btn btn-gold" type="submit" disabled={pending}>
                    {pending ? "Composing…" : "Talk with Aethelios"}
                  </button>
                </div>
              </form>
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
                      <p className={styles.meta}>{message.role === "user" ? "You" : "Aethelios"}</p>
                      <p>{message.body}</p>
                    </div>
                  ))}
                  {streaming ? (
                    <div className={styles.bubble}>
                      <p className={styles.meta}>Aethelios · composing</p>
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
                  <label htmlFor="concierge-input">Message Aethelios</label>
                  <textarea
                    id="concierge-input"
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    placeholder="Add a fact, a place, or ask to make it quieter."
                  />
                  <div className={styles.actions}>
                    <button className="btn btn-gold" type="submit" disabled={pending}>
                      {pending ? "Working…" : "Send"}
                    </button>
                  </div>
                  {error ? <p className="notice notice-warn">{error}</p> : null}
                </form>
              </div>
              <div className={styles.prompts}>
                {PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    className={styles.prompt}
                    type="button"
                    disabled={pending}
                    onClick={() => void send(prompt)}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <PresentationCanvas document={document} index={slideIndex} onSelect={setSlideIndex} />
      </div>
    </section>
  );
}
