"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CompanionShell } from "@/components/cofounder/CompanionShell";
import { api } from "@/lib/client/api";
import { actionErrorMessage } from "@/lib/client/asyncAction";
import { ownerFence } from "@/lib/client/ownerFence";
import { useSession } from "@/components/shell/SessionShell";
import { assetUrl, buildComposition, documentUrl, studioLayouts, type CompositionSpec } from "@/lib/cofounder/composition";
import type { StudioAsset, StudioDraft, StudioLayoutId, WorkItem } from "@/lib/cofounder/types";
import styles from "./companion.module.css";

const LAYOUTS = studioLayouts();

export function StudioClient() {
  const { user, generation } = useSession();
  const search = useSearchParams();
  const [businessId, setBusinessId] = useState<string>();
  const [drafts, setDrafts] = useState<StudioDraft[]>([]);
  const [assets, setAssets] = useState<StudioAsset[]>([]);
  const [current, setCurrent] = useState<StudioDraft | null>(null);
  const [headline, setHeadline] = useState("");
  const [body, setBody] = useState("");
  const [direction, setDirection] = useState("Quiet workshop light. No fake testimonials or invented results.");
  const [layout, setLayout] = useState<StudioLayoutId>("square_announcement");
  const [logoX, setLogoX] = useState(8);
  const [logoY, setLogoY] = useState(78);
  const [cropX, setCropX] = useState(50);
  const [cropY, setCropY] = useState(50);
  const [cropZoom, setCropZoom] = useState(1);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [asset, setAsset] = useState<StudioAsset | null>(null);
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [logoDocumentId, setLogoDocumentId] = useState<string>();
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const generateKeyRef = useRef<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  function hydrate(draft: StudioDraft | null) {
    setCurrent(draft);
    setHeadline(draft?.layers.find((layer) => layer.kind === "headline")?.text ?? "");
    setBody(draft?.layers.find((layer) => layer.kind === "body")?.text ?? "");
    setLayout(draft?.layout ?? "square_announcement");
    const logo = draft?.layers.find((layer) => layer.kind === "logo");
    setLogoX(logo?.x ?? 8);
    setLogoY(logo?.y ?? 78);
    if (logo?.documentId) setLogoDocumentId(logo.documentId);
    const image = draft?.layers.find((layer) => layer.kind === "image");
    setCropX(image?.cropX ?? 50);
    setCropY(image?.cropY ?? 50);
    setCropZoom(image?.cropZoom ?? 1);
  }

  async function refresh(gen = generation) {
    const workspace = await api<{ business: { id: string }; rawProfile?: { brandAssets?: Array<{ kind: string; documentId?: string }> } }>(
      "/api/companion/workspace"
    );
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
    const logo = workspace.rawProfile?.brandAssets?.find((item) => item.kind === "logo");
    if (logo?.documentId) setLogoDocumentId(logo.documentId);
    const requested = search.get("draftId") ?? search.get("workItemId");
    const match =
      data.drafts.find((item) => item.id === requested) ??
      data.drafts.find((item) => item.workItemId === requested || item.sourceWorkItemId === requested) ??
      data.drafts.find((item) => item.id === current?.id) ??
      data.drafts[0] ??
      null;
    if (!current || match?.id !== current.id || match?.updatedAt !== current.updatedAt) {
      hydrate(match);
    }
  }

  useEffect(() => {
    if (!user) return;
    void refresh().catch((err) => setError(actionErrorMessage(err, "Studio could not load.")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generation, user?.id, search.get("workItemId"), search.get("draftId")]);

  const selected = current;
  const backgroundUrl =
    asset?.status === "ready" && selected?.selectedAssetId && businessId
      ? assetUrl(businessId, selected.selectedAssetId)
      : selected?.selectedAssetId && businessId && asset?.status !== "failed"
        ? assetUrl(businessId, selected.selectedAssetId)
        : "";
  const logoUrl = logoDocumentId && businessId ? documentUrl(businessId, logoDocumentId) : "";

  const composition = useMemo(() => {
    if (!businessId) return null;
    return buildComposition({
      layout,
      layers: [
        { id: "headline", kind: "headline", text: headline, x: 8, y: 12, width: 84, height: 18 },
        { id: "body", kind: "body", text: body, x: 8, y: 34, width: 84, height: 28 },
        ...(logoDocumentId
          ? [{ id: "logo", kind: "logo" as const, documentId: logoDocumentId, x: logoX, y: logoY, width: 18, height: 14 }]
          : []),
        {
          id: "image",
          kind: "image",
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          cropX,
          cropY,
          cropZoom
        }
      ],
      businessId,
      backgroundImageUrl: backgroundUrl || null,
      logoUrl: logoUrl || null
    });
  }, [businessId, layout, headline, body, logoDocumentId, logoX, logoY, cropX, cropY, cropZoom, backgroundUrl, logoUrl]);

  async function createDraft(input?: { workItemId?: string; headline: string; body: string }) {
    const nextHeadline = input?.headline ?? headline;
    const nextBody = input?.body ?? body;
    setError("");
    try {
      const created = await api<{ draft: StudioDraft }>("/api/companion/studio", {
        method: "POST",
        body: JSON.stringify({
          businessId,
          headline: nextHeadline || "Untitled",
          body: nextBody,
          direction,
          layout,
          workItemId: input?.workItemId
        })
      });
      hydrate(created.draft);
      await refresh();
      setStatus("Studio draft saved with the exact selected copy.");
    } catch (err) {
      setError(actionErrorMessage(err, "Studio draft could not be created."));
    }
  }

  function currentLayers() {
    return (selected?.layers ?? []).map((layer) => {
      if (layer.kind === "headline") return { ...layer, text: headline };
      if (layer.kind === "body") return { ...layer, text: body };
      if (layer.kind === "logo") return { ...layer, documentId: logoDocumentId ?? layer.documentId, x: logoX, y: logoY };
      if (layer.kind === "image") return { ...layer, cropX, cropY, cropZoom };
      return layer;
    });
  }

  async function saveLayers() {
    if (!selected) return;
    const layers = currentLayers();
    if (!layers.some((layer) => layer.kind === "logo") && logoDocumentId) {
      layers.push({ id: "logo", kind: "logo", documentId: logoDocumentId, x: logoX, y: logoY, width: 18, height: 14 });
    }
    if (!layers.some((layer) => layer.kind === "image")) {
      layers.push({ id: "image", kind: "image", x: 0, y: 0, width: 100, height: 100, cropX, cropY, cropZoom });
    }
    const updated = await api<{ draft: StudioDraft }>("/api/companion/studio", {
      method: "PATCH",
      body: JSON.stringify({
        businessId,
        draftId: selected.id,
        layout,
        layers,
        expectedUpdatedAt: selected.updatedAt
      })
    });
    hydrate(updated.draft);
    setStatus("Layers saved. Empty text stayed empty. Generated pixels were not asked to reproduce the logo.");
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
    if (!selected || !composition || exporting) return;
    setExporting(true);
    setError("");
    setStatus("Composing export…");
    try {
      const composedPngBase64 = await composePng(composition, canvasRef.current);
      const result = await api<{
        exported: { labeled: string; dimensions: { width: number; height: number }; assetUrl?: string | null };
      }>("/api/companion/studio/export", {
        method: "POST",
        body: JSON.stringify({
          businessId,
          draftId: selected.id,
          format: layout,
          composedPngBase64,
          expectedUpdatedAt: selected.updatedAt
        })
      });
      const href = `data:image/png;base64,${composedPngBase64}`;
      const link = document.createElement("a");
      link.href = href;
      link.download = `${selected.id}.png`;
      link.click();
      setStatus(`Exported as ${result.exported.labeled}. The finished file is saved in Work.`);
      await refresh();
    } catch (err) {
      setError(actionErrorMessage(err, "Export failed. The draft is still editable and was not marked exported."));
      setStatus("");
    } finally {
      setExporting(false);
    }
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
    const result = await api<{ document: { id: string } }>("/api/companion/documents", {
      method: "POST",
      body: JSON.stringify({
        businessId,
        title: file.name,
        mime: file.type || "image/png",
        bytesBase64,
        kind: "logo"
      })
    });
    setLogoDocumentId(result.document.id);
    setStatus("Original logo stored. Preview and export use the same placement.");
    if (selected) await saveLayers();
  }

  async function importWork(item: WorkItem) {
    const nextHeadline = item.title;
    const nextBody = String(item.payload.body ?? item.payload.preview ?? "");
    setHeadline(nextHeadline);
    setBody(nextBody);
    await createDraft({ workItemId: item.id, headline: nextHeadline, body: nextBody });
  }

  return (
    <CompanionShell
      title="Brand Studio"
      lede="Import the exact Talk copy, place the real logo, and export only after the composed file is saved."
    >
      <canvas ref={canvasRef} hidden />
      <div className={styles.grid}>
        <article className={`surface-dimensional ${styles.card}`}>
          <div
            className={styles.canvas}
            aria-label="Composition preview"
            style={{
              aspectRatio: composition?.aspect,
              background: composition?.palette.canvas ?? "#2a2218"
            }}
          >
            {backgroundUrl ? (
              <img
                className={styles.canvasImage}
                src={backgroundUrl}
                alt=""
                style={{
                  objectPosition: `${cropX}% ${cropY}%`,
                  transform: `scale(${cropZoom})`
                }}
              />
            ) : (
              <p className={`${styles.emptyCanvas} tiny`}>No generated image. The logo and copy still compose.</p>
            )}
            {composition ? (
              <>
                <div
                  className={`${styles.layer} ${styles.layerHeadline}`}
                  style={{
                    left: `${composition.headline.x}%`,
                    top: `${composition.headline.y}%`,
                    width: `${composition.headline.width}%`,
                    color: composition.headline.color
                  }}
                >
                  {composition.headline.text}
                </div>
                <div
                  className={`${styles.layer} ${styles.layerBody}`}
                  style={{
                    left: `${composition.body.x}%`,
                    top: `${composition.body.y}%`,
                    width: `${composition.body.width}%`,
                    color: composition.body.color
                  }}
                >
                  {composition.body.text}
                </div>
                {composition.logo ? (
                  <img
                    className={styles.layerLogo}
                    src={composition.logo.src}
                    alt="Uploaded logo"
                    style={{
                      left: `${composition.logo.x}%`,
                      top: `${composition.logo.y}%`,
                      width: `${composition.logo.width}%`,
                      height: `${composition.logo.height}%`
                    }}
                  />
                ) : null}
              </>
            ) : null}
            {asset?.status === "pending" ? <p className="tiny" style={{ position: "absolute", bottom: 16, left: 16 }}>Pending generation</p> : null}
            {asset?.status === "failed" ? <p className="notice notice-warn">Generation failed — not a completed asset.</p> : null}
          </div>
          <p className="tiny">{status}</p>
          {error ? <p className="notice notice-warn">{error}</p> : null}
        </article>
        <aside className={`panel ${styles.card}`}>
          <label className="tiny" htmlFor="studio-draft">
            Saved draft
          </label>
          <select
            id="studio-draft"
            className={styles.select}
            value={selected?.id ?? ""}
            onChange={(event) => hydrate(drafts.find((item) => item.id === event.target.value) ?? null)}
          >
            <option value="">New composition</option>
            {drafts.map((draft) => (
              <option key={draft.id} value={draft.id}>
                {draft.layers.find((layer) => layer.kind === "headline")?.text || "Untitled"} · {draft.layout}
              </option>
            ))}
          </select>
          <label className="tiny" htmlFor="studio-layout">
            Layout
          </label>
          <select
            id="studio-layout"
            className={styles.select}
            value={layout}
            onChange={(event) => setLayout(event.target.value as StudioLayoutId)}
          >
            {LAYOUTS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          <label className="tiny" htmlFor="headline">
            Headline
          </label>
          <input id="headline" className={styles.field} value={headline} onChange={(event) => setHeadline(event.target.value)} />
          <label className="tiny" htmlFor="body">
            Body
          </label>
          <textarea id="body" className={styles.field} value={body} onChange={(event) => setBody(event.target.value)} />
          <label className="tiny" htmlFor="direction">
            Image direction
          </label>
          <textarea id="direction" className={styles.field} value={direction} onChange={(event) => setDirection(event.target.value)} />
          <label className="tiny" htmlFor="crop-x">
            Image crop X {cropX}
          </label>
          <input id="crop-x" type="range" min={0} max={100} value={cropX} onChange={(event) => setCropX(Number(event.target.value))} />
          <label className="tiny" htmlFor="crop-y">
            Image crop Y {cropY}
          </label>
          <input id="crop-y" type="range" min={0} max={100} value={cropY} onChange={(event) => setCropY(Number(event.target.value))} />
          <label className="tiny" htmlFor="logo-x">
            Logo placement
          </label>
          <div className={styles.actions}>
            <input aria-label="Logo X" type="range" min={2} max={80} value={logoX} onChange={(event) => setLogoX(Number(event.target.value))} />
            <input aria-label="Logo Y" type="range" min={2} max={88} value={logoY} onChange={(event) => setLogoY(Number(event.target.value))} />
          </div>
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
            <button className="btn btn-emerald" type="button" onClick={() => void exportDraft()} disabled={!selected || exporting}>
              {exporting ? "Exporting…" : "Export"}
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
              {workItems.slice(0, 8).map((item) => (
                <button
                  key={item.id}
                  className="btn btn-ghost"
                  type="button"
                  onClick={() => void importWork(item)}
                >
                  Use “{item.title}”
                </button>
              ))}
            </div>
          ) : null}
          {assets.length ? (
            <p className="tiny">{assets.length} pending or failed generation(s) — none shown as complete.</p>
          ) : null}
        </aside>
      </div>
    </CompanionShell>
  );
}

async function composePng(spec: CompositionSpec, canvas: HTMLCanvasElement | null) {
  const target = canvas ?? document.createElement("canvas");
  target.width = spec.width;
  target.height = spec.height;
  const ctx = target.getContext("2d");
  if (!ctx) throw new Error("This browser could not compose the export canvas.");
  ctx.fillStyle = spec.palette.canvas;
  ctx.fillRect(0, 0, spec.width, spec.height);
  if (spec.backgroundImageUrl) {
    const image = await loadImage(spec.backgroundImageUrl);
    const zoom = spec.crop.zoom;
    const width = spec.width * zoom;
    const height = spec.height * zoom;
    const x = ((spec.crop.x / 100) * spec.width) - width / 2;
    const y = ((spec.crop.y / 100) * spec.height) - height / 2;
    ctx.drawImage(image, x + spec.width / 2 - width / 2, y + spec.height / 2 - height / 2, width, height);
  }
  ctx.fillStyle = spec.headline.color;
  ctx.font = `600 ${spec.headline.fontSize}px serif`;
  wrapText(ctx, spec.headline.text, (spec.headline.x / 100) * spec.width, (spec.headline.y / 100) * spec.height + spec.headline.fontSize, (spec.headline.width / 100) * spec.width);
  ctx.fillStyle = spec.body.color;
  ctx.font = `400 ${spec.body.fontSize}px sans-serif`;
  wrapText(ctx, spec.body.text, (spec.body.x / 100) * spec.width, (spec.body.y / 100) * spec.height + spec.body.fontSize, (spec.body.width / 100) * spec.width);
  if (spec.logo) {
    const logo = await loadImage(spec.logo.src);
    const boxW = (spec.logo.width / 100) * spec.width;
    const boxH = (spec.logo.height / 100) * spec.height;
    const scale = Math.min(boxW / logo.width, boxH / logo.height);
    const drawW = logo.width * scale;
    const drawH = logo.height * scale;
    ctx.drawImage(logo, (spec.logo.x / 100) * spec.width, (spec.logo.y / 100) * spec.height, drawW, drawH);
  }
  const data = target.toDataURL("image/png");
  return data.replace(/^data:image\/png;base64,/, "");
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("A background or logo image failed to load. Export was not marked complete."));
    img.src = src;
  });
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number) {
  if (!text) return;
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
