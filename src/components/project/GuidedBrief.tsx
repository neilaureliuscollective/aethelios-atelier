"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FIELD_HINTS, FIELD_LABELS, applyClientValue, fieldsForStep, isBookingConnected } from "@/lib/brief";
import {
  COMMISSION_TYPE_OPTIONS,
  HISTORICAL_BOOKING_PROJECT_TYPE,
  historicalProjectTypeNote
} from "@/lib/serviceCategories";
import {
  createGuestDraft,
  markGuestRetained,
  readGuestDraft,
  writeGuestDraft
} from "@/lib/guest/draft";
import { CONSENT_TEXT, INTELLIGENCE_DISPLAY_NAME, displayIntelligenceLabel } from "@/lib/copy";
import { AppLink } from "@/components/ui/AppLink";
import { DraftCompare } from "@/components/project/DraftCompare";
import { DiscoveryImport } from "@/components/project/DiscoveryImport";
import { LivingBrief } from "@/components/project/LivingBrief";
import { SaveStatusBar } from "@/components/status/SaveStatus";
import { api, ApiError } from "@/lib/client/api";
import { actionErrorMessage } from "@/lib/client/asyncAction";
import {
  DraftSession,
  acknowledgeStoredRecovery,
  loadDraftRecovery,
  type DraftSessionState
} from "@/lib/client/draftSession";
import { identitiesMatch, identityFor } from "@/lib/client/operationIdentity";
import { ownerFence } from "@/lib/client/ownerFence";
import { CoalescedSaveQueue, type SaveFailure, type SaveStatus } from "@/lib/client/saveQueue";
import {
  archiveSubmitCommand,
  buildSubmitCommand,
  classifySubmitFailure,
  loadConfirmedSubmit,
  loadSubmitCommand,
  persistSubmitCommand,
  rejectSubmitCommand,
  type PendingSubmitCommand
} from "@/lib/client/submitCommand";
import { canCommitSubmitReadback, classifyVerificationFailure } from "@/lib/client/submitReadback";
import { useSession } from "@/components/shell/SessionShell";
import type { Brief, BriefFieldKey, ChatMessage, ClientProjectView, Project, Suggestion, User } from "@/lib/types";

const STEPS = [
  { n: 1, label: "Vision" },
  { n: 2, label: "Audience" },
  { n: 3, label: "References" },
  { n: 4, label: "Scope" },
  { n: 5, label: "Review" }
];

const TYPE_OPTIONS = COMMISSION_TYPE_OPTIONS;

type ProjectResponse = {
  project: Project;
  suggestions: Suggestion[];
  messages: ChatMessage[];
};

