"use client";

import { useEffect, useRef, useState } from "react";
import { CompanionShell } from "@/components/cofounder/CompanionShell";
import { VoiceControl } from "@/components/cofounder/VoiceControl";
import { AppLink } from "@/components/ui/AppLink";
import { api } from "@/lib/client/api";
import { actionErrorMessage } from "@/lib/client/asyncAction";
import { ownerFence } from "@/lib/client/ownerFence";
import { useSession } from "@/components/shell/SessionShell";
import { STARTING_ACTIONS } from "@/lib/cofounder/startingActions";
import type { CompanionMessage } from "@/lib/cofounder/types";
import styles from "./companion.module.css";

export function TalkClient() {
  const { user, generation } = useSession();
  const [messages, setMessages] = useState<CompanionMessage[]>([]);
  const [conversationId, setConversationId] = useState<string>();
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const requestRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const gen = generation;
    void (async () => {
      try {
        const data = await api<{ conversation: { id: string }; messages: CompanionMessage[] }>("/api/companion/talk");
        if (!ownerFence.isCurrent(gen, user.id)) return;
        setConversationId(data.conversation.id);
        setMessages(data.messages);
      } catch (err) {
        if (!ownerFence.isCurrent(gen, user.id)) return;
        setError(actionErrorMessage(err, "Talk history could not be loaded."));
      }
    })();
  }, [generation, user]);

  async function send(message: string) {
    if (!message.trim() || pending) return;
    setPending(true);
    setError("");
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const idempotencyKey = requestRef.current ?? crypto.randomUUID();
    requestRef.current = idempotencyKey;
    try {
      const result = await api<{
        conversation: { id: string };
        userMessage: CompanionMessage;
        assistantMessage: CompanionMessage;
      }>("/api/companion/talk", {
        method: "POST",
        body: JSON.stringify({ conversationId, message, idempotencyKey }),
        signal: controller.signal
      });
      if (!ownerFence.isCurrent(generation, user?.id ?? null)) return;
      setConversationId(result.conversation.id);
      setMessages((current) => {
        const next = [...current];
        if (!next.some((item) => item.id === result.userMessage.id)) next.push(result.userMessage);
        if (!next.some((item) => item.id === result.assistantMessage.id)) next.push(result.assistantMessage);
        return next;
      });
      setInput("");
      requestRef.current = null;
    } catch (err) {
      if (controller.signal.aborted) {
        setError("Reply interrupted. Saved work was not duplicated.");
      } else {
        setError(actionErrorMessage(err, "That reply failed. Retry uses the same request id."));
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <CompanionShell
      title="Talk as working interface"
      lede="Plan a promotion, draft copy, review your documents, or prepare an estimate from approved rates. Starting actions do not force a questionnaire."
    >
      <div className={styles.grid}>
        <article className={`surface-dimensional ${styles.card}`}>
          <div className={styles.messages} aria-live="polite">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`${styles.bubble} ${message.authorKind === "client" ? styles.bubbleUser : ""}`}
              >
                <p className="tiny">
                  {message.authorKind} {message.liveAi ? "· live model" : "· saved"}
                </p>
                <p style={{ whiteSpace: "pre-wrap" }}>{message.body}</p>
              </div>
            ))}
          </div>
          <form
            className={styles.composer}
            onSubmit={(event) => {
              event.preventDefault();
              void send(input);
            }}
          >
            <label className="tiny" htmlFor="talk-input">
              Message Aethelios
            </label>
            <textarea
              id="talk-input"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Help me announce my new service."
            />
            <div className={styles.actions}>
              <button className="btn btn-gold" type="submit" disabled={pending}>
                {pending ? "Working…" : "Send"}
              </button>
              <button
                className="btn btn-ghost"
                type="button"
                disabled={!pending}
                onClick={() => abortRef.current?.abort()}
              >
                Interrupt
              </button>
              <button
                className="btn btn-ghost"
                type="button"
                disabled={pending || !error}
                onClick={() => void send(input)}
              >
                Retry same request
              </button>
            </div>
            {error ? <p className="notice notice-warn">{error}</p> : null}
          </form>
        </article>
        <aside className={`panel ${styles.card}`}>
          <p className="tiny">Start here</p>
          <div className={styles.list}>
            {STARTING_ACTIONS.map((action) => (
              <button
                key={action.id}
                className="btn btn-ghost"
                type="button"
                onClick={() => void send(action.prompt)}
              >
                {action.label}
              </button>
            ))}
          </div>
          <div style={{ marginTop: 20 }}>
            <VoiceControl />
          </div>
          <p className="muted" style={{ marginTop: 16 }}>
            Reviewed copy can move into Studio without leaving this workspace.
          </p>
          <AppLink className="btn btn-emerald" href="/companion/studio">
            Open Studio
          </AppLink>
        </aside>
      </div>
    </CompanionShell>
  );
}
