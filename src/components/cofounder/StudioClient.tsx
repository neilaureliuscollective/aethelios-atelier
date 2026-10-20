"use client";

import { useEffect, useMemo, useState } from "react";
import { CompanionShell } from "@/components/cofounder/CompanionShell";
import { api } from "@/lib/client/api";
import { actionErrorMessage } from "@/lib/client/asyncAction";
import { ownerFence } from "@/lib/client/ownerFence";
import { useSession } from "@/components/shell/SessionShell";
import type { StudioAsset, StudioDraft, WorkItem } from "@/lib/cofounder/types";
import styles from "./companion.module.css";

export function StudioClient() {
  const { user, generation } = useSession();
  const [drafts, setDrafts] = useState<StudioDraft[]>([]);
  const [current, setCurrent] = useState<StudioDraft | null>(null);
  const [headline, setHeadline] = useState("Now booking");
  const [body, setBody] = useState("");
  const [direction, setDirection] = useState("Quiet, editorial, gold and forest light. No fake testimonials.");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [asset, setAsset] = useState<StudioAsset | null>(null);
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);

  async function refresh(gen = generation) {
    const data = await api<{ drafts: StudioDraft[] }>("/api/companion/studio");
    const work = await api<{ items: WorkItem[] }>("/api/companion/work?kind=draft");
    if (!ownerFence.isCurrent(gen, user?.id ?? null)) return;
    setDrafts(data.drafts);
    setWorkItems(work.items);
    setCurrent((prev) => data.drafts.find((item) => item.id === prev?.id) ?? data.drafts[0] ?? null);
  }

  useEffect(() => {
    if (!user) return;
    void refresh().catch((err) => setError(actionErrorMessage(err, "Studio could not load.")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generation, user?.id]);

  const selected = current;

  const layerText = useMemo(() => {
    return {
      headline: selected?.layers.find((layer) => layer.kind === "headline")?.text ?? headline,
      body: selected?.layers.find((layer) => layer.kind === "body")?.text ?? body
    };
  }, [selected, headline, body]);

  async function createDraft(workItemId?: string) {
    setError("");
    try {
      const created = await api<{ draft: StudioDraft }>("/api/companion/studio", {
        method: "POST",
        body: JSON.stringify({
          headline,
          body,
          direction,
          workItemId
        })
      });
      setCurrent(created.draft);
      await refresh();
      setStatus("Studio draft saved. Text and logo remain editable layers.");
    } catch (err) {
      setError(actionErrorMessage(err, "Studio draft could not be created."));
    }
  }

  async function saveLayers() {
    if (!selected) return;
    const layers = selected.layers.map((layer) =>
      layer.kind === "headline"
        ? { ...layer, text: headline || layer.text }
        : layer.kind === "body"
          ? { ...layer, text: body || layer.text }
          : layer
    );
    const updated = await api<{ draft: StudioDraft }>("/api/companion/studio", {
      method: "PATCH",
      body: JSON.stringify({ draftId: selected.id, layers })
    });
    setCurrent(updated.draft);
    setStatus("Layers saved. Generated pixels were not asked to reproduce the logo.");
  }

  async function generate() {
    if (!selected) return;
    setError("");
    setStatus("Generation pending…");
    setAsset({
      id: "pending",
      businessId: selected.businessId,
      draftId: selected.id,
      status: "pending",
      prompt: direction,
      revision: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    try {
      const result = await api<{ asset: StudioAsset }>("/api/companion/studio/generate", {
        method: "POST",
        body: JSON.stringify({
          draftId: selected.id,
          prompt: `${direction}\nHeadline context: ${headline}. Do not invent customer results.`,
          idempotencyKey: crypto.randomUUID()
        })
      });
      setAsset(result.asset);
      setStatus(result.asset.status === "ready" ? "Image ready. It is not a portfolio result." : result.asset.error ?? "");
      await refresh();
    } catch (err) {
      setAsset((currentAsset) =>
        currentAsset
          ? { ...currentAsset, status: "failed", error: actionErrorMessage(err, "Generation failed.") }
          : currentAsset
      );
      setError(actionErrorMessage(err, "Generation failed. The pending image was not marked complete."));
    }
  }

  async function exportDraft() {
    if (!selected) return;
    const result = await api<{ exported: { labeled: string } }>("/api/companion/studio/export", {
      method: "POST",
      body: JSON.stringify({ draftId: selected.id, format: selected.layout })
    });
    setStatus(`Exported as ${result.exported.labeled}. Saved in Work.`);
  }

  async function uploadLogo(file: File) {
    const bytesBase64 = await file.arrayBuffer().then((buffer) => {
      const bytes = new Uint8Array(buffer);
      let binary = "";
      bytes.forEach((value) => {
        binary += String.fromCharCode(value);
      });
      return btoa(binary);
    });
    await api("/api/companion/documents", {
      method: "POST",
      body: JSON.stringify({
        title: file.name,
        mime: file.type || "image/png",
        bytesBase64,
        kind: "logo"
      })
    });
    setStatus("Original logo stored. It will sit as a controlled layer.");
  }

  return (
    <CompanionShell
      title="Brand Studio"
      lede="Generate or choose an image, keep headline and logo as controlled layers, and export a practical format. Illustrative imagery is never presented as a customer result."
    >
      <div className={styles.grid}>
        <article className={`surface-dimensional ${styles.card}`}>
          <div className={styles.canvas} aria-label="Composition preview">
            {asset?.status === "ready" && selected?.selectedAssetId ? (
              <img src={`/api/companion/assets/${selected.selectedAssetId}`} alt="" />
            ) : null}
            <div className={`${styles.layer} ${styles.layerHeadline}`} style={{ left: "8%", top: "12%", width: "84%" }}>
              {layerText.headline}
            </div>
            <div className={`${styles.layer} ${styles.layerBody}`} style={{ left: "8%", top: "38%", width: "84%" }}>
              {layerText.body}
            </div>
            {asset?.status === "pending" ? <p className="tiny" style={{ position: "absolute", bottom: 16, left: 16 }}>Pending generation</p> : null}
            {asset?.status === "failed" ? <p className="notice notice-warn">Generation failed — not a completed asset.</p> : null}
          </div>
          <p className="tiny">{status}</p>
          {error ? <p className="notice notice-warn">{error}</p> : null}
        </article>
        <aside className={`panel ${styles.card}`}>
          <label className="tiny" htmlFor="headline">Headline</label>
          <input id="headline" className={styles.field} value={headline} onChange={(event) => setHeadline(event.target.value)} />
          <label className="tiny" htmlFor="body">Body</label>
          <textarea id="body" className={styles.field} value={body} onChange={(event) => setBody(event.target.value)} />
          <label className="tiny" htmlFor="direction">Image direction</label>
          <textarea id="direction" className={styles.field} value={direction} onChange={(event) => setDirection(event.target.value)} />
          <div className={styles.actions}>
            <button className="btn btn-gold" type="button" onClick={() => void createDraft()}>
              New draft
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => void saveLayers()} disabled={!selected}>
              Save layers
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => void generate()} disabled={!selected}>
              Generate image
            </button>
            <button className="btn btn-emerald" type="button" onClick={() => void exportDraft()} disabled={!selected}>
              Export
            </button>
          </div>
          <label className="tiny" htmlFor="logo">
            Add original logo
          </label>
          <input
            id="logo"
            type="file"
            accept="image/*"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void uploadLogo(file);
            }}
          />
          {workItems.length ? (
            <div className={styles.list} style={{ marginTop: 16 }}>
              <p className="tiny">From Talk / Work</p>
              {workItems.slice(0, 5).map((item) => (
                <button key={item.id} className="btn btn-ghost" type="button" onClick={() => {
                  setHeadline(item.title);
                  setBody(String(item.payload.body ?? ""));
                  void createDraft(item.id);
                }}>
                  Use “{item.title}”
                </button>
              ))}
            </div>
          ) : null}
          {drafts.length ? (
            <p className="tiny" style={{ marginTop: 16 }}>
              {drafts.length} saved Studio revision(s) in this workspace.
            </p>
          ) : null}
        </aside>
      </div>
    </CompanionShell>
  );
}
