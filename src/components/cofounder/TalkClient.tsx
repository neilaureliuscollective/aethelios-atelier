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

type ProposedAction = { id: string; title: string; preview: string };
type SavedWork = { id: string; title: string; href: string };

export function TalkClient() {
  const { user, generation } = useSession();
  const [messages, setMessages] = useState<CompanionMessage[]>([]);
  const [conversationId, setConversationId] = useState<string>();
  const [businessId, setBusinessId] = useState<string>();
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [streaming, setStreaming] = useState("");
  const [proposed, setProposed] = useState<ProposedAction[]>([]);
  const [savedWork, setSavedWork] = useState<SavedWork[]>([]);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const requestRef = useRef<string | null>(null);
  const draftRef = useRef("");
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!user) return;
    const gen = generation;
    void (async () => {
      try {
        const workspace = await api<{ business: { id: string } }>("/api/companion/workspace");
        const data = await api<{ conversation: { id: string }; messages: CompanionMessage[] }>(
          `/api/companion/talk?businessId=${encodeURIComponent(workspace.business.id)}`
        );
        if (!ownerFence.isCurrent(gen, user.id)) return;
        setBusinessId(workspace.business.id);
        setConversationId(data.conversation.id);
        setMessages(data.messages);
      } catch (err) {
        if (!ownerFence.isCurrent(gen, user.id)) return;
        setError(actionErrorMessage(err, "Talk history could not be loaded."));
      }
    })();
  }, [generation, user]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  async function send(message: string) {
    if (!message.trim() || pending) return;
    draftRef.current = message;
    setPending(true);
    setError("");
    setStreaming("");
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const idempotencyKey = requestRef.current ?? crypto.randomUUID();
    requestRef.current = idempotencyKey;
    try {
      const response = await fetch("/api/companion/talk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream"
        },
        body: JSON.stringify({
          businessId,
          conversationId,
          message,
          idempotencyKey,
          stream: true
        }),
        signal: controller.signal
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(data.message ?? "That reply failed.");
      }
      if (!response.body) throw new Error("Streaming is unavailable.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";
        for (const chunk of chunks) {
          const type = chunk.match(/^event: (.+)$/m)?.[1];
          const raw = chunk.match(/^data: (.+)$/m)?.[1];
          if (!type || !raw) continue;
          const event = JSON.parse(raw) as {
            type: string;
            message?: CompanionMessage;
            text?: string;
            turn?: {
              conversation: { id: string };
              userMessage: CompanionMessage;
              assistantMessage: CompanionMessage;
              proposedActions?: ProposedAction[];
              savedWork?: SavedWork[];
            };
          };
          if (!ownerFence.isCurrent(generation, user?.id ?? null)) return;
          if (event.type === "user" && event.message) {
            setMessages((current) =>
              current.some((item) => item.id === event.message?.id) ? current : [...current, event.message!]
            );
          }
          if (event.type === "delta" && event.text) {
            setStreaming((current) => current + event.text);
          }
          if (event.type === "done" && event.turn) {
            setConversationId(event.turn.conversation.id);
            setMessages((current) => {
              const next = [...current];
              if (!next.some((item) => item.id === event.turn!.userMessage.id)) next.push(event.turn!.userMessage);
              if (!next.some((item) => item.id === event.turn!.assistantMessage.id)) next.push(event.turn!.assistantMessage);
              return next;
            });
            setProposed(event.turn.proposedActions ?? []);
            setSavedWork(event.turn.savedWork ?? []);
            setStreaming("");
            setInput("");
            draftRef.current = "";
            requestRef.current = null;
          }
        }
      }
    } catch (err) {
      setInput(draftRef.current);
      if (controller.signal.aborted) {
        setError("Reply interrupted. Unsent text is still here. Review Work if a tool already saved something.");
      } else {
        setError(actionErrorMessage(err, "That reply failed. Unsent text is still here. Retry uses the same request id."));
      }
    } finally {
      setPending(false);
    }
  }

  async function confirmAction(id: string) {
    await api("/api/companion/work", {
      method: "PATCH",
      body: JSON.stringify({ workItemId: id, action: "confirm", businessId })
    });
    setProposed((current) => current.filter((item) => item.id !== id));
  }

  return (
    <CompanionShell
      title="Talk as working interface"
      lede="Plan a promotion, draft copy, review your documents, or prepare an estimate from approved rates."
    >
      <div className={styles.grid}>
        <article className={styles.glassCard}>
          <div className={styles.messages} aria-live="polite" ref={listRef}>
            {messages.map((message) => (
              <div
                key={message.id}
                className={`${styles.bubble} ${message.authorKind === "client" ? styles.bubbleUser : ""}`}
              >
                <p className={styles.meta}>
                  {message.authorKind} {message.liveAi ? "· live model" : "· saved"}
                </p>
                <p style={{ whiteSpace: "pre-wrap" }}>{message.body}</p>
              </div>
            ))}
            {streaming ? (
              <div className={styles.bubble}>
                <p className={styles.meta}>Aethelios · streaming</p>
                <p style={{ whiteSpace: "pre-wrap" }}>{streaming}</p>
              </div>
            ) : null}
          </div>
          {savedWork.length ? (
            <div className={styles.list} style={{ marginTop: 16 }}>
              <p className={styles.label}>Saved from this turn</p>
              {savedWork.map((item) => (
                <article key={item.id} className={styles.resultCard}>
                  <h3>{item.title}</h3>
                  <div className={styles.actions}>
                    <AppLink className="btn btn-emerald-glass btn-compact" href={`/companion/studio?workItemId=${encodeURIComponent(item.id)}`}>
                      Open in Studio
                    </AppLink>
                    <AppLink className="btn btn-ghost btn-compact" href={item.href}>
                      Open in Work
                    </AppLink>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
          {proposed.length ? (
            <div className={styles.list} style={{ marginTop: 16 }}>
              <p className={styles.label}>Proposed actions — nothing is saved until you confirm</p>
              {proposed.map((item) => (
                <div key={item.id} className={styles.resultCard}>
                  <strong>{item.title}</strong>
                  <p className="muted" style={{ whiteSpace: "pre-wrap" }}>
                    {item.preview.slice(0, 280)}
                  </p>
                  <button className="btn btn-gold btn-compact" type="button" onClick={() => void confirmAction(item.id)}>
                    Confirm and save
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          <form
            className={styles.composerBar}
            onSubmit={(event) => {
              event.preventDefault();
              void send(input);
            }}
          >
            <label className={styles.label} htmlFor="talk-input">
              Message Aethelios
            </label>
            <textarea
              id="talk-input"
              className={styles.composerInput}
              value={input}
              onChange={(event) => {
                setInput(event.target.value);
                draftRef.current = event.target.value;
              }}
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
                onClick={() => void send(draftRef.current || input)}
              >
                Retry same request
              </button>
            </div>
            {error ? <p className="notice notice-warn">{error}</p> : null}
          </form>
        </article>
        <aside className={styles.inspector}>
          <p className={styles.label}>Start here</p>
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
            <VoiceControl businessId={businessId} />
          </div>
          <p className="muted" style={{ marginTop: 16 }}>
            Reviewed copy can move into Studio without leaving this workspace.
          </p>
          <AppLink className="btn btn-emerald-glass" href="/companion/studio">
            Open Studio
          </AppLink>
        </aside>
      </div>
    </CompanionShell>
  );
}
