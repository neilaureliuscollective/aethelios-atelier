import { describe, expect, it } from "vitest";
import { createEmptyBrief } from "@/lib/brief";
import { ConflictError } from "@/lib/domain/errors";
import { ProjectService } from "@/lib/domain/projects";
import { createGuestDraft } from "@/lib/guest/draft";
import { MemoryPersistence } from "@/lib/persistence/memory";
import { seedSimulatedUsers } from "@/lib/auth/identities";
import type { PersistenceAdapter } from "@/lib/persistence/adapter";
import type { User } from "@/lib/types";

async function users(store: PersistenceAdapter) {
  await seedSimulatedUsers(store, ["neil.local@atelier.invalid"]);
  return {
    store,
    owner: (await store.getUserByEmail("owner.local@atelier.invalid")) as User,
    other: (await store.getUserByEmail("owner-two.local@atelier.invalid")) as User,
    founder: (await store.getUserByEmail("neil.local@atelier.invalid")) as User,
    service: new ProjectService(store)
  };
}

describe("elevation reliability", () => {
  it("rejects submission of a stale reviewed revision and keeps later draft edits off the snapshot", async () => {
    const { owner, service } = await users(new MemoryPersistence());
    const project = await service.createProject(owner);
    const saved = await service.saveBrief(
      project.id,
      owner,
      {
        ...project.brief,
        vision: { key: "vision", value: "Reviewed copy", provenance: "client_statement" }
      },
      1
    );
    await expect(service.submit(project.id, owner, true, "rev-stale", 1)).rejects.toBeInstanceOf(
      ConflictError
    );
    const submitted = await service.submit(project.id, owner, true, "rev-ok", saved.project.version);
    const later = await service.getOwnedProject(project.id, owner);
    await service.saveBrief(
      project.id,
      owner,
      {
        ...later.brief,
        vision: { key: "vision", value: "Newer draft after send", provenance: "client_statement" }
      },
      later.version
    );
    const view = await service.clientView(project.id, owner);
    expect(view.submission?.snapshot.vision.value).toBe("Reviewed copy");
    expect(view.project.brief.vision.value).toBe("Newer draft after send");
    expect(submitted.submission.receiptId).toMatch(/^rcpt_/);
  });

  it("returns the same receipt for an exact lost-response retry and rejects the same key on another project or payload", async () => {
    const { owner, service, store } = await users(new MemoryPersistence());
    const first = await service.createProject(owner, {
      ...createEmptyBrief(),
      vision: { key: "vision", value: "First commission", provenance: "client_statement" }
    });
    const sent = await service.submit(first.id, owner, true, "shared-key", first.version);
    const retry = await service.submit(first.id, owner, true, "shared-key", first.version);
    expect(retry.duplicate).toBe(true);
    expect(retry.submission.receiptId).toBe(sent.submission.receiptId);

    const second = await service.createProject(owner, {
      ...createEmptyBrief(),
      vision: { key: "vision", value: "Second commission", provenance: "client_statement" }
    });
    await expect(service.submit(second.id, owner, true, "shared-key", second.version)).rejects.toBeInstanceOf(
      ConflictError
    );

    const keyed = await service.createProject(owner);
    await store.putLedger({
      id: `${owner.id}:payload-mismatch`,
      ownerId: owner.id,
      projectId: keyed.id,
      operation: "submit",
      payloadHash: "different",
      status: "uncertain",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    await expect(
      service.submit(keyed.id, owner, true, "payload-mismatch", keyed.version)
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("makes guest adoption idempotent and keeps guest content until the matching owner save exists", async () => {
    const { owner, service } = await users(new MemoryPersistence());
    const guest = createGuestDraft();
    guest.brief.vision.value = "Guest vision retained";
    guest.brief.vision.provenance = "client_statement";
    const first = await service.adoptGuestDraft(owner, guest, true);
    const second = await service.adoptGuestDraft(owner, guest, true);
    expect(second.id).toBe(first.id);
    expect(await service.listForOwner(owner)).toHaveLength(1);
    expect(first.brief.vision.value).toBe("Guest vision retained");
  });

  it("loads the requested second project instead of the first", async () => {
    const { owner, service } = await users(new MemoryPersistence());
    const one = await service.createProject(owner, {
      ...createEmptyBrief(),
      vision: { key: "vision", value: "First", provenance: "client_statement" }
    });
    const two = await service.createProject(owner, {
      ...createEmptyBrief(),
      vision: { key: "vision", value: "Second", provenance: "client_statement" }
    });
    const loaded = await service.getOwnedProject(two.id, owner);
    expect(loaded.id).toBe(two.id);
    expect(loaded.id).not.toBe(one.id);
    expect(loaded.brief.vision.value).toBe("Second");
    expect((await service.clientView(two.id, owner)).project.id).toBe(two.id);
  });

  it("does not return an old submission before matching the reviewed request", async () => {
    const { owner, service } = await users(new MemoryPersistence());
    const project = await service.createProject(owner, {
      ...createEmptyBrief(),
      vision: { key: "vision", value: "Reviewed snapshot", provenance: "client_statement" }
    });
    const sent = await service.submit(project.id, owner, true, "reuse-key", project.version);
    const later = await service.saveBrief(
      project.id,
      owner,
      {
        ...project.brief,
        vision: { key: "vision", value: "Newer working draft", provenance: "client_statement" }
      },
      project.version
    );
    await expect(
      service.submit(project.id, owner, true, "reuse-key", later.project.version)
    ).rejects.toBeInstanceOf(ConflictError);
    const exact = await service.submit(project.id, owner, true, "reuse-key", project.version);
    expect(exact.duplicate).toBe(true);
    expect(exact.submission.receiptId).toBe(sent.submission.receiptId);
    expect(exact.submission.reviewedVersion).toBe(project.version);
    expect(exact.submission.snapshot.vision.value).toBe("Reviewed snapshot");
    const revised = await service.submit(project.id, owner, true, "revised-key", later.project.version);
    expect(revised.duplicate).toBe(false);
    expect(revised.submission.receiptId).not.toBe(sent.submission.receiptId);
    expect(revised.submission.reviewedVersion).toBe(later.project.version);
    expect(revised.submission.snapshot.vision.value).toBe("Newer working draft");
  });

  it("keeps founder-private notes out of client payloads", async () => {
    const { owner, founder, service } = await users(new MemoryPersistence());
    const project = await service.createProject(owner);
    await service.submit(project.id, owner, true, "priv", 1);
    await service.addPrivateNote(project.id, founder, "Internal price sketch 12000", "internal_proposal");
    const client = await service.clientView(project.id, owner);
    expect(JSON.stringify(client)).not.toContain("12000");
    expect(JSON.stringify(client)).not.toContain("privateNotes");
    expect(JSON.stringify(client)).not.toContain("internal_proposal");
  });
});
