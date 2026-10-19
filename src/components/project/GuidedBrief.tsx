"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FIELD_HINTS, FIELD_LABELS, applyClientValue, fieldsForStep, isBookingConnected } from "@/lib/brief";
import {
  createGuestDraft,
  markGuestRetained,
  readGuestDraft,
  writeGuestDraft
} from "@/lib/guest/draft";
import { CONSENT_TEXT } from "@/lib/copy";
import { AppLink } from "@/components/ui/AppLink";
import { LivingBrief } from "@/components/project/LivingBrief";
import { SaveStatusBar } from "@/components/status/SaveStatus";
import { api, ApiError } from "@/lib/client/api";
import { actionErrorMessage } from "@/lib/client/asyncAction";
import { ownerFence } from "@/lib/client/ownerFence";
import { readOwnerJson, writeOwnerJson } from "@/lib/client/ownerScope";
import { CoalescedSaveQueue, type SaveFailure, type SaveStatus } from "@/lib/client/saveQueue";
import { buildSubmitCommand, loadSubmitCommand, persistSubmitCommand } from "@/lib/client/submitCommand";
import { useSession } from "@/components/shell/SessionShell";
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

type ProjectResponse = {
  project: Project;
  suggestions: Suggestion[];
  messages: ChatMessage[];
};

type DraftRecovery = {
  brief: Brief;
  acknowledgedVersion: number;
  updatedAt: string;
  unconfirmed?: boolean;
};

function saveFailure(error: unknown): SaveFailure {
  if (error instanceof ApiError) {
    if (error.status === 409) {
      return {
        kind: "conflict",
        currentVersion: error.currentVersion,
        message: error.message
      };
    }
    if (error.status === 400 || error.status === 403) {
      return { kind: "rejected", message: error.message };
    }
  }
  return {
    kind: "uncertain",
    message: actionErrorMessage(error, "Save did not confirm. Retry the same edit.")
  };
}

