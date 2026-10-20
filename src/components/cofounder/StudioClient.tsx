"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BrandDirectionImport } from "@/components/cofounder/BrandDirectionImport";
import { renderComposition } from "@/lib/cofounder/renderComposition";
import { CompanionShell } from "@/components/cofounder/CompanionShell";
import { api } from "@/lib/client/api";
import { actionErrorMessage } from "@/lib/client/asyncAction";
import { ownerFence } from "@/lib/client/ownerFence";
import { useSession } from "@/components/shell/SessionShell";
import {
  assetUrl,
  buildComposition,
  documentUrl,
  layersFromControls,
  paletteForProfile,
  previewScale,
  scaleCompositionPx,
  studioLayouts,
  type BrandPalette,
  type CompositionSpec
} from "@/lib/cofounder/composition";
import { resolveStudioOpen, selectedWorkText } from "@/lib/cofounder/studioOpen";
import type { BusinessProfile, StudioAsset, StudioDraft, StudioLayoutId, WorkItem } from "@/lib/cofounder/types";
import styles from "./companion.module.css";
import stage from "./studioStage.module.css";
import { CompositionStudy } from "./CompositionStudy";
import { isStudioBackgroundAsset, studioAssetKind } from "@/lib/cofounder/studioAssets";

const LAYOUTS = studioLayouts();