function saveFailure(error: unknown): SaveFailure {
  if (error instanceof ApiError) {
    if (error.status === 409) {
      return {
        kind: "conflict",
        currentVersion: error.currentVersion,
        serverBrief: error.currentBrief,
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

function noteStorage(result: { ok: boolean } | undefined, fallback: string) {
  return result && !result.ok ? fallback : null;
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
  const [guestBrief, setGuestBrief] = useState<Brief>(() => createGuestDraft().brief);
  const [draftSnap, setDraftSnap] = useState<DraftSessionState | null>(null);
  const [guestId, setGuestId] = useState<string | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState("");
  const [guestConsent, setGuestConsent] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatPending, setChatPending] = useState(false);
  const [chatError, setChatError] = useState("");
  const [receipt, setReceipt] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [storageNote, setStorageNote] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");
  const [submitPending, setSubmitPending] = useState(false);
  const [creating, setCreating] = useState(false);
  const [assistantNote, setAssistantNote] = useState("Checking assistant availability…");
  const [pendingCommand, setPendingCommand] = useState<PendingSubmitCommand | null>(null);
  const [confirmedCommand, setConfirmedCommand] = useState<PendingSubmitCommand | null>(null);
  const queueRef = useRef<CoalescedSaveQueue<Brief> | null>(null);
  const sessionRef = useRef<DraftSession | null>(null);
  const creatingRef = useRef(false);
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const loadSeqRef = useRef(0);
  const submitSeqRef = useRef(0);

  const brief = draftSnap?.brief ?? guestBrief;
  const consent = draftSnap ? draftSnap.consent : guestConsent;
  const saveStatus: SaveStatus | "guest" = project ? (draftSnap?.status ?? "unsaved") : "guest";

  const bindSession = useCallback((session: DraftSession) => {
    sessionRef.current?.dispose();
    sessionRef.current = session;
    setDraftSnap(session.snapshot());
    return session.subscribe(() => setDraftSnap(session.snapshot()));
  }, []);

  const attachQueue = useCallback((nextProject: Project, owner: User, session: DraftSession) => {
    queueRef.current?.dispose();
    const queue = new CoalescedSaveQueue<Brief>(
      session.acknowledgedVersion,
      async (payload, expectedVersion) => {
        const captured = identityFor(owner.id, nextProject.id, ownerFence);
        sessionRef.current?.markSaving(captured);
        try {
          const result = await api<{ project: Project }>(`/api/projects/${nextProject.id}`, {
            method: "PATCH",
            body: JSON.stringify({ brief: payload, expectedVersion })
          });
          if (!ownerFence.allowsStorageWrite(captured)) {
            return { version: result.project.version };
          }
          acknowledgeStoredRecovery(captured, payload, result.project.version);
          const current = sessionRef.current;
          if (current && !current.disposed) {
            current.acknowledge(payload, result.project.version, captured);
          }
          if (current && !current.disposed && identitiesMatch(captured, current.identity)) {
            setProject(result.project);
            setStorageNote(null);
          }
          return { version: result.project.version };
        } catch (error) {
          const failure = saveFailure(error);
          const current = sessionRef.current;
          if (
            current &&
            !current.disposed &&
            identitiesMatch(captured, current.identity) &&
            ownerFence.allowsStorageWrite(captured)
          ) {
            if (failure.kind === "conflict") {
              const serverBrief = (failure.serverBrief as Brief | undefined) ?? current.acknowledgedBrief;
              current.enterConflict(serverBrief, failure.currentVersion ?? current.acknowledgedVersion, captured);
              queueRef.current?.setReviewHold(true);
            } else {
              current.markUncertain(failure.message, captured);
            }
          }
          throw failure;
        }
      },
      450,
      undefined,
      session.status === "saved" ? "saved" : "unsaved"
    );
    const unsub = queue.subscribe(() => {
      setSaveMessage(queue.lastError);
    });
    queueRef.current = queue;
    queue.setReviewHold(session.reviewRequired);
    return () => {
      unsub();
      queue.dispose();
    };
  }, []);

  useEffect(() => {
    if (loading) return;
    let unsubQueue: (() => void) | undefined;
    let unsubSession: (() => void) | undefined;
    const loadToken = ++loadSeqRef.current;
    const gen = generation;
    const ownerId = user?.id ?? null;
    const capturedProjectId = projectId ?? null;

    const loadIsActive = () =>
      loadSeqRef.current === loadToken &&
      ownerFence.isCurrent(gen, ownerId) &&
      (projectId ?? null) === capturedProjectId;

    void (async () => {
      setLoadError("");
      const config = await api<{ aurelius: { ready: boolean; unavailableReason?: string } }>("/api/config");
      if (!loadIsActive()) return;
      setAssistantNote(
        config.aurelius.ready
          ? `${INTELLIGENCE_DISPLAY_NAME} is configured for live replies.`
          : `${INTELLIGENCE_DISPLAY_NAME} is unavailable because live model access is not authorized. Continue with the structured brief. This is not a live AI reply.`
      );

      if (projectId && user) {
        try {
          const view = await api<ProjectResponse>(`/api/projects/${projectId}`);
          if (!loadIsActive()) return;
          setProject(view.project);
          setSuggestions(view.suggestions);
          setMessages(view.messages);
          const recovery = loadDraftRecovery(user.id, projectId);
          const pending = loadSubmitCommand(user.id, projectId);
          const confirmed = loadConfirmedSubmit(user.id, projectId);
          setPendingCommand(pending);
          setConfirmedCommand(confirmed);
          if (pending) {
            setStatus("An earlier send is still unconfirmed. Retry that exact request — it will not create a second snapshot.");
          }
          const identity = identityFor(user.id, view.project.id, ownerFence);
          if (!loadIsActive()) return;
          const session = new DraftSession(identity, view.project.brief, view.project.version, recovery);
          unsubSession = bindSession(session);
          unsubQueue = attachQueue(view.project, user, session);
          if (session.recoveryOpen) {
            queueRef.current?.setReviewHold(true);
            setSaveMessage("This device still has unconfirmed text. It is not saved until the server acknowledges this exact wording.");
          }
        } catch (error) {
          if (!loadIsActive()) return;
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
          if (!loadIsActive()) return;
          router.replace(`/project/${created.project.id}`);
        } catch (error) {
          window.sessionStorage.removeItem(lockKey);
          if (!loadIsActive()) return;
          setLoadError(actionErrorMessage(error, "A new commission could not be created."));
          creatingRef.current = false;
          setCreating(false);
        }
        return;
      }

      if (!loadIsActive()) return;
      const guest = readGuestDraft() ?? createGuestDraft();
      writeGuestDraft(guest);
      setGuestId(guest.draftId);
      setGuestBrief(guest.brief);
      setProject(null);
      setDraftSnap(null);
      setMessages(
        guest.messages.map((item) => ({
          ...item,
          projectId: guest.draftId
        }))
      );
    })();

    return () => {
      if (loadSeqRef.current === loadToken) {
        loadSeqRef.current += 1;
      }
      submitSeqRef.current += 1;
      setSubmitPending(false);
      unsubQueue?.();
      unsubSession?.();
      queueRef.current?.dispose();
      sessionRef.current?.dispose();
      queueRef.current = null;
      sessionRef.current = null;
    };
  }, [attachQueue, bindSession, createNew, generation, loading, projectId, router, user]);

  useEffect(() => {
    if (project || !guestId) return;
    const guest = readGuestDraft();
    if (!guest) return;
    try {
      writeGuestDraft({
        ...guest,
        brief: guestBrief,
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
  }, [guestBrief, guestId, messages, project]);

  function applyImportedBrief(next: Brief) {
    const session = sessionRef.current;
    if (session && project) {
      const stored = session.applyLocalEdit(next);
      setStorageNote(
        noteStorage(
          stored,
          "Browser storage is unavailable. Unconfirmed typing is only on this screen until a save succeeds."
        )
      );
      if (session.reviewRequired) {
        queueRef.current?.setReviewHold(true);
        queueRef.current?.enqueue(next);
        setStatus("Prepared direction was added locally. Resolve recovery before treating it as saved.");
        return;
      }
      queueRef.current?.enqueue(next);
      setStatus("Prepared direction added to this brief. Consent again before sending. Nothing has been submitted.");
      return;
    }
    setGuestBrief(next);
    setGuestConsent(false);
    setStatus("Prepared direction added to this device draft. It has not been sent or added to an account.");
  }

  function updateField(key: BriefFieldKey, value: string) {
    const next = applyClientValue(brief, key, value);
    const session = sessionRef.current;
    if (session && project) {
      const stored = session.applyLocalEdit(next);
      setStorageNote(
        noteStorage(
          stored,
          "Browser storage is unavailable. Unconfirmed typing is only on this screen until a save succeeds."
        )
      );
      if (session.reviewRequired) {
        queueRef.current?.setReviewHold(true);
        queueRef.current?.enqueue(next);
        return;
      }
      queueRef.current?.enqueue(next);
      return;
    }
    setGuestBrief(next);
    setGuestConsent(false);
  }

  function focusEditor() {
    window.requestAnimationFrame(() => {
      editorRef.current?.focus();
    });
  }

  function keepLocalCopy() {
    const session = sessionRef.current;
    const queue = queueRef.current;
    if (!session || !queue) return;
    const serverVersion = session.keepLocalAfterCompare();
    queue.setReviewHold(false);
    queue.enqueue(session.localBrief);
    queue.resumeAfterReconcile(serverVersion);
    setStatus("This device copy is kept. It stays unsaved until the server acknowledges this exact wording.");
    focusEditor();
  }

  function takeSavedCopy() {
    const session = sessionRef.current;
    const queue = queueRef.current;
    if (!session || !queue) return;
    session.takeServerCopy();
    queue.adoptAcknowledged(session.acknowledgedVersion);
    setStatus("The saved copy is now the working draft. Review it before sending.");
    focusEditor();
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
        body: `${INTELLIGENCE_DISPLAY_NAME} is not live on a guest draft. Continue the structured brief, then sign in if you want a saved conversation. This is not a live AI reply.`,
        liveAi: false,
        createdAt: new Date().toISOString()
      };
      setMessages((current) => [...current, local, notice]);
      setChatInput("");
      setChatPending(false);
      return;
    }
    const session = sessionRef.current;
    const captured = session?.identity ?? null;
    try {
      const result = await api<{ view: ProjectResponse; liveAi: boolean }>(`/api/projects/${project.id}/messages`, {
        method: "POST",
        body: JSON.stringify({ body: text })
      });
      if (
        !captured ||
        !sessionRef.current ||
        !identitiesMatch(captured, sessionRef.current.identity) ||
        !ownerFence.allowsStorageWrite(captured)
      ) {
        return;
      }
      setMessages(result.view.messages);
      setSuggestions(result.view.suggestions);
      const applied = sessionRef.current.syncRemoteProject(
        result.view.project.brief,
        result.view.project.version,
        captured
      );
      if (applied === "needs_review") {
        queueRef.current?.setReviewHold(true);
        setStatus("A delayed response does not match the copy already saved here. Your current text is still here. Review both before replacing either.");
      }
      setChatInput("");
    } catch (error) {
      if (captured && identitiesMatch(captured, sessionRef.current?.identity ?? null)) {
        setChatError(actionErrorMessage(error, "The message was not delivered. Your text is still here."));
      }
    } finally {
      setChatPending(false);
    }
  }

  async function resolveSuggestion(id: string, action: "accept" | "reject") {
    if (!project) return;
    const session = sessionRef.current;
    const captured = session?.identity ?? null;
    const result = await api<{ view: ProjectResponse }>(`/api/projects/${project.id}/suggestions/${id}`, {
      method: "POST",
      body: JSON.stringify({ action })
    });
    if (
      !captured ||
      !sessionRef.current ||
      !identitiesMatch(captured, sessionRef.current.identity) ||
      !ownerFence.allowsStorageWrite(captured)
    ) {
      return;
    }
    setSuggestions(result.view.suggestions);
    const applied = sessionRef.current.applyAcceptedBrief(
      result.view.project.brief,
      result.view.project.version,
      captured
    );
    if (applied === "applied") {
      queueRef.current?.adoptAcknowledged(result.view.project.version);
      setProject(result.view.project);
    } else if (applied === "needs_review") {
      queueRef.current?.setReviewHold(true);
      setStatus("The suggestion was stored, but your newer typing is still here. Review both copies before replacing either.");
    }
  }

  async function sendCommand(command: PendingSubmitCommand) {
    if (!project || !user) return;
    const captured = identityFor(user.id, project.id, ownerFence);
    if (!ownerFence.allowsStorageWrite(captured)) return;
    const stored = persistSubmitCommand(command);
    if (!stored.ok) {
      setStorageNote(
        "This send cannot be recovered after a reload because browser storage is unavailable. Keep this screen open until a receipt appears."
      );
    }
    if (submitPending) return;
    const submitToken = ++submitSeqRef.current;
    setSubmitPending(true);
    const stillThisOperation = () => {
      const current = sessionRef.current;
      return canCommitSubmitReadback({
        captured,
        current: current?.identity ?? null,
        fence: ownerFence,
        disposed: Boolean(!current || current.disposed),
        submitToken,
        currentToken: submitSeqRef.current
      });
    };

    try {
      const result = await api<{ receipt: { receiptId: string; submissionId: string; version: number } }>(
        `/api/projects/${command.projectId}/submit`,
        {
          method: "POST",
          body: JSON.stringify({
            consent: true,
            consentTextAcknowledged: true,
            idempotencyKey: command.idempotencyKey,
            expectedVersion: command.expectedVersion
          })
        }
      );
      if (!stillThisOperation()) return;
      let view: ClientProjectView;
      try {
        view = await api<ClientProjectView>(`/api/projects/${command.projectId}`);
      } catch (verifyError) {
        classifyVerificationFailure(
          verifyError instanceof ApiError
            ? { status: verifyError.status, code: verifyError.code, message: verifyError.message }
            : { message: verifyError instanceof Error ? verifyError.message : "network" }
        );
        if (!stillThisOperation()) return;
        persistSubmitCommand(command);
        setPendingCommand(command);
        setStatus(
          "Submission is unverified. The exact request is still pending. Retry the same command — it will not create a second snapshot."
        );
        return;
      }
      if (!stillThisOperation()) return;
      const verified = view.submission?.receiptId === result.receipt.receiptId;
      if (!verified) {
        persistSubmitCommand(command);
        setPendingCommand(command);
        setStatus("Submission is uncertain. Retry the same command — it will not create a second snapshot.");
        return;
      }
      if (!stillThisOperation()) return;
      archiveSubmitCommand(command, {
        receiptId: result.receipt.receiptId,
        submissionId: result.receipt.submissionId
      });
      if (!stillThisOperation()) return;
      setPendingCommand(null);
      setConfirmedCommand(loadConfirmedSubmit(captured.ownerId, captured.projectId));
      setReceipt(result.receipt.receiptId);
      sessionRef.current?.invalidateConsent();
      if (guestId) {
        const guest = readGuestDraft();
        if (guest) markGuestRetained(guest, command.projectId);
      }
      window.location.href = `/workspace/${command.projectId}`;
    } catch (error) {
      const outcome = classifySubmitFailure(
        error instanceof ApiError
          ? { status: error.status, code: error.code, message: error.message }
          : { message: error instanceof Error ? error.message : "network" },
        "post"
      );
      if (!stillThisOperation()) return;
      if (outcome === "rejected") {
        rejectSubmitCommand(
          command,
          error instanceof ApiError ? error.message : "The server rejected this send."
        );
        if (!stillThisOperation()) return;
        setPendingCommand(null);
        sessionRef.current?.invalidateConsent();
        try {
          const view = await api<ClientProjectView>(`/api/projects/${command.projectId}`);
          if (stillThisOperation() && sessionRef.current) {
            const applied = sessionRef.current.syncRemoteProject(
              view.project.brief,
              view.project.version,
              captured
            );
            if (applied === "needs_review") {
              queueRef.current?.setReviewHold(true);
            } else {
              queueRef.current?.adoptAcknowledged(view.project.version);
              setProject(view.project);
            }
          }
        } catch {
          /* correction can still proceed from the visible draft */
        }
        setStatus(
          `${error instanceof ApiError ? error.message : "This send was rejected."} Correct the brief, review the saved revision, and consent again. The previous key will not be reused.`
        );
      } else {
        if (!stillThisOperation()) return;
        setPendingCommand(command);
        setStatus(
          error instanceof ApiError
            ? error.message
            : "Submission is uncertain. Retry the same command — it will not create a second snapshot."
        );
      }
    } finally {
      if (submitSeqRef.current === submitToken) {
        setSubmitPending(false);
      }
    }
  }

  async function retryPending() {
    if (!pendingCommand) return;
    await sendCommand(pendingCommand);
  }

  async function submitReviewedRevision() {
    if (!project || !user) {
      window.location.href = "/account?next=/account/adopt";
      return;
    }
    const session = sessionRef.current;
    if (!session) return;
    if (!session.consent || session.consentVersion === null) {
      setStatus("Explicit consent is required for the saved revision currently on review.");
      return;
    }
    const queue = queueRef.current;
    if (queue) await queue.flush();
    if (queue?.hasUnconfirmedEdits || session.isUnconfirmed) {
      setStatus("Newer edits are not confirmed as saved. Wait for save, then review that revision before sending.");
      return;
    }
    const expectedVersion = session.acknowledgedVersion;
    if (session.consentVersion !== expectedVersion) {
      session.setConsent(false);
      setStatus("The brief changed after you consented. Review the saved revision and consent again.");
      return;
    }
    if (pendingCommand) {
      setStatus("An earlier send is still unconfirmed. Retry that exact request before sending a new revision.");
      return;
    }
    const command = buildSubmitCommand({
      idempotencyKey: crypto.randomUUID(),
      projectId: project.id,
      ownerId: user.id,
      expectedVersion,
      brief: session.localBrief,
      consentText: CONSENT_TEXT
    });
    await sendCommand(command);
  }

  const visibleFields = useMemo(() => fieldsForStep(step, brief), [step, brief]);
  const compareAgainst = draftSnap?.serverBrief;
  const comparing = Boolean(draftSnap && (draftSnap.recoveryOpen || draftSnap.conflictOpen) && compareAgainst);

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
            status={saveStatus}
            message={draftSnap?.lastError ?? saveMessage}
            storageNote={storageNote}
            onRetry={() => queueRef.current?.retry()}
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
          {comparing && compareAgainst && draftSnap ? (
            <DraftCompare
              title={draftSnap.conflictOpen ? "A newer saved copy exists" : "This device has unconfirmed text"}
              explanation={
                draftSnap.conflictOpen
                  ? "Your current wording was not overwritten. Compare it with the saved copy, then choose which text to keep."
                  : "The text on this device is not saved yet. It will stay unsaved until the server acknowledges this exact wording."
              }
              local={draftSnap.brief}
              server={compareAgainst}
              onKeepLocal={keepLocalCopy}
              onTakeServer={takeSavedCopy}
            />
          ) : null}
          <p className="kicker">{project ? "Authenticated brief" : "Saved on this device"}</p>
          <DiscoveryImport
            brief={brief}
            revision={project ? (draftSnap?.acknowledgedVersion ?? project.version) : null}
            ownerId={user?.id ?? null}
            projectId={project?.id ?? null}
            blocked={Boolean(comparing)}
            onApply={applyImportedBrief}
          />
          {step < 5 ? (
            <>
              <h1 className="brief-heading">{FIELD_HINTS[visibleFields[0] ?? "vision"]}</h1>
              <p className="muted">
                Start with the idea. You can refine details as you go. Answers stay as you move between steps.
                {INTELLIGENCE_DISPLAY_NAME} being unavailable does not block this brief.
              </p>
              {visibleFields.map((key, index) => (
                <div key={key} style={{ marginTop: 18 }}>
                  <label>
                    <span className="lbl" id={key === "projectType" ? "project-type-label" : undefined}>
                      {FIELD_LABELS[key]}
                    </span>
                    {key === "projectType" ? (
                      <div className="chips" role="group" aria-labelledby="project-type-label">
                        {brief.projectType.value === HISTORICAL_BOOKING_PROJECT_TYPE ? (
                          <span className="chip chip-saved" aria-pressed="true">
                            Saved as booking-connected website
                          </span>
                        ) : null}
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
                        ref={index === 0 ? editorRef : undefined}
                        value={brief[key].value}
                        onChange={(event) => updateField(key, event.target.value)}
                        placeholder={FIELD_HINTS[key]}
                      />
                    )}
                  </label>
                </div>
              ))}
              {historicalProjectTypeNote(brief.projectType.value) ? (
                <p className="notice">{historicalProjectTypeNote(brief.projectType.value)}</p>
              ) : null}
              {step === 4 && isBookingConnected(brief) ? (
                <p className="notice">
                  Custom apps and platforms may later link to the booking destination you already use. That
                  does not build a scheduler or move payments into Atelier.
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
                <p className="notice">{assistantNote}</p>
                {messages.map((message) => (
                  <div key={message.id} className={`bubble bubble-${message.authorKind}`}>
                    <p className="tiny">
                      {message.authorKind === "client"
                        ? "You"
                        : message.liveAi
                          ? INTELLIGENCE_DISPLAY_NAME
                          : "System — not live AI"}
                    </p>
                    <p>{displayIntelligenceLabel(message.body)}</p>
                  </div>
                ))}
                <label>
                  <span className="lbl">Ask {INTELLIGENCE_DISPLAY_NAME}, or continue the form</span>
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
                    const session = sessionRef.current;
                    if (session) {
                      const ok = session.setConsent(checked);
                      if (checked && !ok) {
                        setStatus("Save and review the current revision before consenting. Unconfirmed text is not ready to send.");
                      }
                      return;
                    }
                    setGuestConsent(checked);
                  }}
                />{" "}
                {CONSENT_TEXT}
              </label>
              {status ? <p className="notice notice-warn">{status}</p> : null}
              {receipt ? (
                <article className="receipt-card surface-glass">
                  <p className="tiny">Confirmed receipt</p>
                  <p>Receipt {receipt} is stored. This is a request for review, not acceptance.</p>
                </article>
              ) : null}
              {confirmedCommand?.receiptId && !receipt ? (
                <article className="receipt-card surface-glass">
                  <p className="tiny">Confirmed receipt</p>
                  <p>Receipt {confirmedCommand.receiptId} is already stored for an earlier revision.</p>
                  <AppLink href={`/workspace/${project?.id ?? ""}`}>View receipt</AppLink>
                </article>
              ) : null}
              <div className="row brief-actions">
                <button className="btn btn-ghost" type="button" onClick={() => setStep(4)}>
                  Edit the current working draft
                </button>
                {pendingCommand ? (
                  <button className="btn btn-gold" type="button" disabled={submitPending} onClick={() => void retryPending()}>
                    {submitPending ? "Retrying…" : "Retry earlier send"}
                  </button>
                ) : (
                  <button
                    className="btn btn-gold"
                    type="button"
                    disabled={
                      submitPending ||
                      (Boolean(project) && (Boolean(queueRef.current?.hasUnconfirmedEdits) || Boolean(draftSnap?.status && draftSnap.status !== "saved")))
                    }
                    onClick={() => void submitReviewedRevision()}
                  >
                    {submitPending
                      ? "Sending…"
                      : project
                        ? confirmedCommand
                          ? "Send this newly reviewed revision"
                          : "Send to Neil"
                        : "Sign in to send"}
                  </button>
                )}
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