export function GuidedBrief({
  projectId,
  createNew = false
}: {
  projectId?: string;
  createNew?: boolean;
}) {
  const router = useRouter();
  const { user, generation, loading } = useSession();
  const [step, setStep] = useState(1);
  const [pane, setPane] = useState<"edit" | "summary">("edit");
  const [brief, setBrief] = useState<Brief>(() => createGuestDraft().brief);
  const [guestId, setGuestId] = useState<string | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState("");
  const [consent, setConsent] = useState(false);
  const [consentVersion, setConsentVersion] = useState<number | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [chatPending, setChatPending] = useState(false);
  const [chatError, setChatError] = useState("");
  const [receipt, setReceipt] = useState<string | null>(null);
  const [saveTick, setSaveTick] = useState(0);
  const [saveStatus, setSaveStatus] = useState<SaveStatus | "guest">("guest");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [storageNote, setStorageNote] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");
  const [submitPending, setSubmitPending] = useState(false);
  const [creating, setCreating] = useState(false);
  const [aureliusNote, setAureliusNote] = useState("Checking assistant availability…");
  const queueRef = useRef<CoalescedSaveQueue<Brief> | null>(null);
  const creatingRef = useRef(false);
  const briefRef = useRef(brief);
  briefRef.current = brief;

  const attachQueue = useCallback((nextProject: Project, owner: User) => {
    queueRef.current?.subscribe(() => undefined);
    const queue = new CoalescedSaveQueue<Brief>(nextProject.version, async (payload, expectedVersion) => {
      try {
        const result = await api<{ project: Project }>(`/api/projects/${nextProject.id}`, {
          method: "PATCH",
          body: JSON.stringify({ brief: payload, expectedVersion })
        });
        if (!ownerFence.isCurrent(ownerFence.generation, owner.id)) {
          throw { kind: "uncertain", message: "Account changed before this save confirmed." } satisfies SaveFailure;
        }
        setProject(result.project);
        const stored = writeOwnerJson(
          owner.id,
          "draft",
          {
            brief: payload,
            acknowledgedVersion: result.project.version,
            updatedAt: new Date().toISOString()
          } satisfies DraftRecovery,
          nextProject.id
        );
        if (!stored.ok) {
          setStorageNote("Browser storage is unavailable. The server copy is saved; this device cannot keep a recovery draft.");
        }
        return { version: result.project.version };
      } catch (error) {
        throw saveFailure(error);
      }
    });
    const unsub = queue.subscribe(() => {
      setSaveTick((n) => n + 1);
      setSaveStatus(queue.status);
      setSaveMessage(queue.lastError);
    });
    queueRef.current = queue;
    setSaveStatus(queue.status);
    return unsub;
  }, []);

  useEffect(() => {
    if (loading) return;
    let unsub: (() => void) | undefined;
    const gen = generation;
    const ownerId = user?.id ?? null;

    void (async () => {
      setLoadError("");
      const config = await api<{ aurelius: { ready: boolean; unavailableReason?: string } }>("/api/config");
      if (!ownerFence.isCurrent(gen, ownerId)) return;
      setAureliusNote(
        config.aurelius.ready
          ? "Aurelius is configured for live replies."
          : "Aurelius is unavailable because live model access is not authorized. Continue with the structured brief. This is not a live AI reply."
      );

      if (projectId && user) {
        try {
          const view = await api<ProjectResponse>(`/api/projects/${projectId}`);
          if (!ownerFence.isCurrent(gen, ownerId)) return;
          setProject(view.project);
          setSuggestions(view.suggestions);
          setMessages(view.messages);
          const recovery = readOwnerJson<DraftRecovery>(user.id, "draft", projectId);
          const pendingCommand = loadSubmitCommand(user.id, projectId);
          if (pendingCommand) {
            setStatus("A previous send is still pending confirmation. Retry the same command — it will not create a second snapshot.");
          }
          if (recovery?.unconfirmed) {
            setBrief(recovery.brief);
            setSaveStatus("uncertain");
            setSaveMessage("This device has an unconfirmed draft. Save again to confirm.");
          } else {
            setBrief(view.project.brief);
          }
          unsub = attachQueue(view.project, user);
        } catch (error) {
          if (!ownerFence.isCurrent(gen, ownerId)) return;
          setLoadError(actionErrorMessage(error, "This commission could not be opened."));
        }
        return;
      }

      if (createNew && user && !creatingRef.current) {
        const lockKey = `atelier.newlock.${user.id}`;
        if (typeof window !== "undefined" && window.sessionStorage.getItem(lockKey) === "pending") {
          return;
        }
        creatingRef.current = true;
        setCreating(true);
        try {
          window.sessionStorage.setItem(lockKey, "pending");
          const created = await api<{ project: Project }>("/api/projects", {
            method: "POST",
            body: JSON.stringify({})
          });
          window.sessionStorage.removeItem(lockKey);
          if (!ownerFence.isCurrent(gen, ownerId)) return;
          router.replace(`/project/${created.project.id}`);
        } catch (error) {
          window.sessionStorage.removeItem(lockKey);
          if (!ownerFence.isCurrent(gen, ownerId)) return;
          setLoadError(actionErrorMessage(error, "A new commission could not be created."));
          creatingRef.current = false;
          setCreating(false);
        }
        return;
      }

      if (user && !projectId && !createNew) {
        const guest = readGuestDraft() ?? createGuestDraft();
        writeGuestDraft(guest);
        setGuestId(guest.draftId);
        setBrief(guest.brief);
        setProject(null);
        setMessages(
          guest.messages.map((item) => ({
            ...item,
            projectId: guest.draftId
          }))
        );
        setSaveStatus("guest");
        return;
      }

      const guest = readGuestDraft() ?? createGuestDraft();
      writeGuestDraft(guest);
      setGuestId(guest.draftId);
      setBrief(guest.brief);
      setProject(null);
      setMessages(
        guest.messages.map((item) => ({
          ...item,
          projectId: guest.draftId
        }))
      );
      setSaveStatus("guest");
    })();

    return () => {
      unsub?.();
    };
  }, [attachQueue, createNew, generation, loading, projectId, router, user]);

  useEffect(() => {
    if (project || !guestId) return;
    const guest = readGuestDraft();
    if (!guest) return;
    try {
      writeGuestDraft({
        ...guest,
        brief,
        draftId: guestId,
        messages: messages.map((m) => ({
          id: m.id,
          authorKind: m.authorKind,
          body: m.body,
          liveAi: m.liveAi,
          createdAt: m.createdAt
        }))
      });
      setStorageNote(null);
    } catch {
      setStorageNote("This browser blocked on-device storage. The fields on this screen are not saved yet.");
    }
  }, [brief, guestId, messages, project]);

  function persistRecovery(nextBrief: Brief) {
    if (!project || !user) return;
    const stored = writeOwnerJson(
      user.id,
      "draft",
      {
        brief: nextBrief,
        acknowledgedVersion: queueRef.current?.acknowledgedVersion ?? project.version,
        updatedAt: new Date().toISOString(),
        unconfirmed: true
      } satisfies DraftRecovery,
      project.id
    );
    if (!stored.ok) {
      setStorageNote("Browser storage is unavailable. Unconfirmed typing is only on this screen until a save succeeds.");
    }
  }

  function updateField(key: BriefFieldKey, value: string) {
    const next = applyClientValue(brief, key, value);
    setBrief(next);
    if (consentVersion !== null) {
      setConsent(false);
      setConsentVersion(null);
    }
    persistRecovery(next);
    queueRef.current?.enqueue(next);
    if (!project) setSaveStatus("guest");
  }

  async function reloadSaved() {
    if (!project) return;
    const view = await api<ProjectResponse>(`/api/projects/${project.id}`);
    setProject(view.project);
    setBrief(view.project.brief);
    setSuggestions(view.suggestions);
    setMessages(view.messages);
    attachQueue(view.project, user!);
    setStatus("Loaded the saved copy. Re-apply any typing you still need.");
  }

  async function sendChat() {
    const text = chatInput.trim();
    if (!text || chatPending) return;
    setChatPending(true);
    setChatError("");
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
      setChatInput("");
      setChatPending(false);
      return;
    }
    try {
      const result = await api<{ view: ProjectResponse; liveAi: boolean }>(`/api/projects/${project.id}/messages`, {
        method: "POST",
        body: JSON.stringify({ body: text })
      });
      setMessages(result.view.messages);
      setBrief(result.view.project.brief);
      setSuggestions(result.view.suggestions);
      setProject(result.view.project);
      setChatInput("");
    } catch (error) {
      setChatError(actionErrorMessage(error, "The message was not delivered. Your text is still here."));
    } finally {
      setChatPending(false);
    }
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
    if (!project || !user) {
      window.location.href = "/account?next=/account/adopt";
      return;
    }
    if (!consent || consentVersion === null) {
      setStatus("Explicit consent is required for the saved revision currently on review.");
      return;
    }
    const queue = queueRef.current;
    if (queue) await queue.flush();
    if (queue?.hasUnconfirmedEdits) {
      setStatus("Newer edits are not confirmed as saved. Wait for save, then review that revision before sending.");
      return;
    }
    const expectedVersion = queue?.acknowledgedVersion ?? project.version;
    if (consentVersion !== expectedVersion) {
      setConsent(false);
      setConsentVersion(null);
      setStatus("The brief changed after you consented. Review the saved revision and consent again.");
      return;
    }
    const existing = loadSubmitCommand(user.id, project.id);
    const command =
      existing ??
      buildSubmitCommand({
        idempotencyKey: crypto.randomUUID(),
        projectId: project.id,
        ownerId: user.id,
        expectedVersion,
        brief: briefRef.current,
        consentText: CONSENT_TEXT
      });
    const stored = persistSubmitCommand(command);
    if (!stored.ok) {
      setStorageNote("This send cannot be recovered after a reload because browser storage is unavailable. Keep this screen open until a receipt appears.");
    }
    if (submitPending) return;
    setSubmitPending(true);
    try {
      const result = await api<{ receipt: { receiptId: string } }>(`/api/projects/${project.id}/submit`, {
        method: "POST",
        body: JSON.stringify({
          consent: true,
          consentTextAcknowledged: true,
          idempotencyKey: command.idempotencyKey,
          expectedVersion: command.expectedVersion
        })
      });
      setReceipt(result.receipt.receiptId);
      if (guestId) {
        const guest = readGuestDraft();
        if (guest) markGuestRetained(guest, project.id);
      }
      window.location.href = `/workspace/${project.id}`;
    } catch (error) {
      setStatus(
        error instanceof ApiError
          ? error.message
          : "Submission is uncertain. Retry the same command — it will not create a second snapshot."
      );
    } finally {
      setSubmitPending(false);
    }
  }

  const visibleFields = useMemo(() => fieldsForStep(step, brief), [step, brief]);
  const queueStatus = queueRef.current?.status ?? saveStatus;
  void saveTick;

  if (loading) {
    return (
      <section className="container section">
        <p className="kicker">Project brief</p>
        <h1>Opening the workspace…</h1>
      </section>
    );
  }

  if (loadError) {
    return (
      <section className="container section">
        <h1>Commission unavailable</h1>
        <p className="notice notice-warn">{loadError}</p>
        <AppLink className="btn btn-gold" href="/workspace">
          Open workspace
        </AppLink>
      </section>
    );
  }

  if (creating) {
    return (
      <section className="container section">
        <p className="kicker">New commission</p>
        <h1>Opening a blank brief…</h1>
        <p className="muted">This is a new project, not the first commission on the account.</p>
      </section>
    );
  }

  return (
    <div className="container-wide">
      <div className="workspace-tabs" style={{ paddingTop: 16 }}>
        <button className="chip" type="button" aria-pressed={pane === "edit"} onClick={() => setPane("edit")}>
          Editing
        </button>
        <button className="chip" type="button" aria-pressed={pane === "summary"} onClick={() => setPane("summary")}>
          Summary
        </button>
      </div>
      <div className="workspace-shell">
        <nav className="surface-glass step-nav" aria-label="Brief steps">
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
          <SaveStatusBar
            status={project ? queueStatus : "guest"}
            message={saveMessage}
            storageNote={storageNote}
            onRetry={() => queueRef.current?.retry()}
            onReload={() => void reloadSaved()}
          />
          {user && !projectId && !createNew ? (
            <p className="notice" style={{ marginTop: 12 }}>
              This is a device draft. It does not open another commission on this account.{" "}
              <AppLink href="/workspace">Open workspace</AppLink> or{" "}
              <AppLink href="/project/new">start a new project</AppLink>.
            </p>
          ) : null}
        </nav>

        <section className={`surface-dense brief-stage ${pane === "edit" ? "" : "pane-hidden"}`}>
          <p className="step-progress-mobile tiny">
            Step {step} of 5 · {STEPS[step - 1]?.label}
          </p>
          <p className="kicker">{project ? "Authenticated brief" : "Saved on this device"}</p>
          {step < 5 ? (
            <>
              <h1 className="brief-heading">{FIELD_HINTS[visibleFields[0] ?? "vision"]}</h1>
              <p className="muted">
                Start with the idea. You can refine details as you go. Answers stay as you move between steps.
                Aurelius being unavailable does not block this brief.
              </p>
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
              <div className="row brief-actions">
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
                {chatError ? <p className="notice notice-warn">{chatError}</p> : null}
                <button className="btn btn-emerald" type="button" disabled={chatPending} onClick={() => void sendChat()}>
                  {chatPending ? "Sending…" : "Send"}
                </button>
              </div>
            </>
          ) : (
            <>
              <h1 className="brief-heading">Review before anything is sent.</h1>
              <p className="lede">
                Consent applies to the exact saved revision shown here. Later edits will not change a submitted
                snapshot. Guest drafts cannot be sent until you sign in, review, and adopt them.
              </p>
              <LivingBrief brief={brief} suggestions={suggestions} onResolve={project ? resolveSuggestion : undefined} />
              <label className="notice" style={{ display: "block", marginTop: 18 }}>
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setConsent(checked);
                    setConsentVersion(checked ? (queueRef.current?.acknowledgedVersion ?? project?.version ?? null) : null);
                  }}
                />{" "}
                {CONSENT_TEXT}
              </label>
              {status ? <p className="notice notice-warn">{status}</p> : null}
              {receipt ? <p className="notice">Receipt {receipt}</p> : null}
              <div className="row brief-actions">
                <button className="btn btn-ghost" type="button" onClick={() => setStep(4)}>
                  Back
                </button>
                <button
                  className="btn btn-gold"
                  type="button"
                  disabled={submitPending || (Boolean(project) && Boolean(queueRef.current?.hasUnconfirmedEdits))}
                  onClick={() => void submit()}
                >
                  {submitPending ? "Sending…" : project ? "Send to Neil" : "Sign in to send"}
                </button>
              </div>
            </>
          )}
        </section>

        <div className={pane === "summary" ? "" : "pane-hidden-mobile"}>
          <LivingBrief brief={brief} suggestions={suggestions} onResolve={project ? resolveSuggestion : undefined} />
          <p className="notice" style={{ marginTop: 12 }}>
            Client statements, optional suggestions, and unresolved details stay distinct. Nothing is sent until you
            review and consent.
            {user ? "" : " Sign-in will not silently adopt this draft."}
          </p>
        </div>
      </div>
    </div>
  );
}
