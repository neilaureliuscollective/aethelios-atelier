import { CompanionWorkspace } from "@/lib/cofounder/workspace";
import { CompanionWork } from "@/lib/cofounder/work";
import { CompanionUsage, usageAttempt, type UsageReservation } from "@/lib/cofounder/usage";
import { buildComposition, defaultLayers, paletteForProfile, studioLayouts, STUDIO_LAYOUTS } from "@/lib/cofounder/composition";
import { assertExportMatchesRevision, hashPng } from "@/lib/cofounder/png";
import { selectedWorkText } from "@/lib/cofounder/studioOpen";
import { aureliusStatus } from "@/lib/aurelius/boundary";
import { loadConfig } from "@/lib/config";
import { ConflictError, ForbiddenError, LimitError, NotFoundError } from "@/lib/domain/errors";
import type { PersistenceAdapter } from "@/lib/persistence/adapter";
import {
  COMPOSITION_RENDERER_VERSION,
  type CompositionRevision,
  type GenerationJob,
  type StudioAsset,
  type StudioDraft,
  type StudioLayer,
  type StudioLayoutId
} from "@/lib/cofounder/types";
import type { AuthContext, User } from "@/lib/types";

export { studioLayouts, STUDIO_LAYOUTS };

function now() {
  return new Date().toISOString();
}

function nextStamp(previous?: string) {
  const stamp = now();
  if (!previous || stamp > previous) return stamp;
  return new Date(Date.parse(previous) + 1).toISOString();
}

function concurrencyToken(
  draft: StudioDraft,
  patch: { expectedUpdatedAt?: string; expectedSaveRevision?: number }
) {
  if (patch.expectedSaveRevision == null && !patch.expectedUpdatedAt) {
    throw new ConflictError("This Studio draft requires a concurrency token. Reload and save again.");
  }
  if (patch.expectedSaveRevision != null && patch.expectedSaveRevision !== draft.saveRevision) {
    throw new ConflictError("This Studio draft changed since you last edited it. Reload the newer revision before saving.");
  }
  if (patch.expectedUpdatedAt && patch.expectedUpdatedAt !== draft.updatedAt) {
    throw new ConflictError("This Studio draft changed since you last edited it. Reload the newer revision before saving.");
  }
  return draft.saveRevision ?? 1;
}

function companionId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

export type ImageProvider = {
  generate(input: { prompt: string; signal?: AbortSignal }): Promise<{ bytes: Uint8Array; mime: string; model: string }>;
  edit(input: {
    prompt: string;
    image: Uint8Array;
    mime: string;
    signal?: AbortSignal;
  }): Promise<{ bytes: Uint8Array; mime: string; model: string }>;
};

export class UnavailableImageProvider implements ImageProvider {
  async generate(): Promise<{ bytes: Uint8Array; mime: string; model: string }> {
    throw new LimitError(
      "Image generation is unavailable. ATELIER_OPENAI_ENABLED and OPENAI_API_KEY must both be set. This is not a completed asset."
    );
  }
  async edit(): Promise<{ bytes: Uint8Array; mime: string; model: string }> {
    return this.generate();
  }
}

export class OpenAiImageProvider implements ImageProvider {
  private model() {
    return process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
  }

  async generate(input: { prompt: string; signal?: AbortSignal }) {
    const config = loadConfig();
    const OpenAI = (await import("openai")).default;
    const client = new OpenAI({ apiKey: config.openAiKey, timeout: config.openAiTimeoutMs });
    const model = this.model();
    const result = await client.images.generate(
      {
        model,
        prompt: input.prompt,
        size: "1024x1024"
      },
      { signal: input.signal }
    );
    const first = result.data?.[0];
    if (first?.b64_json) {
      return { bytes: Uint8Array.from(Buffer.from(first.b64_json, "base64")), mime: "image/png", model };
    }
    throw new Error("Image provider returned no image bytes. Remote image URLs are not fetched.");
  }

  async edit(input: { prompt: string; image: Uint8Array; mime: string; signal?: AbortSignal }) {
    const config = loadConfig();
    const OpenAI = (await import("openai")).default;
    const client = new OpenAI({ apiKey: config.openAiKey, timeout: config.openAiTimeoutMs });
    const model = this.model();
    const { toFile } = await import("openai");
    const file = await toFile(Buffer.from(input.image), "source.png", { type: input.mime || "image/png" });
    const result = await client.images.edit(
      {
        model,
        image: file,
        prompt: input.prompt
      },
      { signal: input.signal }
    );
    const first = result.data?.[0];
    if (first?.b64_json) {
      return { bytes: Uint8Array.from(Buffer.from(first.b64_json, "base64")), mime: "image/png", model };
    }
    throw new Error("Image edit returned no image bytes.");
  }
}

