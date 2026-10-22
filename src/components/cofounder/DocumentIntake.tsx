"use client";

import { useState } from "react";
import { api } from "@/lib/client/api";
import { actionErrorMessage } from "@/lib/client/asyncAction";
import {
  INTAKE_BOUNDARY_NOTE,
  INTAKE_FIELD_KEYS,
  INTAKE_FIELD_LABELS,
  type IntakeDraft,
  type IntakeFieldKey
} from "@/lib/cofounder/intake";
import type { DocumentPage, ExtractedSource } from "@/lib/cofounder/documents";
import type { DocumentFactCandidate } from "@/lib/cofounder/types";
import styles from "./companion.module.css";

export type IntakeDocument = {
  id: string;
  title: string;
  status: string;
  mime?: string;
};

type PreviewResponse = {
  document: IntakeDocument & { mime: string; source: string; createdAt: string };
  extracted: ExtractedSource;
};

export function DocumentIntake({
  documents,
  sourceDocumentIds,
  candidates,
  onChanged
}: {
  documents: IntakeDocument[];
  sourceDocumentIds: string[];
  candidates: DocumentFactCandidate[];
  onChanged: () => Promise<void>;
}) {
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [fieldKey, setFieldKey] = useState<IntakeFieldKey>("services");
  const [excerpt, setExcerpt] = useState("");
  const [proposedValue, setProposedValue] = useState("");
  const [draft, setDraft] = useState<IntakeDraft | null>(null);
  const [candidate, setCandidate] = useState<DocumentFactCandidate | null>(null);
  const [ownerEdited, setOwnerEdited] = useState(false);

  const currentPage = preview?.extracted.pages.find((page) => page.pageNumber === pageNumber) ?? null;
  const pending = candidates.filter((item) => item.status === "pending");

  async function upload(file: File) {
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = "";
      bytes.forEach((value) => {
        binary += String.fromCharCode(value);
      });
      const created = await api<{ document: IntakeDocument }>("/api/companion/documents", {
        method: "POST",
        body: JSON.stringify({
          title: file.name,
          mime: file.type || "application/octet-stream",
          bytesBase64: btoa(binary),
          kind: "document"
        })
      });
      setStatus(`${file.name} is stored. Select it as a Talk source before Aethelios can read it.`);
      await onChanged();
      if (created.document?.id) await openPreview(created.document.id);
    } catch (err) {
      setError(actionErrorMessage(err, "Upload failed."));
    } finally {
      setBusy(false);
    }
  }

  async function openPreview(documentId: string) {
    setBusy(true);
    setError("");
    setDraft(null);
    setCandidate(null);
    try {
      const data = await api<PreviewResponse>(`/api/companion/documents/${documentId}/preview`);
      setPreview(data);
      const first = data.extracted.pages[0];
      setPageNumber(first?.pageNumber ?? 1);
      setExcerpt("");
      setProposedValue("");
      setOwnerEdited(false);
    } catch (err) {
      setError(actionErrorMessage(err, "This document could not be opened."));
    } finally {
      setBusy(false);
    }
  }

  function selectPage(page: DocumentPage) {
    setPageNumber(page.pageNumber);
    setExcerpt(page.text.trim());
    setProposedValue(page.text.trim());
    setDraft(null);
    setCandidate(null);
    setOwnerEdited(false);
  }

  async function toggleSource(documentId: string, selected: boolean) {
    setBusy(true);
    setError("");
    try {
      const next = selected
        ? [...new Set([...sourceDocumentIds, documentId])]
        : sourceDocumentIds.filter((id) => id !== documentId);
      await api("/api/companion/workspace", {
        method: "PATCH",
        body: JSON.stringify({ sourceDocumentIds: next })
      });
      await onChanged();
    } catch (err) {
      setError(actionErrorMessage(err, "Source selection could not be saved."));
    } finally {
      setBusy(false);
    }
  }

  async function reviewChange() {
    if (!preview) return;
    setBusy(true);
    setError("");
    try {
      const data = await api<{ draft: IntakeDraft; candidate: DocumentFactCandidate }>(
        `/api/companion/documents/${preview.document.id}/intake`,
        {
          method: "POST",
          body: JSON.stringify({
            fieldKey,
            pageNumber,
            excerpt,
            proposedValue: proposedValue.trim() || excerpt
          })
        }
      );
      setDraft(data.draft);
      setCandidate(data.candidate);
      setProposedValue(data.draft.proposedValue);
      setOwnerEdited(data.draft.requiresOwnerEdit);
    } catch (err) {
      setError(actionErrorMessage(err, "The proposed change could not be prepared."));
    } finally {
      setBusy(false);
    }
  }

  async function resolveChange(action: "confirm" | "edit", conflictResolution?: "replace" | "keep") {
    if (!preview || !draft) return;
    setBusy(true);
    setError("");
    try {
      await api(`/api/companion/documents/${preview.document.id}/intake`, {
        method: "PUT",
        body: JSON.stringify({
          candidateId: candidate?.id,
          fieldKey: draft.fieldKey,
          pageNumber: draft.pageNumber,
          excerpt: draft.excerpt,
          proposedValue: proposedValue.trim() || draft.proposedValue,
          action,
          ownerEdited: ownerEdited || action === "edit",
          conflictResolution,
          selectSource: true
        })
      });
      setStatus(
        conflictResolution === "keep"
          ? `Kept the current ${draft.fieldLabel.toLowerCase()}. The new excerpt was not saved as a fact.`
          : `${draft.fieldLabel} is now confirmed from ${draft.title}, ${draft.pageLabel}.`
      );
      setDraft(null);
      setCandidate(null);
      await onChanged();
    } catch (err) {
      setError(actionErrorMessage(err, "The change was not confirmed."));
    } finally {
      setBusy(false);
    }
  }

  async function rejectCandidate(item: DocumentFactCandidate) {
    setBusy(true);
    setError("");
    try {
      await api(`/api/companion/documents/${item.documentId}/intake`, {
        method: "PATCH",
        body: JSON.stringify({ candidateId: item.id, action: "reject" })
      });
      if (candidate?.id === item.id) {
        setDraft(null);
        setCandidate(null);
      }
      await onChanged();
    } catch (err) {
      setError(actionErrorMessage(err, "The candidate could not be rejected."));
    } finally {
      setBusy(false);
    }
  }

  async function removeDocument(documentId: string) {
    setBusy(true);
    setError("");
    try {
      await api("/api/companion/documents", {
        method: "PATCH",
        body: JSON.stringify({ documentId })
      });
      if (preview?.document.id === documentId) {
        setPreview(null);
        setDraft(null);
        setCandidate(null);
      }
      await onChanged();
    } catch (err) {
      setError(actionErrorMessage(err, "The document could not be removed."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.intake}>
      <div>
        <p className={styles.label}>Source documents</p>
        <p className={styles.meta}>{INTAKE_BOUNDARY_NOTE}</p>
      </div>

      <label className={styles.composer} htmlFor="source-doc">
        <span className={styles.label}>Upload a text-based PDF or text file</span>
        <input
          id="source-doc"
          className={styles.file}
          type="file"
          accept="application/pdf,.pdf,text/*,.md,.markdown,.json,.csv,.txt,.html"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void upload(file);
          }}
        />
      </label>

      {documents.length === 0 ? <p className="muted">No source documents yet.</p> : null}
      <ul className={styles.docList}>
        {documents.map((doc) => {
          const selected = sourceDocumentIds.includes(doc.id);
          return (
            <li key={doc.id} className={styles.docRow}>
              <div>
                <p>{doc.title}</p>
                <p className={styles.meta}>
                  {doc.mime ?? "file"} · {doc.status}
                  {selected ? " · selected for Talk" : " · not a Talk source"}
                </p>
                <label className={styles.meta}>
                  <input
                    type="checkbox"
                    checked={selected}
                    disabled={busy}
                    onChange={(event) => void toggleSource(doc.id, event.target.checked)}
                  />{" "}
                  Use as Talk source
                </label>
              </div>
              <div className={styles.actions}>
                <button className="btn btn-ghost btn-compact" type="button" disabled={busy} onClick={() => void openPreview(doc.id)}>
                  Read
                </button>
                <button className="btn btn-ghost btn-compact" type="button" disabled={busy} onClick={() => void removeDocument(doc.id)}>
                  Remove
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {pending.length > 0 ? (
        <section>
          <p className={styles.label}>Unresolved document facts</p>
          {pending.map((item) => (
            <div key={item.id} className={styles.resultCard} style={{ marginBottom: 8 }}>
              <p>
                {item.fieldLabel}: {item.proposedValue}
              </p>
              <p className={styles.meta}>
                {item.documentTitle} · {item.pageLabel} · pending
              </p>
              <div className={styles.actions}>
                <button
                  className="btn btn-ghost btn-compact"
                  type="button"
                  disabled={busy}
                  onClick={() => void openPreview(item.documentId)}
                >
                  Review
                </button>
                <button className="btn btn-ghost btn-compact" type="button" disabled={busy} onClick={() => void rejectCandidate(item)}>
                  Reject
                </button>
              </div>
            </div>
          ))}
        </section>
      ) : null}

      {preview ? (
        <section className={styles.intakePreview} aria-labelledby="source-preview-title">
          <div>
            <p className={styles.meta}>Source preview</p>
            <h3 id="source-preview-title">{preview.document.title}</h3>
            {preview.extracted.available ? (
              <p className={styles.meta}>
                {preview.extracted.kind === "pdf_text" ? "Text-based PDF" : "Text file"} ·{" "}
                {preview.extracted.pages.length} {preview.extracted.pages.length === 1 ? "page" : "pages"}
                {preview.extracted.truncated ? " · longer text was shortened for this preview" : ""}
              </p>
            ) : (
              <p className="notice notice-warn">{preview.extracted.reason}</p>
            )}
          </div>

          {preview.extracted.pages.map((page) => (
            <article key={page.pageNumber} className={styles.intakePage} data-page={page.pageNumber}>
              <div className={styles.intakePageHead}>
                <p className={styles.meta}>{page.label}</p>
                <button className="btn btn-ghost btn-compact" type="button" onClick={() => selectPage(page)}>
                  Use this {preview.extracted.kind === "pdf_text" ? "page" : "part"}
                </button>
              </div>
              <pre className={styles.intakePageText}>{page.text || "(No extractable text on this page.)"}</pre>
            </article>
          ))}

          {preview.extracted.available ? (
            <div className={styles.composer}>
              <label className={styles.label} htmlFor="intake-field">
                Save this information as
              </label>
              <select
                id="intake-field"
                className={styles.select}
                value={fieldKey}
                onChange={(event) => setFieldKey(event.target.value as IntakeFieldKey)}
              >
                {INTAKE_FIELD_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {INTAKE_FIELD_LABELS[key]}
                  </option>
                ))}
              </select>
              <p className={styles.meta}>
                Citing {currentPage?.label ?? `page ${pageNumber}`}. Edit the excerpt if you only want part of the page.
              </p>
              <textarea
                className={styles.field}
                value={excerpt}
                onChange={(event) => {
                  setExcerpt(event.target.value);
                  setDraft(null);
                }}
                placeholder="Select text from the page, or edit the excerpt you want to save."
              />
              <label className={styles.label} htmlFor="intake-proposed">
                Proposed {INTAKE_FIELD_LABELS[fieldKey].toLowerCase()}
              </label>
              <textarea
                id="intake-proposed"
                className={styles.field}
                value={proposedValue}
                onChange={(event) => {
                  setProposedValue(event.target.value);
                  setDraft(null);
                  setOwnerEdited(true);
                }}
              />
              <button className="btn btn-gold" type="button" disabled={busy || excerpt.trim().length < 8} onClick={() => void reviewChange()}>
                Review this change
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {draft ? (
        <section className={styles.intakeReview} aria-labelledby="intake-review-title">
          <p className={styles.label}>Review before confirming</p>
          <h3 id="intake-review-title">
            {draft.fieldLabel} from {draft.title}
          </h3>
          <p className={styles.meta}>
            {draft.pageLabel} · {draft.provenance}
          </p>
          <blockquote className={styles.intakeQuote}>{draft.excerpt}</blockquote>
          <div className={styles.intakeCompare}>
            <div>
              <p className={styles.meta}>Existing {draft.fieldLabel.toLowerCase()}</p>
              <p>{draft.currentValue.trim() || "Nothing saved yet."}</p>
            </div>
            <div>
              <p className={styles.meta}>Proposed {draft.fieldLabel.toLowerCase()}</p>
              <p>{proposedValue.trim() || draft.proposedValue}</p>
            </div>
          </div>
          {draft.conflict ? (
            <p className="notice notice-warn">
              This field already has a different confirmed value. Replace it, or keep the current fact.
            </p>
          ) : null}
          {draft.requiresOwnerEdit ? (
            <label className={styles.meta}>
              <input type="checkbox" checked={ownerEdited} onChange={(event) => setOwnerEdited(event.target.checked)} />{" "}
              Save my wording as an owner edit. This is not claimed as source evidence.
            </label>
          ) : null}
          {draft.proposedTruncated ? <p className={styles.meta}>The saved field is limited to 4,000 characters.</p> : null}
          <div className={styles.actions}>
            {draft.conflict ? (
              <>
                <button className="btn btn-gold" type="button" disabled={busy} onClick={() => void resolveChange(ownerEdited ? "edit" : "confirm", "replace")}>
                  Replace current fact
                </button>
                <button className="btn btn-ghost" type="button" disabled={busy} onClick={() => void resolveChange("confirm", "keep")}>
                  Keep current fact
                </button>
              </>
            ) : (
              <button className="btn btn-gold" type="button" disabled={busy} onClick={() => void resolveChange(ownerEdited ? "edit" : "confirm")}>
                Confirm into business profile
              </button>
            )}
            <button
              className="btn btn-ghost"
              type="button"
              disabled={busy}
              onClick={() => {
                setDraft(null);
                setStatus("Left unresolved. The candidate stays pending.");
              }}
            >
              Leave unresolved
            </button>
            {candidate ? (
              <button className="btn btn-ghost" type="button" disabled={busy} onClick={() => void rejectCandidate(candidate)}>
                Reject
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      {status ? <p className="notice">{status}</p> : null}
      {error ? <p className="notice notice-warn">{error}</p> : null}
    </div>
  );
}
