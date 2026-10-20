"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CompanionShell } from "@/components/cofounder/CompanionShell";
import { api } from "@/lib/client/api";
import { actionErrorMessage } from "@/lib/client/asyncAction";
import { ownerFence } from "@/lib/client/ownerFence";
import { useSession } from "@/components/shell/SessionShell";
import type { StudioAsset, StudioDraft, WorkItem } from "@/lib/cofounder/types";
import styles from "./companion.module.css";

export function StudioClient() {
  const { user, generation } = useSession();
  const [businessId, setBusinessId] = useState<string>();
  const [drafts, setDrafts] = useState<StudioDraft[]>([]);
  const [assets, setAssets] = useState<StudioAsset[]>([]);
  const [current, setCurrent] = useState<StudioDraft | null>(null);
  const [headline, setHeadline] = useState("Now booking");
  const [body, setBody] = useState("");
  const [direction, setDirection] = useState("Quiet, editorial, gold and forest light. No fake testimonials.");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [asset, setAsset] = useState<StudioAsset | null>(null);
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [generating, setGenerating] = useState(false);
  const generateKeyRef = useRef<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  async function refresh(gen = generation) {
    const workspace = await api<{ business: { id: string } }>("/api/companion/workspace");
    const data = await api<{ drafts: StudioDraft[] }>(
      `/api/companion/studio?businessId=${encodeURIComponent(workspace.business.id)}`
    );
    const work = await api<{ items: WorkItem[] }>(
      `/api/companion/work?kind=draft&businessId=${encodeURIComponent(workspace.business.id)}`
    );
    const today = await api<{ today: { pendingAssets: StudioAsset[] } }>(
      `/api/companion/today?businessId=${encodeURIComponent(workspace.business.id)}`
    );
    if (!ownerFence.isCurrent(gen, user?.id ?? null)) return;
    setBusinessId(workspace.business.id);
    setDrafts(data.drafts);
    setWorkItems(work.items);
    setAssets(today.today.pendingAssets);
    setCurrent((prev) => data.drafts.find((item) => item.id === prev?.id) ?? data.drafts[0] ?? null);
  }

  useEffect(() => {
    if (!user) return;
    void refresh().catch((err) => setError(actionErrorMessage(err, "Studio could not load.")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generation, user?.id]);

  const selected = current;
  const assetSrc =
    asset?.status === "ready" && selected?.selectedAssetId && businessId
      ? `/api/companion/assets/${selected.selectedAssetId}?businessId=${encodeURIComponent(businessId)}`
      : selected?.selectedAssetId && businessId
        ? `/api/companion/assets/${selected.selectedAssetId}?businessId=${encodeURIComponent(businessId)}`
        : "";

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
          businessId,
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
      body: JSON.stringify({ businessId, draftId: selected.id, layers })
    });
    setCurrent(updated.draft);
    setStatus("Layers saved. Generated pixels were not asked to reproduce the logo.");
  }

  async function generate(sourceAssetId?: string) {
    if (!selected || generating) return;
    setError("");
    setGenerating(true);
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
    const idempotencyKey = generateKeyRef.current ?? crypto.randomUUID();
    generateKeyRef.current = idempotencyKey;
    try {
      const result = await api<{ asset: StudioAsset }>("/api/companion/studio/generate", {
        method: "POST",
        body: JSON.stringify({
          businessId,
          draftId: selected.id,
          prompt: `${direction}\nHeadline context: ${headline}. Do not invent customer results.`,
          idempotencyKey,
          sourceAssetId
        })
      });
      setAsset(result.asset);
      generateKeyRef.current = null;
      setStatus(result.asset.status === "ready" ? "Image ready. It is not a portfolio result." : result.asset.error ?? "");
      await refresh();
    } catch (err) {
      setAsset((currentAsset) =>
        currentAsset
          ? { ...currentAsset, status: "failed", error: actionErrorMessage(err, "Generation failed.") }
          : currentAsset
      );
      setError(actionErrorMessage(err, "Generation failed. The pending image was not marked complete. Retry uses the same request id."));
    } finally {
      setGenerating(false);
    }
  }

  async function exportDraft() {
    if (!selected) return;
    const result = await api<{
      exported: { labeled: string; dimensions: { width: number; height: number }; assetUrl?: string | null };
    }>("/api/companion/studio/export", {
      method: "POST",
      body: JSON.stringify({ businessId, draftId: selected.id, format: selected.layout })
    });
    await composeDownload(result.exported.dimensions, result.exported.assetUrl ?? assetSrc);
    setStatus(`Exported as ${result.exported.labeled}. Composition downloaded and saved in Work.`);
  }

  async function composeDownload(dimensions: { width: number; height: number }, imageUrl?: string | null) {
    const canvas = canvasRef.current ?? document.createElement("canvas");
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#16120e";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (imageUrl) {
      try {
        const image = await new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error("background"));
          img.src = imageUrl;
        });
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      } catch {
        // Controlled layers still export without a generated background.
      }
    }
    ctx.fillStyle = "#f3f0e7";
    ctx.font = `600 ${Math.round(canvas.width / 16)}px serif`;
    wrapText(ctx, layerText.headline, canvas.width * 0.08, canvas.height * 0.16, canvas.width * 0.84);
    ctx.fillStyle = "#a7b6ac";
    ctx.font = `400 ${Math.round(canvas.width / 36)}px sans-serif`;
    wrapText(ctx, layerText.body, canvas.width * 0.08, canvas.height * 0.38, canvas.width * 0.84);
    const href = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = href;
    link.download = `${selected?.id ?? "atelier-studio"}.png`;
    link.click();
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
        businessId,
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
      <canvas ref={canvasRef} hidden />
      <div className={styles.grid}>
        <article className={`surface-dimensional ${styles.card}`}>
          <div className={styles.canvas} aria-label="Composition preview">
            {asset?.status === "ready" || (selected?.selectedAssetId && asset?.status !== "failed") ? (
              assetSrc ? <img src={assetSrc} alt="" /> : null
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
            <button className="btn btn-ghost" type="button" onClick={() => void generate()} disabled={!selected || generating}>
              {generating ? "Generating…" : "Generate image"}
            </button>
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() => void generate(selected?.selectedAssetId)}
              disabled={!selected?.selectedAssetId || generating}
            >
              Edit selected image
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
          {assets.length ? (
            <p className="tiny">{assets.length} pending or failed generation(s) — none shown as complete.</p>
          ) : null}
        </aside>
      </div>
    </CompanionShell>
  );
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number) {
  const words = text.split(/\s+/);
  let line = "";
  let cursor = y;
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      ctx.fillText(line, x, cursor);
      line = word;
      cursor += Math.round(ctx.canvas.width / 22);
    } else {
      line = next;
    }
  }
  if (line) ctx.fillText(line, x, cursor);
}