export class FixtureImageProvider implements ImageProvider {
  constructor(private readonly bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])) {}
  async generate() {
    return { bytes: this.bytes, mime: "image/png", model: "fixture" };
  }
  async edit() {
    return this.generate();
  }
}

export class FailingImageProvider implements ImageProvider {
  async generate(): Promise<{ bytes: Uint8Array; mime: string; model: string }> {
    throw new Error("provider_down");
  }
  async edit(): Promise<{ bytes: Uint8Array; mime: string; model: string }> {
    throw new Error("provider_down");
  }
}

const LAYOUTS = STUDIO_LAYOUTS;

export class CompanionStudio {
  private finalizeBarrier?: () => Promise<void>;

  constructor(
    private readonly store: PersistenceAdapter,
    private readonly workspace = new CompanionWorkspace(store),
    private readonly work = new CompanionWork(store),
    private readonly usage = new CompanionUsage(store),
    private readonly images: ImageProvider = aureliusStatus().ready
      ? new OpenAiImageProvider()
      : new UnavailableImageProvider()
  ) {}

  withImageProvider(provider: ImageProvider) {
    return new CompanionStudio(this.store, this.workspace, this.work, this.usage, provider);
  }

  withFinalizeBarrier(barrier?: () => Promise<void>) {
    this.finalizeBarrier = barrier;
    return this;
  }

  async createFromCopy(
    businessId: string,
    user: User,
    input: {
      headline: string;
      body?: string;
      direction?: string;
      layout?: StudioLayoutId;
      workItemId?: string;
    }
  ) {
    const context = await this.workspace.requireMutable(businessId, user);
    const source = input.workItemId ? await this.work.get(businessId, user, input.workItemId) : null;
    const selectedBody = input.body ?? "";
    const workItem = await this.work.saveDraft(businessId, user, {
      title: `Studio: ${input.headline}`.slice(0, 160),
      body: selectedBody,
      kind: "announcement",
      workItemId: undefined
    });
    const logo = context.profile.brandAssets.find((asset) => asset.kind === "logo");
    const layers = defaultLayers({
      headline: input.headline,
      body: selectedBody,
      layout: input.layout,
      logoDocumentId: logo?.documentId,
      logoAssetId: logo?.assetId
    });
    const draft: StudioDraft = {
      id: companionId("studio"),
      businessId,
      workItemId: workItem.id,
      layout: input.layout ?? "square_announcement",
      layers,
      sourceWorkItemId: source?.id,
      saveRevision: 1,
      createdAt: now(),
      updatedAt: now()
    };
    await this.store.companion.addStudioDraft(draft);
    return { draft, workItem, direction: input.direction ?? "" };
  }

  async updateDraft(
    businessId: string,
    user: User,
    draftId: string,
    patch: Partial<Pick<StudioDraft, "layout" | "layers" | "selectedAssetId">> & {
      expectedUpdatedAt?: string;
      expectedSaveRevision?: number;
    }
  ) {
    await this.workspace.requireMutable(businessId, user);
    const draft = await this.requireDraft(businessId, draftId);
    const token = concurrencyToken(draft, patch);
    const written = {
      ...draft,
      ...(patch.layout ? { layout: patch.layout } : {}),
      ...(patch.layers ? { layers: patch.layers } : {}),
      ...(patch.selectedAssetId !== undefined ? { selectedAssetId: patch.selectedAssetId } : {}),
      saveRevision: token + 1,
      updatedAt: nextStamp(draft.updatedAt)
    };
    const swapped = await this.store.companion.compareAndSwapStudioDraft(written, token);
    if (!swapped) {
      throw new ConflictError("This Studio draft changed since you last edited it. Reload the newer revision before saving.");
    }
    return swapped;
  }

