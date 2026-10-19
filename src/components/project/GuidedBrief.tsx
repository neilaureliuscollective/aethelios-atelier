"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FIELD_HINTS, FIELD_LABELS, applyClientValue, fieldsForStep, isBookingConnected } from "@/lib/brief";
import {
  createGuestDraft,
  markGuestRetained,
  readGuestDraft,
  writeGuestDraft
} from "@/lib/guest/draft";
import { CONSENT_TEXT } from "@/lib/copy";
import { LivingBrief } from "@/components/project/LivingBrief";
import { api, ApiError } from "@/lib/client/api";
import type { Brief, BriefFieldKey, ChatMessage, Project, Suggestion, User } from "@/lib/types";

const STEPS = [
  { n: 1, label: "Vision" },
  { n: 2, label: "Audience" },
  { n: 3, label: "References" },
  { n: 4, label: "Scope" },
  { n: 5, label: "Review" }
];

const TYPE_OPTIONS: Array<{ id: Brief["projectType"]["value"]; label: string }> = [
  { id: "website", label: "Website" },
  { id: "booking_connected_website", label: "Booking-connected site" },
  { id: "digital_infrastructure", label: "Digital infrastructure" },
  { id: "undecided", label: "Not sure yet" }
];

type SessionResponse = { user: User | null };
type ProjectResponse = {
  project: Project;
  suggestions: Suggestion[];
  messages: ChatMessage[];
};

