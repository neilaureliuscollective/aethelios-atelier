"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CompanionShell } from "@/components/cofounder/CompanionShell";
import { api } from "@/lib/client/api";
import { actionErrorMessage } from "@/lib/client/asyncAction";
import { ownerFence } from "@/lib/client/ownerFence";
import { useSession } from "@/components/shell/SessionShell";
import {
  assetUrl,
  buildComposition,
  compositionCssFont,
  coverCropRect,
  documentUrl,
  layersFromControls,
  paletteForProfile,
  previewScale,
  scaleCompositionPx,
  studioLayouts,
  wrapLines,
  type BrandPalette,
  type CompositionSpec
} from "@/lib/cofounder/composition";
import { resolveStudioOpen, selectedWorkText } from "@/lib/cofounder/studioOpen";
import type { BusinessProfile, StudioAsset, StudioDraft, StudioLayoutId, WorkItem } from "@/lib/cofounder/types";
import styles from "./companion.module.css";

const LAYOUTS = studioLayouts();

export function StudioClient() {
  const { user, generation } = useSession();
  const search = useSearchParams();
  const [businessId, setBusinessId] = useState<string>();
  const [profile, setProfile] = useState<Pick<BusinessProfile, "fields"> | null>(null);
  const [drafts, setDrafts] = useState<StudioDraft[]>([]);
  const [assets, setAssets] = useState<StudioAsset[]>([]);
  const [current, setCurrent] = useState<StudioDraft | null>(null);
  const [headline, setHeadline] = useState("");
  const [body, setBody] = useState("");
  const [direction, setDirection] = useState("Quiet workshop light. No fake testimonials or invented results.");
  const [layout, setLayout] = useState<StudioLayoutId>("square_announcement");
  const [logoX, setLogoX] = useState(8);
  const [logoY, setLogoY] = useState(80);
  const [cropX, setCropX] = useState(50);
  const [cropY, setCropY] = useState(50);
  const [cropZoom, setCropZoom] = useState(1);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [recovery, setRecovery] = useState("");
  const [asset, setAsset] = useState<StudioAsset | null>(null);
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [logoDocumentId, setLogoDocumentId] = useState<string | undefined>();
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const generateKeyRef = useRef<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewBoxRef = useRef<HTMLDivElement | null>(null);
  const [previewWidth, setPreviewWidth] = useState(0);

  function hydrate(draft: StudioDraft | null) {
    setCurrent(draft);
    setHeadline(draft?.layers.find((layer) => layer.kind === "headline")?.text ?? "");
    setBody(draft?.layers.find((layer) => layer.kind === "body")?.text ?? "");
    setLayout(draft?.layout ?? "square_announcement");
    const logo = draft?.layers.find((layer) => layer.kind === "logo");
    setLogoX(logo?.x ?? 8);
    setLogoY(logo?.y ?? 80);
    setLogoDocumentId(logo?.documentId);
    const image = draft?.layers.find((layer) => layer.kind === "image");
    setCropX(image?.cropX ?? 50);
    setCropY(image?.cropY ?? 50);
    setCropZoom(image?.cropZoom ?? 1);
    setDirty(false);
  }

  async function refresh(gen = generation) {
    const workspace = await api<{
      business: { id: string; name: string };
      rawProfile?: BusinessProfile;
    }>("/api/companion/workspace");
    const data = await api<{ drafts: StudioDraft[]; assets?: StudioAsset[] }>(
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
    setProfile(workspace.rawProfile ?? null);
    setDrafts(data.drafts);
    setWorkItems(work.items);
    setAssets(data.assets ?? today.today.pendingAssets);
    const requestedDraft = search.get("draftId");
    const requestedWork = search.get("workItemId");
    if (!requestedDraft && !requestedWork) {
      if (current) {
        const latest = data.drafts.find((item) => item.id === current.id);
        if (latest && latest.updatedAt !== current.updatedAt) hydrate(latest);
      } else if (data.drafts.length) {
        const latest = [...data.drafts].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
        if (latest) hydrate(latest);
      }
      return;
    }
    const resolved = resolveStudioOpen(
      { draftId: requestedDraft, workItemId: requestedWork },
      data.drafts,
      work.items
    );
    if (resolved.kind === "draft") {
      if (!current || current.id !== resolved.draft.id || current.updatedAt !== resolved.draft.updatedAt) {
        hydrate(resolved.draft);
      }
      setError("");
      setRecovery("");
      return;
    }
    if (resolved.kind === "create_from_work") {
      const copy = selectedWorkText(resolved.workItem);
      setHeadline(copy.headline);
      setBody(copy.body);
      setDirty(true);
      await createDraft({
        workItemId: resolved.workItem.id,
        headline: copy.headline,
        body: copy.body
      });
      return;
    }
    if (resolved.kind === "error") {
      setError(resolved.message);
      setRecovery(resolved.recovery);
      hydrate(null);
    }
  }

  useEffect(() => {
    if (!user) return;
    void refresh().catch((err) => setError(actionErrorMessage(err, "Studio could not load.")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generation, user?.id, search.get("workItemId"), search.get("draftId")]);

  const selected = current;
  const backgroundUrl =
    selected?.selectedAssetId && businessId ? assetUrl(businessId, selected.selectedAssetId) : "";
  const logoUrl = logoDocumentId && businessId ? documentUrl(businessId, logoDocumentId) : "";
  const palette: BrandPalette | undefined = profile ? paletteForProfile(profile) : undefined;

  const liveLayers = useMemo(
    () =>
      layersFromControls({
        headline,
        body,
        layout,
        logoDocumentId,
        logoX,
        logoY,
        cropX,
        cropY,
        cropZoom
      }),
    [headline, body, layout, logoDocumentId, logoX, logoY, cropX, cropY, cropZoom]
  );

  const composition = useMemo(() => {
    if (!businessId) return null;
    return buildComposition({
      layout,
      layers: liveLayers,
      businessId,
      palette,
      profile,
      backgroundImageUrl: backgroundUrl || null,
      logoUrl: logoUrl || null
    });
  }, [businessId, layout, liveLayers, palette, profile, backgroundUrl, logoUrl]);

  useEffect(() => {
    const box = previewBoxRef.current;
    if (!box || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      setPreviewWidth(entries[0]?.contentRect.width ?? 0);
    });
    observer.observe(box);
    setPreviewWidth(box.getBoundingClientRect().width);
    return () => observer.disconnect();
  }, [composition?.width, composition?.aspect]);

  useEffect(() => {
    if (!composition || !previewCanvasRef.current) return;
    void renderComposition(composition, previewCanvasRef.current).catch(() => undefined);
  }, [composition]);

  async function createDraft(input?: { workItemId?: string; headline: string; body: string }) {
    const nextHeadline = input?.headline ?? headline;
    const nextBody = input?.body ?? body;
    setError("");
    setRecovery("");
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
      setStatus(`Studio draft linked to ${input?.workItemId ? "the exact Work item" : "this composition"}.`);
    } catch (err) {
      setError(actionErrorMessage(err, "Studio draft could not be created."));
      setRecovery("Keep the copy. Retry create, or return to Work and open the item again.");
    }
  }

  async function saveLayers(explicitLogoId = logoDocumentId) {
    if (!selected) return selected;
    setSaving(true);
    try {
      const layers = layersFromControls({
        headline,
        body,
        layout,
        logoDocumentId: explicitLogoId,
        logoX,
        logoY,
        cropX,
        cropY,
        cropZoom
      });
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
      setStatus("Saved. Preview, export, and the stored revision now share this composition.");
      return updated.draft;
    } catch (err) {
      setError(actionErrorMessage(err, "Layers could not be saved. The draft is still editable."));
      setRecovery("Reload the newer revision, or retry save. Export was not marked complete.");
      return null;
    } finally {
      setSaving(false);
    }
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
      const result = await api<{ asset: StudioAsset; applied?: boolean; conflict?: boolean }>("/api/companion/studio/generate", {
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
      if (result.asset.status === "invalidated") {
        setStatus("Generation was invalidated after sign-out or cancel. No retained image was stored.");
      } else if (result.conflict) {
        setStatus("Image ready as a separate asset. Newer draft edits were kept. Apply it below if you want it selected.");
      } else {
        setStatus(result.asset.status === "ready" ? "Image ready. It is not a portfolio result." : result.asset.error ?? "");
      }
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
    setRecovery("");
    setStatus("Saving the exact revision, then exporting…");
    try {
      const saved = dirty ? await saveLayers() : selected;
      if (!saved) return;
      const composedPngBase64 = await composePng(composition, canvasRef.current ?? previewCanvasRef.current);
      const result = await api<{
        exported: { labeled: string; dimensions: { width: number; height: number }; assetUrl?: string | null };
      }>("/api/companion/studio/export", {
        method: "POST",
        body: JSON.stringify({
          businessId,
          draftId: saved.id,
          format: layout,
          layout,
          layers: liveLayers,
          composedPngBase64,
          expectedUpdatedAt: saved.updatedAt
        })
      });
      setStatus(`Exported ${result.exported.dimensions.width}×${result.exported.dimensions.height}. The saved revision and file match.`);
      if (result.exported.assetUrl) {
        const file = await fetch(result.exported.assetUrl);
        if (file.ok) {
          const blob = await file.blob();
          const objectUrl = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = objectUrl;
          link.download = `${saved.id}.png`;
          link.rel = "noopener";
          link.click();
          URL.revokeObjectURL(objectUrl);
        }
      }
      await refresh();
    } catch (err) {
      setError(actionErrorMessage(err, "Export failed. The draft is still editable and was not marked exported."));
      setRecovery("Keep editing, then retry export. A mismatched or 1×1 image will not mark Work as exported.");
      setStatus("");
    } finally {
      setExporting(false);
    }
  }

  async function applyRetained(assetId: string) {
    if (!selected || !businessId) return;
    setError("");
    setRecovery("");
    try {
      const result = await api<{ draft: StudioDraft }>("/api/companion/studio/apply", {
        method: "POST",
        body: JSON.stringify({
          businessId,
          draftId: selected.id,
          assetId,
          expectedSaveRevision: selected.saveRevision,
          expectedUpdatedAt: selected.updatedAt
        })
      });
      hydrate(result.draft);
      setStatus("Retained image applied to the current draft. Newer text and layout were kept.");
      await refresh();
    } catch (err) {
      setError(actionErrorMessage(err, "The retained image could not be applied. Newer draft edits were kept."));
      setRecovery("Reload the newer revision, then apply the image again. The file itself was not deleted.");
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
    setDirty(true);
    setStatus("Original logo stored. Preview and export use the same placement.");
    if (selected) await saveLayers(result.document.id);
  }

  async function importWork(item: WorkItem) {
    const copy = selectedWorkText(item);
    setHeadline(copy.headline);
    setBody(copy.body);
    await createDraft({ workItemId: item.id, headline: copy.headline, body: copy.body });
  }

  function markDirty<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setDirty(true);
    };
  }

  const saveState = saving
    ? "Saving"
    : error.toLowerCase().includes("could not be saved") || error.toLowerCase().includes("layers could not")
      ? "Failed"
      : status.toLowerCase().includes("newer")
        ? "Conflict"
        : dirty
          ? "Unsaved"
          : exporting
            ? "Exporting"
            : !dirty && status.toLowerCase().startsWith("exported")
              ? "Exported"
              : selected
                ? "Saved"
                : "";
  const readyImages = selected
    ? assets.filter((item) => item.draftId === selected.id && item.status === "ready" && item.blobId)
    : [];

  return (
    <CompanionShell
      wide
      title="Brand Studio"
      lede="The artwork is the stage. Import exact Talk copy, place the real logo, and export only after this revision is saved."
    >
      <canvas ref={canvasRef} hidden />
      <p className={styles.context} data-project-name={profile?.fields.name.value ?? ""}>
        <strong>{profile?.fields.name.value || "Select a business in Companion."}</strong>
        <span>{selected ? `Draft ${selected.id.slice(0, 12)}` : "No draft open"}</span>
        {saveState ? (
          <span className={styles.saveState} data-save-state={saveState}>
            {saveState}
          </span>
        ) : null}
      </p>
      <div className={styles.studioDesk}>
        <section className={`${styles.artboard} on-glass`}>
          <div
            ref={previewBoxRef}
            className={styles.canvas}
            aria-label="Composition preview"
            data-preview-width={previewWidth || undefined}
            data-preview-scale={
              composition && previewWidth ? String(previewScale(composition.width, previewWidth)) : undefined
            }
            data-headline-preview-px={
              composition && previewWidth
                ? String(scaleCompositionPx(composition.headline.fontSize, composition.width, previewWidth))
                : undefined
            }
            style={{
              aspectRatio: composition?.aspect,
              background: composition?.palette.canvas ?? "#2a2218"
            }}
          >
            {composition ? (
              <canvas ref={previewCanvasRef} className={styles.previewCanvas} data-studio-preview="canvas" />
            ) : (
              <p className={`${styles.emptyCanvas} ${styles.meta}`}>No generated image. The logo and copy still compose.</p>
            )}
            {asset?.status === "pending" ? <p className={styles.meta} style={{ position: "absolute", bottom: 16, left: 16 }}>Pending generation</p> : null}
            {asset?.status === "failed" ? <p className="notice notice-warn">Generation failed — not a completed asset.</p> : null}
          </div>
          <p className={styles.meta}>{status}</p>
          {error ? <p className="notice notice-warn">{error}</p> : null}
          {recovery ? <p className={styles.meta}>{recovery}</p> : null}
        </section>
        <aside className={`${styles.inspector} on-glass`}>
          <details className={styles.sheet} open>
            <summary>Content</summary>
            <label className={styles.label} htmlFor="studio-draft">
              Saved draft
            </label>
            <select
              id="studio-draft"
              className={styles.select}
              value={selected?.id ?? ""}
              onChange={(event) => {
                const next = drafts.find((item) => item.id === event.target.value) ?? null;
                hydrate(next);
                setError("");
                setRecovery("");
              }}
            >
              <option value="">No composition selected</option>
              {drafts.map((draft) => (
                <option key={draft.id} value={draft.id}>
                  {draft.layers.find((layer) => layer.kind === "headline")?.text || "Untitled"} · {draft.layout}
                </option>
              ))}
            </select>
            <label className={styles.label} htmlFor="studio-source">
              Source from Talk or Work
            </label>
            <select
              id="studio-source"
              className={styles.select}
              value=""
              onChange={(event) => {
                const item = workItems.find((entry) => entry.id === event.target.value);
                if (item) void importWork(item);
              }}
            >
              <option value="">Choose saved copy</option>
              {workItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
            <label className={styles.label} htmlFor="headline">
              Headline
            </label>
            <input
              id="headline"
              className={styles.field}
              data-work-title={headline}
              value={headline}
              onChange={(event) => markDirty(setHeadline)(event.target.value)}
            />
            <label className={styles.label} htmlFor="body">
              Body
            </label>
            <textarea id="body" className={styles.field} value={body} onChange={(event) => markDirty(setBody)(event.target.value)} />
          </details>
          <details className={styles.sheet} open>
            <summary>Image</summary>
            <label className={styles.label} htmlFor="direction">
              Image direction
            </label>
            <textarea id="direction" className={styles.field} value={direction} onChange={(event) => setDirection(event.target.value)} />
            <label className={styles.label} htmlFor="crop-x">
              Image crop X {cropX}
            </label>
            <input id="crop-x" className={styles.range} type="range" min={0} max={100} value={cropX} onChange={(event) => markDirty(setCropX)(Number(event.target.value))} />
            <label className={styles.label} htmlFor="crop-y">
              Image crop Y {cropY}
            </label>
            <input id="crop-y" className={styles.range} type="range" min={0} max={100} value={cropY} onChange={(event) => markDirty(setCropY)(Number(event.target.value))} />
            <label className={styles.label} htmlFor="crop-zoom">
              Crop zoom {cropZoom}
            </label>
            <input
              id="crop-zoom"
              className={styles.range}
              type="range"
              min={1}
              max={2.4}
              step={0.05}
              value={cropZoom}
              onChange={(event) => markDirty(setCropZoom)(Number(event.target.value))}
            />
            {selected ? (
              <div className={styles.list} data-retained-images>
                <p className={styles.label}>Ready images</p>
                {readyImages.length === 0 ? (
                  <p className={styles.meta}>No completed image is waiting to be applied. Invalidated or failed generations are not retained.</p>
                ) : (
                  <div className={styles.picker}>
                    {readyImages.map((item) => {
                      const applied = selected.selectedAssetId === item.id;
                      return (
                        <figure key={item.id} className={styles.pick} data-retained-image={item.id} data-retained-applied={applied ? "true" : "false"}>
                          {businessId && item.blobId ? (
                            <img src={assetUrl(businessId, item.id)} alt="" />
                          ) : null}
                          <p className={styles.meta}>{applied ? "Applied" : "Unapplied"}</p>
                          <button
                            className="btn btn-ghost btn-compact"
                            type="button"
                            data-apply-retained={item.id}
                            disabled={applied || saving}
                            onClick={() => void applyRetained(item.id)}
                          >
                            {applied ? "Already applied" : "Apply to draft"}
                          </button>
                        </figure>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : null}
            {assets.filter((item) => item.status === "pending" || item.status === "failed").length ? (
              <p className={styles.meta}>
                {assets.filter((item) => item.status === "pending" || item.status === "failed").length} pending or
                failed generation(s) — those are not retained images.
              </p>
            ) : null}
          </details>
          <details className={styles.sheet}>
            <summary>Brand</summary>
            <label className={styles.label} htmlFor="logo">
              Add original logo
            </label>
            <input
              id="logo"
              className={styles.file}
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadLogo(file);
              }}
            />
            <label className={styles.label} htmlFor="logo-x">
              Logo placement
            </label>
            <input className={styles.range} aria-label="Logo X" type="range" min={2} max={80} value={logoX} onChange={(event) => markDirty(setLogoX)(Number(event.target.value))} />
            <input className={styles.range} aria-label="Logo Y" type="range" min={2} max={88} value={logoY} onChange={(event) => markDirty(setLogoY)(Number(event.target.value))} />
            <p className={styles.meta}>Business palette stays on the artwork. Atelier chrome does not recolor the export.</p>
          </details>
          <details className={styles.sheet} open>
            <summary>Layout</summary>
            <label className={styles.label} htmlFor="studio-layout">
              Layout
            </label>
            <select
              id="studio-layout"
              className={styles.select}
              value={layout}
              onChange={(event) => markDirty(setLayout)(event.target.value as StudioLayoutId)}
            >
              {LAYOUTS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label} · {item.purpose}
                </option>
              ))}
            </select>
          </details>
          <div className={styles.primaryActions}>
            <button className="btn btn-ghost btn-compact" type="button" onClick={() => void createDraft()}>
              New draft
            </button>
            <button className="btn btn-gold" type="button" onClick={() => void saveLayers()} disabled={!selected || saving}>
              {saving ? "Saving…" : dirty ? "Save layers" : "Saved"}
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => void generate()} disabled={!selected || generating}>
              {generating ? "Generating…" : "Generate image"}
            </button>
            <button
              className="btn btn-ghost btn-compact"
              type="button"
              onClick={() => void generate(selected?.selectedAssetId)}
              disabled={!selected?.selectedAssetId || generating}
            >
              Edit selected image
            </button>
            <button className="btn btn-emerald-glass" type="button" onClick={() => void exportDraft()} disabled={!selected || exporting}>
              {exporting ? "Exporting…" : "Export"}
            </button>
          </div>
        </aside>
      </div>
    </CompanionShell>
  );
}

async function renderComposition(spec: CompositionSpec, canvas: HTMLCanvasElement) {
  canvas.width = spec.width;
  canvas.height = spec.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser could not compose the export canvas.");
  if (document.fonts?.ready) await document.fonts.ready;
  ctx.fillStyle = spec.palette.canvas;
  ctx.fillRect(0, 0, spec.width, spec.height);
  if (spec.backgroundImageUrl) {
    const image = await loadImage(spec.backgroundImageUrl);
    const crop = coverCropRect(
      image.naturalWidth || image.width,
      image.naturalHeight || image.height,
      spec.width,
      spec.height,
      spec.crop.x,
      spec.crop.y,
      spec.crop.zoom
    );
    ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height);
  }
  ctx.fillStyle = spec.headline.color;
  ctx.font = compositionCssFont(spec.headline);
  ctx.textBaseline = "top";
  const headlineWidth = (spec.headline.width / 100) * spec.width;
  const headlineX = (spec.headline.x / 100) * spec.width;
  const headlineY = (spec.headline.y / 100) * spec.height;
  const headlineLines = wrapLines(spec.headline.text, headlineWidth, (value) => ctx.measureText(value).width);
  headlineLines.forEach((line, index) => {
    ctx.fillText(line, headlineX, headlineY + index * spec.headline.fontSize * spec.headline.lineHeight);
  });
  ctx.fillStyle = spec.body.color;
  ctx.font = compositionCssFont(spec.body);
  const bodyWidth = (spec.body.width / 100) * spec.width;
  const bodyX = (spec.body.x / 100) * spec.width;
  const bodyY = (spec.body.y / 100) * spec.height;
  const bodyLines = wrapLines(spec.body.text, bodyWidth, (value) => ctx.measureText(value).width);
  bodyLines.forEach((line, index) => {
    ctx.fillText(line, bodyX, bodyY + index * spec.body.fontSize * spec.body.lineHeight);
  });
  if (spec.logo) {
    const logo = await loadImage(spec.logo.src);
    const boxW = (spec.logo.width / 100) * spec.width;
    const boxH = (spec.logo.height / 100) * spec.height;
    const scale = Math.min(boxW / logo.width, boxH / logo.height);
    const drawW = logo.width * scale;
    const drawH = logo.height * scale;
    ctx.drawImage(logo, (spec.logo.x / 100) * spec.width, (spec.logo.y / 100) * spec.height, drawW, drawH);
  }
  return canvas;
}

async function composePng(spec: CompositionSpec, canvas: HTMLCanvasElement | null) {
  const target = await renderComposition(spec, canvas ?? document.createElement("canvas"));
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