  async applyAsset(
    businessId: string,
    user: User,
    draftId: string,
    assetId: string,
    token: { expectedUpdatedAt?: string; expectedSaveRevision?: number }
  ) {
    await this.workspace.requireMutable(businessId, user);
    const draft = await this.requireDraft(businessId, draftId);
    const asset = await this.store.companion.getStudioAsset(assetId);
    if (!asset || asset.businessId !== businessId) {
      throw new ForbiddenError("That image is not part of this workspace.");
    }
    if (asset.draftId !== draft.id) {
      throw new ForbiddenError("That image belongs to a different Studio draft.");
    }
    if (asset.status !== "ready" || !asset.blobId) {
      throw new ForbiddenError(
        asset.status === "invalidated"
          ? "That generation was invalidated and its bytes were never stored as a retained image."
          : "That image is not a completed retained result."
      );
    }
    const blob = await this.store.companion.getBlob(asset.blobId);
    if (!blob || blob.businessId !== businessId) {
      throw new ForbiddenError("That image bytes are not available in this workspace.");
    }
    return this.updateDraft(businessId, user, draftId, {
      selectedAssetId: asset.id,
      expectedUpdatedAt: token.expectedUpdatedAt,
      expectedSaveRevision: token.expectedSaveRevision
    });
  }

  async listDraftAssets(businessId: string, user: User, draftId?: string) {
    await this.workspace.requireMembership(businessId, user);
    const assets = await this.store.companion.listStudioAssets(businessId);
    return assets.filter((asset) => (draftId ? asset.draftId === draftId : true));
  }

  async listDrafts(businessId: string, user: User) {
    await this.workspace.requireMembership(businessId, user);
    return this.store.companion.listStudioDrafts(businessId);
  }

  async getDraft(businessId: string, user: User, draftId: string) {
    await this.workspace.requireMembership(businessId, user);
    return this.requireDraft(businessId, draftId);
  }

  async generate(
    businessId: string,
    user: User,
    auth: AuthContext,
    input: {
      draftId: string;
      prompt: string;
      idempotencyKey: string;
      sourceAssetId?: string;
      signal?: AbortSignal;
    }
  ): Promise<{ asset: StudioAsset; applied: boolean; draft: StudioDraft; conflict?: boolean }> {
    await this.workspace.requireMutable(businessId, user);
    const draft = await this.requireDraft(businessId, input.draftId);
    const existing = await this.store.companion.getJobByIdempotency(businessId, input.idempotencyKey);
    if (existing?.status === "completed" && existing.resultJson) {
      const parsed = JSON.parse(existing.resultJson) as { assetId?: string };
      if (parsed.assetId) {
        const asset = await this.store.companion.getStudioAsset(parsed.assetId);
        if (asset) {
          return { asset, applied: draft.selectedAssetId === asset.id, draft };
        }
      }
    }
    if (existing?.status === "pending") {
      throw new ForbiddenError("That generation is already in progress. Wait or retry the same request after it finishes.");
    }
    const reservation = await this.usage.reserve(
      businessId,
      user,
      "image",
      1,
      {
        draftId: draft.id,
        idempotencyKey: input.idempotencyKey,
        inputSaveRevision: draft.saveRevision
      },
      input.idempotencyKey
    );
    if (reservation.reused) {
      if (reservation.event.status === "settled") {
        const existingCompleted = await this.store.companion.getJobByIdempotency(businessId, input.idempotencyKey);
        if (existingCompleted?.resultJson) {
          const parsed = JSON.parse(existingCompleted.resultJson) as { assetId?: string };
          if (parsed.assetId) {
            const reused = await this.store.companion.getStudioAsset(parsed.assetId);
            if (reused) return { asset: reused, applied: draft.selectedAssetId === reused.id, draft };
          }
        }
        throw new ForbiddenError("That generation already completed. Retry will not start another provider call.");
      }
      throw new ForbiddenError("That generation is already in progress. Wait or retry the same request after it finishes.");
    }
    const attempt = usageAttempt(reservation.event);
    const job = existing
      ? await this.store.companion.updateJob({
          ...existing,
          status: "pending",
          sessionId: auth.session.id,
          updatedAt: now(),
          error: undefined,
          attempt
        })
      : await this.store.companion.addJob({
          id: companionId("job"),
          businessId,
          ownerId: user.id,
          sessionId: auth.session.id,
          kind: "image",
          status: "pending",
          idempotencyKey: input.idempotencyKey,
          createdAt: now(),
          updatedAt: now(),
          attempt
        });
    const parent = input.sourceAssetId ? await this.store.companion.getStudioAsset(input.sourceAssetId) : null;
    if (parent && parent.businessId !== businessId) {
      await this.usage.release(reservation);
      throw new ForbiddenError("That source image is not part of this workspace.");
    }
    const asset: StudioAsset = {
      id: companionId("asset"),
      businessId,
      workItemId: draft.workItemId,
      draftId: draft.id,
      status: "pending",
      prompt: input.prompt,
      revision: (await this.store.companion.listStudioAssets(businessId)).filter((item) => item.draftId === draft.id)
        .length + 1,
      parentId: parent?.id,
      createdAt: now(),
      updatedAt: now()
    };
    await this.store.companion.addStudioAsset(asset);
    try {
      const session = await this.store.getSession(auth.session.id);
      if (!session) {
        throw new ForbiddenError("Session expired before generation finished. The pending asset was not marked complete.");
      }
      const generated = parent?.blobId
        ? await this.editFromAsset(parent, input.prompt, input.signal)
        : await this.images.generate({ prompt: input.prompt, signal: input.signal });
      return this.finalizeGeneratedImage({
        businessId,
        auth,
        draft,
        expectedSaveRevision: draft.saveRevision ?? 1,
        job,
        reservation,
        attempt,
        asset,
        generated
      });
    } catch (error) {
      await this.failGeneratedImage(reservation, job, asset, attempt, error);
      throw error;
    }
  }

