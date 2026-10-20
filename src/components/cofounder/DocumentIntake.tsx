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
  onChanged
}: {
  documents: IntakeDocument[];
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

  const currentPage = preview?.extracted.pages.find((page) => page.pageNumber === pageNumber) ?? null;

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
      setStatus(`${file.name} is stored in this workspace. Open it to read the pages.`);
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
    try {
      const data = await api<PreviewResponse>(`/api/companion/documents/${documentId}/preview`);
      setPreview(data);
      const first = data.extracted.pages[0];
      setPageNumber(first?.pageNumber ?? 1);
      setExcerpt("");
      setProposedValue("");
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
  }

  async function reviewChange() {
    if (!preview) return;
    setBusy(true);
    setError("");
    try {
      const data = await api<{ draft: IntakeDraft }>(`/api/companion/documents/${preview.document.id}/intake`, {
        method: "POST",
        body: JSON.stringify({
          fieldKey,
          pageNumber,
          excerpt,
          proposedValue: proposedValue.trim() || excerpt
        })
      });
      setDraft(data.draft);
      setProposedValue(data.draft.proposedValue);
    } catch (err) {
      setError(actionErrorMessage(err, "The proposed change could not be prepared."));
    } finally {
      setBusy(false);
    }
  }

  async function confirmChange() {
    if (!preview || !draft) return;
    setBusy(true);
    setError("");
    try {
      await api(`/api/companion/documents/${preview.document.id}/intake`, {
        method: "PUT",
        body: JSON.stringify({
          fieldKey: draft.fieldKey,
          pageNumber: draft.pageNumber,
          excerpt: draft.excerpt,
          proposedValue: proposedValue.trim() || draft.proposedValue,
          confirm: true
        })
      });
      setStatus(`${draft.fieldLabel} is now confirmed from ${draft.title}, ${draft.pageLabel}.`);
      setDraft(null);
      await onChanged();
    } catch (err) {
      setError(actionErrorMessage(err, "The change was not confirmed."));
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
      }
      await onChanged();
    } catch (err) {
      setError(actionErrorMessage(err, "The document could not be removed."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className={`surface-dimensional ${styles.card} ${styles.intake}`}>
      <div>
        <p className="kicker">Document intake</p>
        <h2 className={styles.intakeTitle}>Bring existing materials into this business</h2>
        <p className="lede">
          Upload a service menu, product sheet, brand guide, or other text source. Read it here with page
          references, choose what is accurate, and confirm it once.
        </p>
        <p className="tiny">{INTAKE_BOUNDARY_NOTE}</p>
      </div>

      <label className={styles.composer} htmlFor="source-doc">
        <span className="tiny">Upload a text-based PDF or text file</span>
        <input
          id="source-doc"
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
        {documents.map((doc) => (
          <li key={doc.id} className={styles.docRow}>
            <div>
              <p>{doc.title}</p>
              <p className="tiny">
                {doc.mime ?? "file"} · {doc.status}
              </p>
            </div>
            <div className={styles.actions}>
              <button className="btn btn-ghost" type="button" disabled={busy} onClick={() => void openPreview(doc.id)}>
                Read
              </button>
              <button className="btn btn-ghost" type="button" disabled={busy} onClick={() => void removeDocument(doc.id)}>
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>

      {preview ? (
        <section className={styles.preview} aria-labelledby="source-preview-title">
          <div>
            <p className="tiny">Source preview</p>
            <h3 id="source-preview-title">{preview.document.title}</h3>
            {preview.extracted.available ? (
              <p className="tiny">
                {preview.extracted.kind === "pdf_text" ? "Text-based PDF" : "Text file"} ·{" "}
                {preview.extracted.pages.length} {preview.extracted.pages.length === 1 ? "page" : "pages"}
                {preview.extracted.truncated ? " · longer text was shortened for this preview" : ""}
              </p>
            ) : (
              <p className="notice notice-warn">{preview.extracted.reason}</p>
            )}
          </div>

          {preview.extracted.pages.map((page) => (
            <article key={page.pageNumber} className={styles.page} data-page={page.pageNumber}>
              <div className={styles.pageHead}>
                <p className="tiny">{page.label}</p>
                <button className="btn btn-ghost btn-compact" type="button" onClick={() => selectPage(page)}>
                  Use this {preview.extracted.kind === "pdf_text" ? "page" : "part"}
                </button>
              </div>
              <pre className={styles.pageText}>{page.text || "(No extractable text on this page.)"}</pre>
            </article>
          ))}

          {preview.extracted.available ? (
            <div className={styles.composer}>
              <label className="tiny" htmlFor="intake-field">
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
              <p className="tiny">
                Citing {currentPage?.label ?? `page ${pageNumber}`}. Edit the excerpt if you only want part of the
                page.
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
              <label className="tiny" htmlFor="intake-proposed">
                Proposed {INTAKE_FIELD_LABELS[fieldKey].toLowerCase()}
              </label>
              <textarea
                id="intake-proposed"
                className={styles.field}
                value={proposedValue}
                onChange={(event) => {
                  setProposedValue(event.target.value);
                  setDraft(null);
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
        <section className={styles.review} aria-labelledby="intake-review-title">
          <p className="kicker">Review before confirming</p>
          <h3 id="intake-review-title">
            {draft.fieldLabel} from {draft.title}
          </h3>
          <p className="tiny">
            {draft.pageLabel} · {draft.provenance}
          </p>
          <blockquote className={styles.quote}>{draft.excerpt}</blockquote>
          <div className={styles.compare}>
            <div>
              <p className="tiny">Existing {draft.fieldLabel.toLowerCase()}</p>
              <p>{draft.currentValue.trim() || "Nothing saved yet."}</p>
            </div>
            <div>
              <p className="tiny">Proposed {draft.fieldLabel.toLowerCase()}</p>
              <p>{proposedValue.trim() || draft.proposedValue}</p>
            </div>
          </div>
          {draft.proposedTruncated ? (
            <p className="tiny">The saved field is limited to 4,000 characters.</p>
          ) : null}
          <div className={styles.actions}>
            <button className="btn btn-gold" type="button" disabled={busy} onClick={() => void confirmChange()}>
              Confirm into business profile
            </button>
            <button className="btn btn-ghost" type="button" disabled={busy} onClick={() => setDraft(null)}>
              Go back
            </button>
          </div>
        </section>
      ) : null}

      {status ? <p className="notice">{status}</p> : null}
      {error ? <p className="notice notice-warn">{error}</p> : null}
    </article>
  );
}
