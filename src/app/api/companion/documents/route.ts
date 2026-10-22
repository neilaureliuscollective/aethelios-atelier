import { z } from "zod";
import { assertDocumentQuota, DOCUMENT_UPLOAD_MAX_BYTES, inferDocumentMime } from "@/lib/cofounder/documents";
import { requireCompanionWrite } from "@/lib/cofounder/http";
import { CompanionStudio } from "@/lib/cofounder/studio";
import { handleError, json, readJson } from "@/lib/http";

export const runtime = "nodejs";

const uploadSchema = z.object({
  businessId: z.string().min(1).optional(),
  title: z.string().min(1).max(160),
  mime: z.string().min(1).max(80),
  bytesBase64: z.string().min(8),
  kind: z.enum(["logo", "document"]).default("document")
});

export async function POST(request: Request) {
  try {
    const body = uploadSchema.parse(await readJson(request));
    const { auth, store, context } = await requireCompanionWrite(body.businessId);
    const bytes = Uint8Array.from(Buffer.from(body.bytesBase64, "base64"));
    const mime = inferDocumentMime(body.mime, body.title);
    if (body.kind === "logo") {
      const document = await new CompanionStudio(store).uploadLogo(context.business.id, auth.user, {
        title: body.title,
        mime,
        bytes
      });
      return json({ ok: true, document });
    }
    if (bytes.byteLength > DOCUMENT_UPLOAD_MAX_BYTES) {
      return json({ ok: false, error: "too_large", message: "Documents are limited to 2 MB." }, 400);
    }
    assertDocumentQuota({
      planId: context.business.planId,
      currentCount: context.documents.length
    });
    const blob = await store.companion.putBlob({
      id: `blob_${crypto.randomUUID()}`,
      businessId: context.business.id,
      mime,
      bytes,
      createdAt: new Date().toISOString()
    });
    const document = await store.companion.addDocument({
      id: `doc_${crypto.randomUUID()}`,
      businessId: context.business.id,
      title: body.title,
      mime,
      status: "ready",
      blobId: blob.id,
      source: "owner_upload",
      createdAt: new Date().toISOString(),
      indexStatus: "none"
    });
    return json({ ok: true, document });
  } catch (error) {
    return handleError(error);
  }
}

const deleteSchema = z.object({
  businessId: z.string().min(1).optional(),
  documentId: z.string().min(1)
});

export async function PATCH(request: Request) {
  try {
    const body = deleteSchema.parse(await readJson(request));
    const { auth, workspace, context } = await requireCompanionWrite(body.businessId);
    const result = await workspace.deleteDocument(context.business.id, auth.user, body.documentId);
    return json({ ok: true, document: result.document, profile: result.profile });
  } catch (error) {
    return handleError(error);
  }
}