  private async finalizeGeneratedImage(input: {
    businessId: string;
    auth: AuthContext;
    draft: StudioDraft;
    expectedSaveRevision: number;
    job: GenerationJob;
    reservation: UsageReservation;
    attempt: number;
    asset: StudioAsset;
    generated: { bytes: Uint8Array; mime: string; model: string };
  }) {
    if (this.finalizeBarrier) await this.finalizeBarrier();
    return this.store.runInTransaction(async () => {
      const business = await this.store.companion.getBusiness(input.businessId);
      if (!business || business.id !== input.businessId) {
        throw new NotFoundError("Business workspace not found.");
      }
      const locked = await this.store.companion.lockStudioGeneration(
        input.job.id,
        input.reservation.event.id,
        input.draft.id
      );
      const jobNow = locked.job;
      const usageNow = locked.usage;
      const draftNow = locked.draft ?? input.draft;
      if (jobNow?.status === "completed" && (jobNow.attempt ?? 1) === input.attempt && jobNow.resultJson) {
        const parsed = JSON.parse(jobNow.resultJson) as { assetId?: string; applied?: boolean };
        if (parsed.assetId) {
          const existing = await this.store.companion.getStudioAsset(parsed.assetId);
          if (existing) {
            return {
              asset: existing,
              applied: draftNow.selectedAssetId === existing.id,
              draft: draftNow,
              conflict: draftNow.selectedAssetId !== existing.id
            };
          }
        }
      }
      const session = await this.store.getSession(input.auth.session.id);
      const jobOwnsAttempt = Boolean(jobNow) && (jobNow?.attempt ?? 1) === input.attempt;
      const usageOwnsHold =
        Boolean(usageNow) && usageAttempt(usageNow!) === input.attempt && usageNow?.status === "held";
      if (!jobNow || jobNow.status === "invalidated" || !session) {
        input.asset.status = "invalidated";
        input.asset.error = "Generation was invalidated after sign-out or account switch.";
        input.asset.updatedAt = now();
        await this.store.companion.updateStudioAsset(input.asset);
        if (usageOwnsHold) await this.usage.release(input.reservation);
        return { asset: input.asset, applied: false, draft: draftNow };
      }
      if (!jobOwnsAttempt || jobNow.status !== "pending" || !usageOwnsHold) {
        const ready = await this.retainReadyAsset(input.asset, input.generated);
        return { asset: ready, applied: false, draft: draftNow, conflict: true };
      }
      const ready = await this.retainReadyAsset(input.asset, input.generated);
      const completed = await this.store.companion.compareAndSwapJob(
        {
          ...jobNow,
          attempt: input.attempt,
          status: "completed",
          updatedAt: now(),
          resultJson: JSON.stringify({ assetId: ready.id, applied: false, attempt: input.attempt })
        },
        input.attempt,
        "pending"
      );
      if (!completed) {
        return { asset: ready, applied: false, draft: draftNow, conflict: true };
      }
      const settled = await this.usage.settle(input.reservation);
      if (usageAttempt(settled) !== input.attempt || settled.status !== "settled") {
        return { asset: ready, applied: false, draft: draftNow, conflict: true };
      }
      const attach = {
        ...draftNow,
        selectedAssetId: ready.id,
        saveRevision: (draftNow.saveRevision ?? 1) + 1,
        updatedAt: nextStamp(draftNow.updatedAt)
      };
      const swapped = await this.store.companion.compareAndSwapStudioDraft(attach, input.expectedSaveRevision);
      if (swapped) {
        await this.store.companion.compareAndSwapJob(
          {
            ...completed,
            status: "completed",
            updatedAt: now(),
            resultJson: JSON.stringify({ assetId: ready.id, applied: true, attempt: input.attempt })
          },
          input.attempt,
          "completed"
        );
      }
      return {
        asset: ready,
        applied: Boolean(swapped),
        draft: swapped ?? draftNow,
        conflict: !swapped
      };
    });
  }