export function StudioClient() {
  const { user, generation } = useSession();
  const search = useSearchParams();
  const [phase, setPhase] = useState<"checking" | "ready" | "error">("checking");
  const [mode, setMode] = useState<"refine" | "collection" | "identity">("refine");
  const [panel, setPanel] = useState("Content");
  const [compareSaved, setCompareSaved] = useState(false);
  const [kept, setKept] = useState<string[]>([]);
  const [businessId, setBusinessId] = useState<string>();
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [drafts, setDrafts] = useState<StudioDraft[]>([]);
  const [assets, setAssets] = useState<StudioAsset[]>([]);
  const [current, setCurrent] = useState<StudioDraft | null>(null);
  const [headline, setHeadline] = useState("");
  const [body, setBody] = useState("");
  const [direction, setDirection] = useState("");
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
  const [logoAssetId, setLogoAssetId] = useState<string | undefined>();
  const [logoDocumentId, setLogoDocumentId] = useState<string | undefined>();
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const generateKeyRef = useRef<string | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewBoxRef = useRef<HTMLDivElement | null>(null);
  const [previewWidth, setPreviewWidth] = useState(0);

  function hydrate(draft: StudioDraft | null) {
    setCurrent(draft);
    setKept((previous) => current?.id === draft?.id ? previous : []);
    setCompareSaved(false);
    setDirection(draft?.direction ?? "");
    setHeadline(draft?.layers.find((layer) => layer.kind === "headline")?.text ?? "");
    setBody(draft?.layers.find((layer) => layer.kind === "body")?.text ?? "");
    setLayout(draft?.layout ?? "square_announcement");
    const logo = draft?.layers.find((layer) => layer.kind === "logo");
    setLogoX(logo?.x ?? 8);
    setLogoY(logo?.y ?? 80);
    setLogoDocumentId(logo?.documentId);
    setLogoAssetId(logo?.assetId);
    const image = draft?.layers.find((layer) => layer.kind === "image");
    setCropX(image?.cropX ?? 50);
    setCropY(image?.cropY ?? 50);
    setCropZoom(image?.cropZoom ?? 1);
    setDirty(false);
  }

  async function refresh(gen = generation, restoreDraft = true) {
    if (restoreDraft) setPhase("checking");
    const workspace = await api<{
      business: { id: string; name: string };
      rawProfile?: BusinessProfile;
      confirmation?: { studioDraftId?: string | null } | null;
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
    if (!restoreDraft) {
      setPhase("ready");
      return;
    }
    const requestedDraft = search.get("draftId") || workspace.confirmation?.studioDraftId || null;
    const requestedWork = search.get("workItemId");
    if (!requestedDraft && !requestedWork) {
      if (current) {
        const latest = data.drafts.find((item) => item.id === current.id);
        if (latest && latest.updatedAt !== current.updatedAt) hydrate(latest);
      }
      setPhase("ready");
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
      setPhase("ready");
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
      setPhase("ready");
      return;
    }
    if (resolved.kind === "error") {
      setError(resolved.message);
      setRecovery(resolved.recovery);
      hydrate(null);
      setPhase("error");
      return;
    }
    setPhase("ready");
  }

  useEffect(() => {
    if (!user) return;
    void refresh().catch((err) => {
      setError(actionErrorMessage(err, "Studio could not load."));
      setPhase("error");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generation, user?.id, search.get("workItemId"), search.get("draftId")]);

  const selected = current;
  const backgroundUrl =
    selected?.selectedAssetId && businessId ? assetUrl(businessId, selected.selectedAssetId) : "";
  const logoUrl = businessId ? (logoDocumentId ? documentUrl(businessId, logoDocumentId) : logoAssetId ? assetUrl(businessId, logoAssetId) : "") : "";
  const palette: BrandPalette | undefined = current?.palette ?? (current?.brandKit?.mode === "new_brand" ? undefined : profile ? paletteForProfile(profile, current ? current.layoutVersion ?? 1 : 2) : undefined);

  const liveLayers = useMemo(
    () =>
      layersFromControls({
        headline,
        body,
        layout,
        designSpec: current?.brandKit?.designSpec,
        layoutVersion: current ? current.layoutVersion ?? 1 : 2,
        logoDocumentId,
        logoAssetId,
        logoX,
        logoY,
        cropX,
        cropY,
        cropZoom
      }),
    [current, headline, body, layout, logoDocumentId, logoAssetId, logoX, logoY, cropX, cropY, cropZoom]
  );

  const composition = useMemo(() => {
    if (!businessId) return null;
    return buildComposition({
      layout,
      layers: liveLayers,
      businessId,
      palette,
      profile,
      designSpec: current?.brandKit?.designSpec,
      layoutVersion: current ? current.layoutVersion ?? 1 : 2,
      backgroundImageUrl: backgroundUrl || null,
      logoUrl: logoUrl || null
    });
  }, [current, businessId, layout, liveLayers, palette, profile, backgroundUrl, logoUrl]);

  const collection = useMemo(() => {
    if (!businessId || !composition) return [];
    return (["square_announcement", "website_banner", "direction_board"] as StudioLayoutId[]).map((format) => ({
      format, label: LAYOUTS.find((item) => item.id === format)!.label,
      spec: buildComposition({ layout: format, businessId, profile, palette,
        designSpec: current?.brandKit?.designSpec, layoutVersion: current ? current.layoutVersion ?? 1 : 2,
        layers: layersFromControls({ headline, body, layout: format, designSpec: current?.brandKit?.designSpec,
          layoutVersion: current ? current.layoutVersion ?? 1 : 2, logoDocumentId, logoAssetId, logoX, logoY, cropX, cropY, cropZoom }),
        backgroundImageUrl: backgroundUrl || null, logoUrl: logoUrl || null })
    }));
  }, [businessId, composition, current, profile, palette, headline, body, logoDocumentId, logoAssetId, logoX, logoY, cropX, cropY, cropZoom, backgroundUrl, logoUrl]);
  const savedComposition = useMemo(() => current && businessId ? buildComposition({
    layout: current.layout, layers: current.layers, businessId, profile, palette: current.palette,
    designSpec: current.brandKit?.designSpec, layoutVersion: current.layoutVersion ?? 1,
    backgroundImageUrl: current.selectedAssetId ? assetUrl(businessId, current.selectedAssetId) : null,
    logoUrl: (() => { const logo = current.layers.find((item) => item.kind === "logo");
      return logo?.documentId ? documentUrl(businessId, logo.documentId) : logo?.assetId ? assetUrl(businessId, logo.assetId) : null; })()
  }) : null, [current, businessId, profile]);
  function focusPanel(name: string) {
    setPanel(name); setMode("refine");
  }

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
    let cancelled = false;
    const target = previewCanvasRef.current;
    target.dataset.renderState = "pending";
    void renderComposition(composition, document.createElement("canvas")).then((rendered) => {
      if (cancelled) return;
      target.width = rendered.width;
      target.height = rendered.height;
      target.getContext("2d")?.drawImage(rendered, 0, 0);
      target.dataset.renderState = "ready";
    }).catch((err) => {
      if (!cancelled) {
        target.dataset.renderState = "error";
        target.width = 0;
        target.height = 0;
        setError(actionErrorMessage(err, "Preview could not render. Adjust the copy or retry."));
      }
    });
    return () => { cancelled = true; };
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
        designSpec: current?.brandKit?.designSpec,
        layoutVersion: current ? current.layoutVersion ?? 1 : 2,
        logoDocumentId: explicitLogoId,
        logoAssetId: explicitLogoId ? undefined : logoAssetId,
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
          direction,
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
      const composedPngBase64 = await composePng(composition);
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
    if (!selected || !businessId || saving || exporting || generating) return;
    const latest = dirty ? await saveLayers() : selected;
    if (!latest) return;
    setSaving(true);
    setError("");
    setRecovery("");
    try {
      const result = await api<{ draft: StudioDraft }>("/api/companion/studio/apply", {
        method: "POST",
        body: JSON.stringify({
          businessId,
          draftId: latest.id,
          assetId,
          expectedSaveRevision: latest.saveRevision,
          expectedUpdatedAt: latest.updatedAt
        })
      });
      hydrate(result.draft);
      await refresh(generation, false);
      setStatus("Retained image applied to the current draft. Newer text and layout were kept.");
    } catch (err) {
      setError(actionErrorMessage(err, "The retained image could not be applied. Newer draft edits were kept."));
      setRecovery("Reload the newer revision, then apply the image again. The file itself was not deleted.");
    } finally {
      setSaving(false);
    }
  }

  async function removeFlattenedBackground() {
    if (!current || saving) return;
    const latest = dirty ? await saveLayers() : current;
    if (!latest) return;
    setSaving(true); setError("");
    try {
      const result = await api<{ draft: StudioDraft }>("/api/companion/studio", {
        method: "PATCH", body: JSON.stringify({ businessId, draftId: latest.id, selectedAssetId: "",
          expectedSaveRevision: latest.saveRevision, expectedUpdatedAt: latest.updatedAt })
      });
      hydrate(result.draft); await refresh(generation, false); setStatus("Flattened background removed. Original export remains available.");
    } catch (err) { setError(actionErrorMessage(err, "Background could not be removed. Reload and retry.")); }
    finally { setSaving(false); }
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
    setLogoAssetId(undefined);
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
    ? assets.filter((item) => item.draftId === selected.id && isStudioBackgroundAsset(item))
    : [];

  if (phase === "checking") {
    return (
      <CompanionShell
        wide
        title="Brand Studio"
        lede="Checking the signed-in owner and the confirmed composition before any draft is shown."
      >
        <p className="notice">Resolving authorization and the exact Studio draft…</p>
      </CompanionShell>
    );
  }

  if (phase === "error" && !current) {
    return (
      <CompanionShell
        wide
        title="Brand Studio"
        lede="Studio could not verify this workspace or the requested composition."
      >
        <p className="notice notice-warn">{error || "Studio could not load."}</p>
        {recovery ? <p className={styles.meta}>{recovery}</p> : null}
        <button
          className="btn btn-gold"
          type="button"
          onClick={() => {
            setPhase("checking");
            void refresh().catch((err) => {
              setError(actionErrorMessage(err, "Studio could not load."));
              setPhase("error");
            });
          }}
        >
          Retry Studio
        </button>
      </CompanionShell>
    );
  }

  return (
    <CompanionShell
      wide
      compact
      title="Brand Studio"
      lede="The artwork is the stage. Import exact Talk copy, place the real logo, and export only after this revision is saved."
    >
      <div className={stage.workspace}>
      <div className={stage.workbar}>
        <div data-project-name={profile?.fields.name.value ?? ""}><strong>{profile?.fields.name.value || "Your brand"}</strong><span>{current?.brandKit?.designSpec.directionId ?? "Personal composition"} · {saveState || "Start a draft"}</span></div>
        <nav aria-label="Creative workspace" className={stage.modeSwitch}>
          <button type="button" aria-pressed={mode === "identity"} onClick={() => setMode("identity")}>Direction</button>
          <button type="button" aria-pressed={mode === "refine"} onClick={() => setMode("refine")}>Refine</button>
          <button type="button" aria-pressed={mode === "collection"} onClick={() => setMode("collection")}>Collection</button>
        </nav>
      </div>
      {mode === "identity" ? <section className={stage.identity} aria-label="Choose identity">
        <div><span className={stage.eyebrow}>Your foundation</span><h2>{current?.brandKit?.mode === "existing_brand" ? "Build on your identity." : "A direction worth making your own."}</h2><p>Compare rendered directions in Discovery. Lock a choice for new work; this saved artwork keeps its own identity.</p><a href="/discover" className="btn btn-emerald-glass">Compare directions</a></div>
        <BrandDirectionImport businessId={businessId} onAdopt={() => { void refresh(); setStatus("Brand direction saved. Create a new draft to use it; existing artifacts retain their saved identity."); }} />
      </section> : null}
      <div className={`${styles.studioDesk} ${stage.desk}`} data-mode={mode}>

        <section className={`${styles.artboard} ${stage.stage} on-glass`} aria-label="Artwork stage">
          {assets.some((item) => item.id === selected?.selectedAssetId && studioAssetKind(item) === "composition_export") ? <div className="notice notice-warn">This older draft uses a flattened export as its background. Remove it to keep lettering separate.<button type="button" className="btn btn-gold" disabled={saving} onClick={() => void removeFlattenedBackground()}>Remove flattened background</button></div> : null}
          <div className={stage.stageTop}><span className={stage.eyebrow}>{mode === "collection" ? "One identity · three applications" : "Your working artboard"}</span><button className={stage.compare} type="button" disabled={!current} aria-pressed={compareSaved} onClick={() => { setCompareSaved(!compareSaved); if (mode === "collection") setMode("refine"); }}>{compareSaved ? "Close comparison" : "Compare saved"}</button></div>
          <div className={stage.formatRail} aria-label="Artifact format">{LAYOUTS.filter((item) => ["square_announcement", "website_banner", "direction_board"].includes(item.id)).map((item) => <button key={item.id} type="button" aria-pressed={layout === item.id} disabled={kept.includes("Layout") || saving || exporting} onClick={() => { markDirty(setLayout)(item.id); setMode("refine"); }}>{item.label}</button>)}</div>
          <div className={stage.mount} data-compare={compareSaved}>
          {compareSaved && savedComposition ? <figure className={stage.before}><figcaption>Last saved · {current?.layout}</figcaption><CompositionStudy spec={savedComposition} label="Last saved composition" /></figure> : null}
          <div className={stage.working}><span className={stage.artLabel}>{dirty ? "Working edit" : "Saved artwork"}</span>
          <div
            ref={previewBoxRef}
            className={`${styles.canvas} ${stage.canvas}`}
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
              background: composition?.palette.canvas ?? "#f4f0e6"
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
          </div></div>
          <div className={stage.toolDock} aria-label="Select an element">{["Content", "Image", "Brand", "Layout"].map((name) => <button key={name} type="button" aria-pressed={panel === name && mode === "refine"} onClick={() => focusPanel(name)}>{name === "Content" ? "Aa · Text" : name === "Image" ? "◈ · Image" : name === "Brand" ? "◇ · Logo" : "▣ · Format"}</button>)}</div>
          <div className={stage.collection} data-expanded={mode === "collection"} aria-label="Coordinated artifact previews">{collection.map((item) => <button key={item.format} type="button" className={stage.study} aria-pressed={layout === item.format} disabled={kept.includes("Layout") || saving || exporting} onClick={() => { markDirty(setLayout)(item.format); setMode("refine"); }}><span className={stage.studyCanvas}><CompositionStudy spec={item.spec} label={`${item.label} live collection preview`} /></span><span>{item.label}<small>{layout === item.format ? "On stage" : "Open & edit"}</small></span></button>)}</div>
          <div className={stage.stageActions}><button className="btn btn-gold" type="button" onClick={() => void saveLayers()} disabled={!selected || saving}>{saving ? "Saving…" : dirty ? "Save layers" : "Saved"}</button><button className="btn btn-emerald-glass" type="button" onClick={() => void exportDraft()} disabled={!selected || exporting}>{exporting ? "Exporting…" : "Export"}</button><button className={stage.compare} type="button" disabled={!current || !dirty} onClick={() => { hydrate(current); setStatus("Restored the last saved composition."); }}>Reset edits</button></div>
          <p className={styles.meta} role="status">{status}</p>
          {error ? <p className="notice notice-warn">{error}</p> : null}
          {recovery ? <p className={styles.meta}>{recovery}</p> : null}
        </section>
        <aside className={`${styles.inspector} ${stage.inspector} on-glass`} aria-label="Refine artwork">
          <div className={stage.inspectorHead}><div><span className={stage.eyebrow}>Refine this artwork</span><h2>{panel === "Brand" ? "Original identity" : panel}</h2></div><button type="button" className={stage.compare} aria-pressed={kept.includes(panel)} onClick={() => setKept(kept.includes(panel) ? kept.filter((name) => name !== panel) : [...kept, panel])}>{kept.includes(panel) ? "Unlock" : "Keep this"}</button></div>
          <p className={stage.scope}>{kept.includes(panel) ? "Kept while editing. Unlock to change these controls." : "Artwork only. Other saved work stays unchanged."}</p>
          <fieldset className={stage.controls} disabled={kept.includes(panel) || saving || exporting}>

          <details className={styles.sheet} open hidden={panel !== "Content"}>
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
          <details className={styles.sheet} open hidden={panel !== "Image"}>
            <summary>Image</summary>
            <label className={styles.label} htmlFor="direction">
              Image direction
            </label>
            <textarea id="direction" className={styles.field} value={direction} onChange={(event) => { setDirection(event.target.value); setDirty(true); }} />
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
                            disabled={applied || saving || exporting || generating}
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
            {assets.some((item) => item.draftId === selected?.id && studioAssetKind(item) === "composition_export") ? <details><summary>Composition exports · download only</summary>{assets.filter((item) => item.draftId === selected?.id && studioAssetKind(item) === "composition_export" && item.blobId).map((item) => <a key={item.id} className="btn btn-ghost btn-compact" href={assetUrl(businessId!, item.id)} download>Download exported revision {item.revision}</a>)}</details> : null}
            {assets.filter((item) => item.status === "pending" || item.status === "failed").length ? (
              <p className={styles.meta}>
                {assets.filter((item) => item.status === "pending" || item.status === "failed").length} pending or
                failed generation(s) — those are not retained images.
              </p>
            ) : null}
          </details>
          <details className={styles.sheet} open hidden={panel !== "Brand"}>
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
          <details className={styles.sheet} open hidden={panel !== "Layout"}>
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
          </fieldset>
          <div className={`${styles.primaryActions} ${stage.secondaryActions}`}>
            <button className="btn btn-ghost btn-compact" type="button" disabled={saving || exporting || generating} onClick={() => void createDraft()}>
              New draft
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => void generate()} disabled={!selected || generating || kept.includes("Image")}>
              {generating ? "Generating…" : "Generate image"}
            </button>
            <button
              className="btn btn-ghost btn-compact"
              type="button"
              onClick={() => void generate(selected?.selectedAssetId)}
              disabled={!selected?.selectedAssetId || generating || kept.includes("Image")}
            >
              Edit selected image
            </button>

          </div>
        </aside>
      </div>
      <details className={stage.provenance}><summary>Identity & source · Curated study, no live AI</summary><p>{current?.brandKit ? `Saved identity revision ${current.brandKit.revision} · layout v${current.layoutVersion ?? 1} · ${current.brandKit.mode === "existing_brand" ? "Existing brand continued" : "New brand direction"}` : "Create a draft to save your composition."}. Collection previews use this artwork’s copy, imagery and identity. Open a format and save to retain that artifact. “Keep this” protects controls during this editing session; saved identity assets remain in the business profile.</p></details>
      </div>
    </CompanionShell>
  );
}

async function composePng(spec: CompositionSpec) {
  // Match preview rasterization without inheriting CSS text styles from a mounted canvas.
  const target = await renderComposition(spec, document.createElement("canvas"));
  const data = target.toDataURL("image/png");
  return data.replace(/^data:image\/png;base64,/, "");
}