export function GuidedBrief() {
  const [user, setUser] = useState<User | null>(null);
  const [step, setStep] = useState(1);
  const [pane, setPane] = useState<"guide" | "brief">("guide");
  const [brief, setBrief] = useState<Brief>(() => createGuestDraft().brief);
  const [guestId, setGuestId] = useState<string | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<string>("");
  const [consent, setConsent] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [receipt, setReceipt] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "conflict" | "uncertain">("idle");
  const [aureliusNote, setAureliusNote] = useState("Checking assistant availability…");
  const generation = useRef(0);
  const inFlight = useRef(0);
  const idempotency = useRef<string>(crypto.randomUUID());

  useEffect(() => {
    void (async () => {
      const session = await api<SessionResponse>("/api/session");
      setUser(session.user);
      const config = await api<{ aurelius: { ready: boolean; unavailableReason?: string } }>("/api/config");
      setAureliusNote(
        config.aurelius.ready
          ? "Aurelius is configured for live replies."
          : "Aurelius is unavailable because live model access is not authorized. Continue with the structured brief. This is not a live AI reply."
      );
      if (session.user) {
        const list = await api<{ projects: Project[] }>("/api/projects");
        const existing = list.projects[0];
        if (existing) {
          const view = await api<ProjectResponse>(`/api/projects/${existing.id}`);
          setProject(view.project);
          setBrief(view.project.brief);
          setSuggestions(view.suggestions);
          setMessages(view.messages);
          return;
        }
      }
      const guest = readGuestDraft() ?? createGuestDraft();
      writeGuestDraft(guest);
      setGuestId(guest.draftId);
      setBrief(guest.brief);
      setMessages(
        guest.messages.map((item) => ({
          ...item,
          projectId: guest.draftId
        }))
      );
    })();
  }, []);

  useEffect(() => {
    if (project || !guestId) return;
    const guest = readGuestDraft();
    if (!guest) return;
    writeGuestDraft({ ...guest, brief, draftId: guestId, messages: messages.map((m) => ({
      id: m.id,
      authorKind: m.authorKind,
      body: m.body,
      liveAi: m.liveAi,
      createdAt: m.createdAt
    })) });
  }, [brief, guestId, messages, project]);

  async function persist(nextBrief: Brief) {
    if (!project) return;
    generation.current += 1;
    const localGeneration = generation.current;
    const expected = project.version;
    setSaveState("saving");
    inFlight.current += 1;
    try {
      const result = await api<{ project: Project }>(`/api/projects/${project.id}`, {
        method: "PATCH",
        body: JSON.stringify({ brief: nextBrief, expectedVersion: expected, localGeneration })
      });
      if (generation.current === localGeneration) {
        setProject(result.project);
        setSaveState("saved");
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setSaveState("conflict");
        setStatus("A newer save exists. Your latest typing on this screen was kept and was not overwritten.");
      } else if (!navigator.onLine) {
        setSaveState("uncertain");
        setStatus("Connection lost. This edit is still on the device and was not confirmed as saved.");
      } else {
        setSaveState("uncertain");
        setStatus("Save did not confirm. Retry the same edit — it will not duplicate a submission.");
      }
    } finally {
      inFlight.current -= 1;
    }
  }

  function updateField(key: BriefFieldKey, value: string) {
    const next = applyClientValue(brief, key, value);
    setBrief(next);
    void persist(next);
  }

  async function sendChat() {
    const text = chatInput.trim();
    if (!text) return;
    setChatInput("");
    if (!project) {
      const local: ChatMessage = {
        id: crypto.randomUUID(),
        projectId: guestId ?? "guest",
        authorKind: "client",
        body: text,
        liveAi: false,
        createdAt: new Date().toISOString()
      };
      const notice: ChatMessage = {
        id: crypto.randomUUID(),
        projectId: local.projectId,
        authorKind: "system",
        body: "Aurelius is not live on a guest draft. Continue the structured brief, then sign in if you want a saved conversation. This is not a live AI reply.",
        liveAi: false,
        createdAt: new Date().toISOString()
      };
      setMessages((current) => [...current, local, notice]);
      return;
    }
    const result = await api<{ view: ProjectResponse; liveAi: boolean }>(`/api/projects/${project.id}/messages`, {
      method: "POST",
      body: JSON.stringify({ body: text })
    });
    setMessages(result.view.messages);
    setBrief(result.view.project.brief);
    setSuggestions(result.view.suggestions);
    setProject(result.view.project);
  }

  async function resolveSuggestion(id: string, action: "accept" | "reject") {
    if (!project) return;
    const result = await api<{ view: ProjectResponse }>(`/api/projects/${project.id}/suggestions/${id}`, {
      method: "POST",
      body: JSON.stringify({ action })
    });
    setBrief(result.view.project.brief);
    setSuggestions(result.view.suggestions);
    setProject(result.view.project);
  }

  async function submit() {
    if (!project) {
      window.location.href = "/account?next=/account/adopt";
      return;
    }
    if (!consent) {
      setStatus("Explicit consent is required before a snapshot can be sent.");
      return;
    }
    try {
      const result = await api<{ receipt: { receiptId: string } }>(`/api/projects/${project.id}/submit`, {
        method: "POST",
        body: JSON.stringify({
          consent: true,
          consentTextAcknowledged: true,
          idempotencyKey: idempotency.current
        })
      });
      setReceipt(result.receipt.receiptId);
      if (guestId) {
        const guest = readGuestDraft();
        if (guest) markGuestRetained(guest, project.id);
      }
      window.location.href = `/workspace/${project.id}`;
    } catch (error) {
      setSaveState("uncertain");
      setStatus(
        error instanceof ApiError
          ? error.message
          : "Submission is uncertain. Retry with the same command — it will not create a second snapshot."
      );
    }
  }

  const visibleFields = useMemo(() => fieldsForStep(step, brief), [step, brief]);

  return (
    <div className="container-wide">
      <div className="workspace-tabs" style={{ paddingTop: 16 }}>
        <button className="chip" type="button" aria-pressed={pane === "guide"} onClick={() => setPane("guide")}>
          Guide
        </button>
        <button className="chip" type="button" aria-pressed={pane === "brief"} onClick={() => setPane("brief")}>
          Living brief
        </button>
      </div>
      <div className="workspace-shell">
        <nav className="panel step-nav" aria-label="Brief steps">
          <p className="tiny">Your project brief</p>
          <ol>
            {STEPS.map((item) => (
              <li key={item.n}>
                <button
                  type="button"
                  className={step === item.n ? "active" : ""}
                  aria-current={step === item.n ? "step" : undefined}
                  onClick={() => setStep(item.n)}
                >
                  <span>{item.n}</span>
                  {item.label}
                </button>
              </li>
            ))}
          </ol>
          <p className="muted" style={{ marginTop: 16, fontSize: 13 }}>
            {project ? "Saved to your account." : "Guest draft on this device."}
          </p>
          <p className="tiny">
            {saveState === "saved"
              ? "Saved"
              : saveState === "saving"
                ? "Saving"
                : saveState === "conflict"
                  ? "Newer copy kept"
                  : saveState === "uncertain"
                    ? "Save unconfirmed"
                    : project
                      ? "Account draft"
                      : "Device draft"}
          </p>
        </nav>

        <section className={`panel brief-stage ${pane === "guide" ? "" : "pane-hidden"}`}>
          <p className="kicker">{project ? "Authenticated brief" : "Saved on this device"}</p>
          {step < 5 ? (
            <>
              <h1 style={{ fontSize: "clamp(32px, 5vw, 52px)" }}>{FIELD_HINTS[visibleFields[0] ?? "vision"]}</h1>
              <p className="muted">Start with the idea. You can refine details as you go. Questions adapt to what you already answered.</p>
              {visibleFields.map((key) => (
                <div key={key} style={{ marginTop: 18 }}>
                  <label>
                    <span className="lbl">{FIELD_LABELS[key]}</span>
                    {key === "projectType" ? (
                      <div className="chips" role="group" aria-label="Project type">
                        {TYPE_OPTIONS.map((option) => (
                          <button
                            key={option.id}
                            className="chip"
                            type="button"
                            aria-pressed={brief.projectType.value === option.id}
                            onClick={() => updateField("projectType", option.id)}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <textarea
                        value={brief[key].value}
                        onChange={(event) => updateField(key, event.target.value)}
                        placeholder={FIELD_HINTS[key]}
                      />
                    )}
                  </label>
                </div>
              ))}
              {step === 4 && isBookingConnected(brief) ? (
                <p className="notice">
                  Booking-connected means a link to the booking destination you already use. It does not
                  build a scheduler or move payments into Atelier.
                </p>
              ) : null}
              <div className="row" style={{ marginTop: 22, justifyContent: "space-between" }}>
                <button className="btn btn-ghost" type="button" onClick={() => setStep((n) => Math.max(1, n - 1))}>
                  Back
                </button>
                <button className="btn btn-gold" type="button" onClick={() => setStep((n) => Math.min(5, n + 1))}>
                  Continue
                </button>
              </div>
              <div className="conversation" style={{ marginTop: 28 }}>
                <p className="tiny">Conversation</p>
                <p className="notice">{aureliusNote}</p>
                {messages.map((message) => (
                  <div key={message.id} className={`bubble bubble-${message.authorKind}`}>
                    <p className="tiny">
                      {message.authorKind === "client"
                        ? "You"
                        : message.liveAi
                          ? "Aurelius"
                          : "System — not live AI"}
                    </p>
                    <p>{message.body}</p>
                  </div>
                ))}
                <label>
                  <span className="lbl">Ask Aurelius, or continue the form</span>
                  <textarea value={chatInput} onChange={(event) => setChatInput(event.target.value)} rows={3} />
                </label>
                <button className="btn btn-emerald" type="button" onClick={() => void sendChat()}>
                  Send
                </button>
              </div>
            </>
          ) : (
            <>
              <h1>Review before anything is sent.</h1>
              <p className="lede">
                Later edits will not change a submitted snapshot. Guest drafts cannot be sent until you
                sign in, review, and adopt them.
              </p>
              <LivingBrief brief={brief} suggestions={suggestions} onResolve={project ? resolveSuggestion : undefined} />
              <label className="notice" style={{ display: "block", marginTop: 18 }}>
                <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />{" "}
                {CONSENT_TEXT}
              </label>
              {status ? <p className="notice notice-warn">{status}</p> : null}
              {receipt ? <p className="notice">Receipt {receipt}</p> : null}
              <div className="row" style={{ marginTop: 18 }}>
                <button className="btn btn-ghost" type="button" onClick={() => setStep(4)}>
                  Back
                </button>
                <button className="btn btn-gold" type="button" onClick={() => void submit()}>
                  {project ? "Send to Neil" : "Sign in to send"}
                </button>
              </div>
            </>
          )}
        </section>

        <div className={pane === "brief" ? "" : "pane-hidden-mobile"}>
          <LivingBrief brief={brief} suggestions={suggestions} onResolve={project ? resolveSuggestion : undefined} />
          <p className="notice" style={{ marginTop: 12 }}>
            Nothing is sent until you review and consent.
            {user ? "" : " Sign-in will not silently adopt this draft."}
          </p>
        </div>
      </div>
    </div>
  );
}