  private async retainReadyAsset(
    asset: StudioAsset,
    generated: { bytes: Uint8Array; mime: string; model: string }
  ) {
    const blob = await this.store.companion.putBlob({
      id: companionId("blob"),
      businessId: asset.businessId,
      mime: generated.mime,
      bytes: generated.bytes,
      createdAt: now()
    });
    asset.status = "ready";
    asset.blobId = blob.id;
    asset.model = generated.model;
    asset.updatedAt = now();
    await this.store.companion.updateStudioAsset(asset);
    return asset;
  }

  private async failGeneratedImage(
    reservation: UsageReservation,
    job: GenerationJob,
    asset: StudioAsset,
    attempt: number,
    error: unknown
  ) {
    await this.store.runInTransaction(async () => {
      const locked = await this.store.companion.lockStudioGeneration(job.id, reservation.event.id, asset.draftId ?? "");
      if (locked.usage && usageAttempt(locked.usage) === attempt && locked.usage.status === "held") {
        await this.usage.release(reservation);
      }
      const currentAsset = (await this.store.companion.getStudioAsset(asset.id)) ?? asset;
      if (currentAsset.status === "pending") {
        currentAsset.status = "failed";
        currentAsset.error = error instanceof Error ? error.message : "Image generation failed.";
        currentAsset.updatedAt = now();
        await this.store.companion.updateStudioAsset(currentAsset);
        Object.assign(asset, currentAsset);
      }
      if (locked.job && (locked.job.attempt ?? 1) === attempt && locked.job.status === "pending") {
        await this.store.companion.compareAndSwapJob(
          {
            ...locked.job,
            attempt,
            status: "failed",
            updatedAt: now(),
            error: asset.error
          },
          attempt,
          "pending"
        );
      }
    });
  }

  private async editFromAsset(parent: StudioAsset, prompt: string, signal?: AbortSignal) {
    if (!parent.blobId || parent.status !== "ready") {
      throw new ForbiddenError("Only a completed source image can be edited. A pending or failed asset is not used.");
    }
    const blob = await this.store.companion.getBlob(parent.blobId);
    if (!blob || blob.businessId !== parent.businessId) {
      throw new NotFoundError("Source image bytes were not found in this workspace.");
    }
    return this.images.edit({ prompt, image: blob.bytes, mime: blob.mime, signal });
  }

