import { CompanionWorkspace } from "@/lib/cofounder/workspace";
import { CompanionWork } from "@/lib/cofounder/work";
import { CompanionUsage } from "@/lib/cofounder/usage";
import { buildComposition, defaultLayers, paletteForProfile, studioLayouts, STUDIO_LAYOUTS } from "@/lib/cofounder/composition";
import { assertExportMatchesRevision } from "@/lib/cofounder/png";
import { selectedWorkText } from "@/lib/cofounder/studioOpen";
import { aureliusStatus } from "@/lib/aurelius/boundary";
import { loadConfig } from "@/lib/config";
import { ConflictError, ForbiddenError, LimitError, NotFoundError } from "@/lib/domain/errors";
import type { PersistenceAdapter } from "@/lib/persistence/adapter";
import type {
  CompositionRevision,
  StudioAsset,
  StudioDraft,
  StudioLayer,
  StudioLayoutId
} from "@/lib/cofounder/types";
import type { AuthContext, User } from "@/lib/types";

export { studioLayouts, STUDIO_LAYOUTS };

function now() {
  return new Date().toISOString();
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
    patch: Partial<Pick<StudioDraft, "layout" | "layers" | "selectedAssetId">> & { expectedUpdatedAt?: string }
  ) {
    await this.workspace.requireMutable(businessId, user);
    const draft = await this.requireDraft(businessId, draftId);
    if (patch.expectedUpdatedAt && patch.expectedUpdatedAt !== draft.updatedAt) {
      throw new ConflictError("This Studio draft changed since you last edited it. Reload the newer revision before saving.");
    }
    const { expectedUpdatedAt, ...next } = patch;
    void expectedUpdatedAt;
    return this.store.companion.updateStudioDraft({
      ...draft,
      ...next,
      updatedAt: now()
    });
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
  ) {
    await this.workspace.requireMutable(businessId, user);
    const draft = await this.requireDraft(businessId, input.draftId);
    const existing = await this.store.companion.getJobByIdempotency(businessId, input.idempotencyKey);
    if (existing?.status === "completed" && existing.resultJson) {
      const parsed = JSON.parse(existing.resultJson) as { assetId?: string };
      if (parsed.assetId) {
        const asset = await this.store.companion.getStudioAsset(parsed.assetId);
        if (asset) return asset;
      }
    }
    if (existing?.status === "pending") {
      throw new ForbiddenError("That generation is already in progress. Wait or retry the same request after it finishes.");
    }
    await this.usage.assertConcurrent(businessId, user, "image");
    const reservation = await this.usage.reserve(businessId, user, "image", 1, {
      draftId: draft.id,
      idempotencyKey: input.idempotencyKey
    });
    const job = existing
      ? await this.store.companion.updateJob({
          ...existing,
          status: "pending",
          sessionId: auth.session.id,
          updatedAt: now(),
          error: undefined
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
          updatedAt: now()
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
      const latest = await this.store.companion.getJob(job.id);
      if (!latest || latest.status === "invalidated") {
        asset.status = "invalidated";
        asset.error = "Generation was invalidated after sign-out or account switch.";
        asset.updatedAt = now();
        await this.store.companion.updateStudioAsset(asset);
        await this.usage.release(reservation);
        return asset;
      }
      const blob = await this.store.companion.putBlob({
        id: companionId("blob"),
        businessId,
        mime: generated.mime,
        bytes: generated.bytes,
        createdAt: now()
      });
      asset.status = "ready";
      asset.blobId = blob.id;
      asset.model = generated.model;
      asset.updatedAt = now();
      await this.store.companion.updateStudioAsset(asset);
      await this.store.companion.updateStudioDraft({
        ...draft,
        selectedAssetId: asset.id,
        updatedAt: now()
      });
      await this.usage.settle(reservation);
      await this.store.companion.updateJob({
        ...job,
        status: "completed",
        updatedAt: now(),
        resultJson: JSON.stringify({ assetId: asset.id })
      });
      return asset;
    } catch (error) {
      await this.usage.release(reservation);
      asset.status = "failed";
      asset.error = error instanceof Error ? error.message : "Image generation failed.";
      asset.updatedAt = now();
      await this.store.companion.updateStudioAsset(asset);
      await this.store.companion.updateJob({
        ...job,
        status: "failed",
        updatedAt: now(),
        error: asset.error
      });
      throw error;
    }
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
      layers?: StudioLayer[];
      layout?: StudioLayoutId;
    }
  ) {
    return this.store.runInTransaction(async () => {
      const context = await this.workspace.requireMutable(businessId, user);
      let draft = await this.requireDraft(businessId, draftId);
      if (options?.expectedUpdatedAt && options.expectedUpdatedAt !== draft.updatedAt) {
        throw new ConflictError("This Studio draft changed since you last edited it. Reload the newer revision before exporting.");
      }
      const nextLayers = options?.layers ?? draft.layers;
      const nextLayout = options?.layout ?? format ?? draft.layout;
      if (options?.layers || options?.layout) {
        draft = await this.store.companion.updateStudioDraft({
          ...draft,
          layers: nextLayers,
          layout: nextLayout,
          updatedAt: now()
        });
      }
      const asset = draft.selectedAssetId ? await this.store.companion.getStudioAsset(draft.selectedAssetId) : null;
      if (asset && asset.status !== "ready") {
        throw new ForbiddenError("The selected image is not a completed asset. Export the text and logo layers, or retry generation.");
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
      try {
        assertExportMatchesRevision(bytes, { width: composition.width, height: composition.height });
      } catch (error) {
        throw new ForbiddenError(error instanceof Error ? error.message : "The composed image was rejected.");
      }
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
        createdAt: now(),
        createdBy: user.id
      };
      await this.store.companion.addCompositionRevision(revision);
      const workItem = await this.store.companion.getWorkItem(draft.workItemId);
      const blob = await this.store.companion.putBlob({
        id: companionId("blob"),
        businessId,
        mime: "image/png",
        bytes,
        createdAt: now()
      });
      const exportAsset: StudioAsset = {
        id: companionId("asset"),
        businessId,
        workItemId: draft.workItemId,
        draftId: draft.id,
        status: "ready",
        prompt: "composition_export",
        model: "owner_composition",
        blobId: blob.id,
        revision: (await this.store.companion.listStudioAssets(businessId)).filter((item) => item.draftId === draft.id)
          .length + 1,
        compositionRevisionId: revision.id,
        createdAt: now(),
        updatedAt: now()
      };
      await this.store.companion.addStudioAsset(exportAsset);
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
              labeled: "composition_export",
              note: "Text and original logos stay as controlled layers. Generated pixels are not a customer portfolio result."
            }
          },
          updatedAt: now()
        });
      }
      return {
        draft,
        asset: exportAsset,
        revision,
        format: nextLayout,
        dimensions: LAYOUTS[nextLayout],
        layers: nextLayers,
        composition,
        assetUrl: `/api/companion/assets/${exportAsset.id}?businessId=${encodeURIComponent(businessId)}`,
        labeled: "composition_export" as const,
        note: "Compose text and original logos as controlled layers. Generated pixels are not a customer portfolio result."
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
