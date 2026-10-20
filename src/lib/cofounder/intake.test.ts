import { deflateSync } from "node:zlib";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { seedSimulatedUsers } from "@/lib/auth/identities";
import {
  extractDocumentPages,
  extractDocumentText,
  TALK_TEXT_CHAR_LIMIT
} from "@/lib/cofounder/documents";
import {
  applyConfirmedIntake,
  draftIntakeChange,
  excerptAppearsOnPage,
  INTAKE_BOUNDARY_NOTE,
  OWNER_CONFIRMED_FROM_DOCUMENT
} from "@/lib/cofounder/intake";
import { clientSafeProfile } from "@/lib/cofounder/isolation";
import { emptyProfile } from "@/lib/cofounder/profile";
import { CompanionWorkspace } from "@/lib/cofounder/workspace";
import { ForbiddenError } from "@/lib/domain/errors";
import { MemoryPersistence } from "@/lib/persistence/memory";
import type { User } from "@/lib/types";

const originalEnv = { ...process.env };

function escapePdfLiteral(text: string) {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function buildTextPdf(pages: string[], compress = false) {
  const kids = pages.map((_, index) => `${4 + index * 2} 0 R`).join(" ");
  const objects: Array<{ id: number; body: Buffer }> = [
    { id: 1, body: Buffer.from("<< /Type /Catalog /Pages 2 0 R >>", "latin1") },
    { id: 2, body: Buffer.from(`<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`, "latin1") },
    { id: 3, body: Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", "latin1") }
  ];
  pages.forEach((text, index) => {
    const pageId = 4 + index * 2;
    const contentId = 5 + index * 2;
    const stream = `BT /F1 12 Tf 72 720 Td (${escapePdfLiteral(text)}) Tj ET\n`;
    const streamBytes = compress ? deflateSync(Buffer.from(stream, "latin1")) : Buffer.from(stream, "latin1");
    objects.push({
      id: pageId,
      body: Buffer.from(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`,
        "latin1"
      )
    });
    objects.push({
      id: contentId,
      body: Buffer.concat([
        Buffer.from(
          `<< /Length ${streamBytes.length}${compress ? " /Filter /FlateDecode" : ""} >>\nstream\n`,
          "latin1"
        ),
        streamBytes,
        Buffer.from("\nendstream", "latin1")
      ])
    });
  });

  let file = Buffer.from("%PDF-1.1\n%\xE2\xE3\xCF\xD3\n", "latin1");
  const offsets = [0];
  for (const object of objects) {
    offsets[object.id] = file.length;
    file = Buffer.concat([
      file,
      Buffer.from(`${object.id} 0 obj\n`, "latin1"),
      object.body,
      Buffer.from("\nendobj\n", "latin1")
    ]);
  }
  const xrefStart = file.length;
  const size = objects.length + 1;
  let xref = `xref\n0 ${size}\n0000000000 65535 f \n`;
  for (let id = 1; id < size; id += 1) {
    xref += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }
  return new Uint8Array(
    Buffer.concat([
      file,
      Buffer.from(`${xref}trailer\n<< /Size ${size} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`, "latin1")
    ])
  );
}

async function setup() {
  process.env.ATELIER_PERSISTENCE_ADAPTER = "memory";
  process.env.ATELIER_AUTH_ADAPTER = "simulated";
  process.env.ATELIER_OPENAI_ENABLED = "false";
  delete process.env.OPENAI_API_KEY;
  const store = new MemoryPersistence();
  await seedSimulatedUsers(store, ["neil.local@atelier.invalid"]);
  const owner = (await store.getUserByEmail("owner.local@atelier.invalid")) as User;
  const founder = (await store.getUserByEmail("neil.local@atelier.invalid")) as User;
  return { store, owner, founder, workspace: new CompanionWorkspace(store) };
}

describe("document intake and review", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
  });
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("keeps Talk text extraction capped while intake preview reads longer text", () => {
    const long = `Lifestyle tea menu\n${"oolong, jasmine, and evening blend. ".repeat(900)}`;
    const bytes = new TextEncoder().encode(long);
    expect(extractDocumentText("text/plain", bytes)?.length).toBe(TALK_TEXT_CHAR_LIMIT);
    const preview = extractDocumentPages("text/plain", bytes, "menu.txt");
    expect(preview.available).toBe(true);
    expect(preview.totalCharacters).toBeGreaterThan(TALK_TEXT_CHAR_LIMIT);
    expect(preview.pages[0]?.text).toContain("Lifestyle tea menu");
  });

  it("extracts PDF pages with citations from uncompressed and FlateDecode files", () => {
    const pages = [
      "Lumen Lifestyle services: private tastings, seasonal subscriptions, and gift boxes.",
      "Brand voice: warm, unhurried, and specific. Speak to hosts who already care about tea."
    ];
    for (const compress of [false, true]) {
      const extracted = extractDocumentPages("application/pdf", buildTextPdf(pages, compress), "brand-guide.pdf");
      expect(extracted.available).toBe(true);
      expect(extracted.kind).toBe("pdf_text");
      expect(extracted.pages).toHaveLength(2);
      expect(extracted.pages[0]?.label).toBe("Page 1");
      expect(extracted.pages[0]?.text).toContain("private tastings");
      expect(extracted.pages[1]?.label).toBe("Page 2");
      expect(extracted.pages[1]?.text).toContain("warm, unhurried");
    }
  });

  it("does not extract image-only or unknown binary files", () => {
    const emptyPdf = extractDocumentPages("application/pdf", new TextEncoder().encode("%PDF-1.1\n%EOF"), "scan.pdf");
    expect(emptyPdf.available).toBe(false);
    expect(emptyPdf.reason).toMatch(/text-based PDFs/);
    const png = extractDocumentPages("image/png", new Uint8Array([137, 80, 78, 71]), "logo.png");
    expect(png.available).toBe(false);
    expect(extractDocumentText("application/pdf", buildTextPdf(["hidden"])) ).toBeNull();
  });

  it("reviews a proposed field beside existing information and saves provenance on confirm", async () => {
    const { store, owner, workspace } = await setup();
    const ctx = await workspace.ensureForUser(owner);
    await workspace.updateProfile(ctx.business.id, owner, {
      fields: {
        ...ctx.profile.fields,
        services: { key: "services", value: "Weekly drop-in classes", kind: "confirmed", source: "owner" }
      }
    });
    const bytes = buildTextPdf([
      "Services: private tastings and seasonal subscriptions.",
      "Audience leftover"
    ]);
    const blob = await store.companion.putBlob({
      id: "blob_menu",
      businessId: ctx.business.id,
      mime: "application/pdf",
      bytes,
      createdAt: new Date().toISOString()
    });
    const document = await store.companion.addDocument({
      id: "doc_menu",
      businessId: ctx.business.id,
      title: "service-menu.pdf",
      mime: "application/pdf",
      status: "ready",
      blobId: blob.id,
      source: "owner_upload",
      createdAt: new Date().toISOString(),
      indexStatus: "none"
    });

    const preview = await workspace.previewDocument(ctx.business.id, owner, document.id);
    const draft = draftIntakeChange({
      document,
      profile: preview.profile,
      extracted: preview.extracted,
      fieldKey: "services",
      pageNumber: 1,
      excerpt: "private tastings and seasonal subscriptions",
      proposedValue: "Private tastings and seasonal subscriptions"
    });
    expect(draft.currentValue).toBe("Weekly drop-in classes");
    expect(draft.proposedValue).toBe("Private tastings and seasonal subscriptions");
    expect(draft.pageLabel).toBe("Page 1");
    expect(draft.provenance).toContain("service-menu.pdf");
    expect(draft.provenance).toContain("page 1");

    expect(() =>
      draftIntakeChange({
        document,
        profile: preview.profile,
        extracted: preview.extracted,
        fieldKey: "services",
        pageNumber: 2,
        excerpt: "private tastings and seasonal subscriptions"
      })
    ).toThrow(/does not appear on the cited page/);

    const confirmed = await workspace.confirmDocumentIntake(ctx.business.id, owner, {
      documentId: document.id,
      fieldKey: "services",
      pageNumber: 1,
      excerpt: "private tastings and seasonal subscriptions",
      proposedValue: "Private tastings and seasonal subscriptions"
    });
    expect(confirmed.profile.fields.services.value).toBe("Private tastings and seasonal subscriptions");
    expect(confirmed.profile.fields.services.kind).toBe("confirmed");
    expect(confirmed.profile.fields.services.source).toContain(OWNER_CONFIRMED_FROM_DOCUMENT);
    expect(confirmed.profile.fields.services.sourceDocumentId).toBe("doc_menu");
    expect(confirmed.profile.fields.services.sourcePage).toBe(1);
    expect(confirmed.profile.sourceDocumentIds).toContain("doc_menu");

    const safe = clientSafeProfile(confirmed.profile);
    expect(safe.confirmed.find((field) => field.key === "services")?.sourceDocumentId).toBe("doc_menu");
    expect(safe.confirmed.find((field) => field.key === "services")?.sourcePage).toBe(1);
  });

  it("blocks founder confirmation and never promises that a file is excluded from AI", async () => {
    const { owner, founder, workspace } = await setup();
    const ctx = await workspace.ensureForUser(owner);
    await expect(
      workspace.confirmDocumentIntake(ctx.business.id, founder, {
        documentId: "doc_missing",
        fieldKey: "audience",
        pageNumber: 1,
        excerpt: "Neighborhood families who already host"
      })
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(INTAKE_BOUNDARY_NOTE.toLowerCase()).not.toMatch(/excluded from ai|hidden from ai|will not be used by ai/);
    expect(INTAKE_BOUNDARY_NOTE).toMatch(/does not hide the file/);
    expect(excerptAppearsOnPage("Private tastings on Friday evenings", "private tastings")).toBe(true);
    const profile = emptyProfile(ctx.business.id, new Date().toISOString());
    const applied = applyConfirmedIntake(
      profile,
      {
        documentId: "doc_brand",
        title: "brand.pdf",
        fieldKey: "tone",
        fieldLabel: "Brand voice",
        pageNumber: 2,
        pageLabel: "Page 2",
        excerpt: "warm and unhurried",
        currentValue: "",
        proposedValue: "Warm and unhurried",
        proposedTruncated: false,
        provenance: "owner_confirmed_from_document · brand.pdf · page 2"
      },
      owner.id
    );
    expect(applied.profile.fields.tone.sourceExcerpt).toBe("warm and unhurried");
  });
});