  async exportDraft(
    businessId: string,
    user: User,
    draftId: string,
    format: StudioLayoutId,
    options?: {
      composedPngBase64?: string;
      expectedUpdatedAt?: string;
      expectedSaveRevision?: number;
      layers?: StudioLayer[];
      layout?: StudioLayoutId;
    }
  ) {
    return this.store.runInTransaction(async () => {
      const context = await this.workspace.requireMutable(businessId, user);
      let draft = await this.requireDraft(businessId, draftId);
      const nextLayers = options?.layers ?? draft.layers;
      const nextLayout = options?.layout ?? format ?? draft.layout;
      await this.assertAuthorizedLayers(businessId, nextLayers);
      if (options?.layers || (options?.layout && options.layout !== draft.layout)) {
        const written = {
          ...draft,
          layers: nextLayers,
          layout: nextLayout,
          updatedAt: nextStamp(draft.updatedAt)
        };
        const token = concurrencyToken(draft, options);
        written.saveRevision = token + 1;
        const swapped = await this.store.companion.compareAndSwapStudioDraft(written, token);
        if (!swapped) {
          throw new ConflictError("This Studio draft changed since you last edited it. Reload the newer revision before exporting.");
        }
        draft = swapped;
      } else if (options?.expectedUpdatedAt && options.expectedUpdatedAt !== draft.updatedAt) {
        throw new ConflictError("This Studio draft changed since you last edited it. Reload the newer revision before exporting.");
      }
      const asset = draft.selectedAssetId ? await this.store.companion.getStudioAsset(draft.selectedAssetId) : null;
      if (asset && (asset.businessId !== businessId || asset.status !== "ready")) {
        throw new ForbiddenError("The selected image is not a completed asset in this workspace. Export the text and logo layers, or retry generation.");
      }
      const composed = options?.composedPngBase64?.trim() ?? "";
      if (!composed) {
        throw new ForbiddenError("Export requires the composed image bytes. The draft was not marked exported.");
      }
      let bytes: Uint8Array;
      try {
        bytes = Uint8Array.from(Buffer.from(composed, "base64"));
      } catch {
        throw new ForbiddenError("The composed image could not be read. The draft was not marked exported.");
      }
      const palette = paletteForProfile(context.profile);
      const composition = buildComposition({
        layout: nextLayout,
        layers: nextLayers,
        businessId,
        palette,
        profile: context.profile,
        backgroundImageUrl: asset?.status === "ready" ? `/api/companion/assets/${asset.id}?businessId=${encodeURIComponent(businessId)}` : null
      });
      let inspected;
      try {
        inspected = assertExportMatchesRevision(bytes, { width: composition.width, height: composition.height });
      } catch (error) {
        throw new ForbiddenError(error instanceof Error ? error.message : "The composed image was rejected.");
      }
      const outputHash = inspected.hash ?? hashPng(bytes);
      const revision: CompositionRevision = {
        id: companionId("crev"),
        businessId,
        draftId: draft.id,
        workItemId: draft.workItemId,
        version: await this.store.companion.nextCompositionVersion(draft.id),
        layout: nextLayout,
        width: composition.width,
        height: composition.height,
        layers: nextLayers,
        palette,
        composition: composition as unknown as Record<string, unknown>,
        rendererVersion: COMPOSITION_RENDERER_VERSION,
        outputHash,
        createdAt: now(),
        createdBy: user.id
      };
      await this.store.companion.addCompositionRevision(revision);
      const storedRevision = await this.store.companion.getCompositionRevision(revision.id);
      if (!storedRevision || storedRevision.businessId !== businessId || storedRevision.draftId !== draft.id) {
        throw new ForbiddenError("The composition revision could not be stored. The draft was not marked exported.");
      }
      const workItem = await this.store.companion.getWorkItem(draft.workItemId);
      const blob = await this.store.companion.putBlob({
        id: companionId("blob"),
        businessId,
        mime: "image/png",
        bytes,
        createdAt: now()
      });
      const readBack = await this.store.companion.getBlob(blob.id);
      if (!readBack || readBack.businessId !== businessId || hashPng(readBack.bytes) !== outputHash) {
        throw new ForbiddenError("The exported file could not be read back. The draft was not marked exported.");
      }
      const exportAsset: StudioAsset = {
        id: companionId("asset"),
        businessId,
        workItemId: draft.workItemId,
        draftId: draft.id,
        status: "ready",
        prompt: "composition_export",
        model: COMPOSITION_RENDERER_VERSION,
        blobId: blob.id,
        revision: (await this.store.companion.listStudioAssets(businessId)).filter((item) => item.draftId === draft.id)
          .length + 1,
        compositionRevisionId: revision.id,
        outputHash,
        createdAt: now(),
        updatedAt: now()
      };
      await this.store.companion.addStudioAsset(exportAsset);
      const storedAsset = await this.store.companion.getStudioAsset(exportAsset.id);
      if (!storedAsset?.compositionRevisionId || storedAsset.compositionRevisionId !== revision.id) {
        throw new ForbiddenError("The exported asset lost its revision link. The draft was not marked exported.");
      }
      if (workItem) {
        await this.store.companion.updateWorkItem({
          ...workItem,
          status: "exported",
          payload: {
            ...workItem.payload,
            export: {
              format: nextLayout,
              layout: draft.layout,
              layers: nextLayers,
              composition,
              revisionId: revision.id,
              assetId: exportAsset.id,
              sourceAssetId: asset?.id ?? null,
              blobId: blob.id,
              outputHash,
              rendererVersion: COMPOSITION_RENDERER_VERSION,
              labeled: "owner_canvas_bound",
              note: "Decoded owner canvas bound to this revision. Not a server-rasterized proof of unrelated pixels."
            }
          },
          updatedAt: now()
        });
      }
      return {
        draft,
        asset: exportAsset,
        revision: storedRevision,
        format: nextLayout,
        dimensions: LAYOUTS[nextLayout],
        layers: nextLayers,
        composition,
        assetUrl: `/api/companion/assets/${exportAsset.id}?businessId=${encodeURIComponent(businessId)}`,
        labeled: "owner_canvas_bound" as const,
        note: "Decoded owner canvas bound to this revision. Not a server-rasterized proof of unrelated pixels."
      };
    });
  }

  async openFromWork(businessId: string, user: User, workItemId: string) {
    const item = await this.work.get(businessId, user, workItemId);
    const drafts = await this.listDrafts(businessId, user);
    const linked = drafts.find((draft) => draft.workItemId === workItemId || draft.sourceWorkItemId === workItemId);
    if (linked) return { draft: linked, created: false, workItem: item };
    const copy = selectedWorkText(item);
    const created = await this.createFromCopy(businessId, user, {
      headline: copy.headline,
      body: copy.body,
      workItemId: item.id
    });
    return { draft: created.draft, created: true, workItem: item };
  }

  async getAssetBytes(businessId: string, user: User, assetId: string) {
    await this.workspace.requireMembership(businessId, user);
    const asset = await this.store.companion.getStudioAsset(assetId);
    if (!asset || asset.businessId !== businessId) throw new NotFoundError("Asset not found.");
    if (asset.status !== "ready" || !asset.blobId) {
      throw new ForbiddenError("This asset is not ready. A pending or failed generation is not a completed image.");
    }
    const blob = await this.store.companion.getBlob(asset.blobId);
    if (!blob || blob.businessId !== businessId) throw new NotFoundError("Asset bytes not found.");
    return { asset, blob };
  }

  private async assertAuthorizedLayers(businessId: string, layers: StudioLayer[]) {
    for (const layer of layers) {
      if (layer.documentId) {
        const document = await this.store.companion.getDocument(layer.documentId);
        if (!document || document.businessId !== businessId || document.status === "deleted") {
          throw new ForbiddenError("A logo or document on this composition is not in this workspace. The draft was not marked exported.");
        }
      }
      if (layer.assetId) {
        const asset = await this.store.companion.getStudioAsset(layer.assetId);
        if (!asset || asset.businessId !== businessId) {
          throw new ForbiddenError("An image on this composition is not in this workspace. The draft was not marked exported.");
        }
      }
    }
  }

  async uploadLogo(businessId: string, user: User, input: { title: string; mime: string; bytes: Uint8Array }) {
    const context = await this.workspace.requireMutable(businessId, user);
    if (!input.mime.startsWith("image/")) {
      throw new ForbiddenError("Logos must be image files.");
    }
    if (input.bytes.byteLength > 2_000_000) {
      throw new ForbiddenError("Logo files are limited to 2 MB.");
    }
    const { assertDocumentQuota } = await import("@/lib/cofounder/documents");
    assertDocumentQuota({
      planId: context.business.planId,
      currentCount: context.documents.length
    });
    const blob = await this.store.companion.putBlob({
      id: companionId("blob"),
      businessId,
      mime: input.mime,
      bytes: input.bytes,
      createdAt: now()
    });
    const document = await this.store.companion.addDocument({
      id: companionId("doc"),
      businessId,
      title: input.title,
      mime: input.mime,
      status: "ready",
      blobId: blob.id,
      source: "owner_upload",
      createdAt: now(),
      indexStatus: "none"
    });
    const profile = context.profile;
    profile.brandAssets = [
      ...profile.brandAssets.filter((item) => item.kind !== "logo"),
      { id: document.id, kind: "logo", title: input.title, documentId: document.id }
    ];
    profile.updatedAt = now();
    profile.updatedBy = user.id;
    await this.store.companion.upsertProfile(profile);
    return document;
  }

  private async requireDraft(businessId: string, draftId: string) {
    const draft = await this.store.companion.getStudioDraft(draftId);
    if (!draft || draft.businessId !== businessId) throw new NotFoundError("Studio draft not found.");
    return draft;
  }
}
