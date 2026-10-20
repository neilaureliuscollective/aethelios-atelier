import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { seedSimulatedUsers } from "@/lib/auth/identities";
import { BusinessAdoption, resolveConfirmedBusinessName } from "@/lib/cofounder/confirmation";
import { CompanionWorkspace } from "@/lib/cofounder/workspace";
import { ConflictError, ForbiddenError, UniqueConstraintError } from "@/lib/domain/errors";
import { createEmptyBrief } from "@/lib/brief";
import { ProjectService } from "@/lib/domain/projects";
import { GuestWorkService } from "@/lib/guest/claim";
import { MemoryPersistence } from "@/lib/persistence/memory";
import type { User } from "@/lib/types";

const originalEnv = { ...process.env };

async function setup() {
  process.env.ATELIER_PERSISTENCE_ADAPTER = "memory";
  process.env.ATELIER_AUTH_ADAPTER = "simulated";
  const store = new MemoryPersistence();
  await seedSimulatedUsers(store, ["neil.local@atelier.invalid"]);
  const owner = (await store.getUserByEmail("owner.local@atelier.invalid")) as User;
  const other = (await store.getUserByEmail("owner-two.local@atelier.invalid")) as User;
  return { store, owner, other, workspace: new CompanionWorkspace(store) };
}

describe("initial workspace provisioning", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
  });
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("converges concurrent first visits on one owned workspace", async () => {
    const { owner, workspace, store } = await setup();
    const [first, second, third] = await Promise.all([
      workspace.ensureForUser(owner),
      workspace.ensureForUser(owner),
      workspace.ensureForUser(owner)
    ]);
    expect(first.business.id).toBe(second.business.id);
    expect(second.business.id).toBe(third.business.id);
    const owned = (await store.companion.listBusinessesForUser(owner.id)).filter(
      (business) => business.ownerId === owner.id
    );
    expect(owned).toHaveLength(1);
    expect(await store.companion.getInitialBusinessId(owner.id)).toBe(first.business.id);
  });

  it("keeps two accounts on isolated initial workspaces", async () => {
    const { owner, other, workspace } = await setup();
    const [a, b] = await Promise.all([workspace.ensureForUser(owner), workspace.ensureForUser(other)]);
    expect(a.business.id).not.toBe(b.business.id);
    expect(a.business.ownerId).toBe(owner.id);
    expect(b.business.ownerId).toBe(other.id);
  });

  it("rolls back a failed initial create so a retry can provision cleanly", async () => {
    const { owner, store, workspace } = await setup();
    await expect(
      store.runInTransaction(async () => {
        await store.companion.createBusiness({
          id: "biz_orphaned",
          ownerId: owner.id,
          name: "Should roll back",
          planId: "atelier",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z"
        });
        throw new Error("related write failed");
      })
    ).rejects.toThrow("related write failed");
    const after = await workspace.ensureForUser(owner);
    expect(after.business.id).not.toBe("biz_orphaned");
    expect(await store.companion.getInitialBusinessId(owner.id)).toBe(after.business.id);
  });

  it("reconciles a pre-existing owned business onto the uniqueness claim", async () => {
    const { owner, store, workspace } = await setup();
    await store.companion.createBusiness({
      id: "biz_legacy",
      ownerId: owner.id,
      name: "Already here",
      planId: "atelier",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    });
    await store.companion.addMember({
      businessId: "biz_legacy",
      userId: owner.id,
      role: "owner",
      createdAt: "2026-01-01T00:00:00.000Z"
    });
    const context = await workspace.ensureForUser(owner);
    expect(context.business.id).toBe("biz_legacy");
    expect(await store.companion.getInitialBusinessId(owner.id)).toBe("biz_legacy");
  });
});

describe("guest work claims", () => {
  it("claims once per guest id and refuses the other account", async () => {
    const { store, owner, other } = await setup();
    const service = new GuestWorkService(store);
    const first = await service.claim(owner, {
      guestWorkId: "dsel_one",
      kind: "discovery",
      destination: "/companion/confirm",
      payload: { selectedDirectionId: "lumen" }
    });
    const retry = await service.claim(owner, {
      guestWorkId: "dsel_one",
      kind: "discovery",
      destination: "/companion/studio"
    });
    expect(retry.ownerId).toBe(first.ownerId);
    expect(retry.createdAt).toBe(first.createdAt);
    await expect(
      service.claim(other, { guestWorkId: "dsel_one", kind: "discovery", destination: "/companion/confirm" })
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(service.readForUser(other, "dsel_one")).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("adopts a guest brief once and refuses a second account", async () => {
    const { store, owner, other } = await setup();
    const projects = new ProjectService(store);
    const draft = {
      version: 1 as const,
      kind: "guest_draft" as const,
      labeled: true as const,
      limitations: [],
      draftId: "guest_shared",
      title: "Guest",
      brief: createEmptyBrief(),
      messages: [],
      updatedAt: new Date().toISOString()
    };
    const first = await projects.adoptGuestDraft(owner, draft, true);
    const again = await projects.adoptGuestDraft(owner, draft, true);
    expect(again.id).toBe(first.id);
    await expect(projects.adoptGuestDraft(other, draft, true)).rejects.toBeInstanceOf(ForbiddenError);
    expect(() => store.createProject({ ...first, id: "proj_dup", ownerId: other.id })).toThrow(
      UniqueConstraintError
    );
  });
});

describe("business confirmation", () => {
  it("keeps an existing business name unless the owner changes it", () => {
    const retained = resolveConfirmedBusinessName({
      submittedName: "Meridian Sitting Room",
      existingName: "Meridian Sitting Room",
      displayName: "Owner Local"
    });
    expect(retained.retainedExisting).toBe(true);
    expect(retained.name).toBe("Meridian Sitting Room");
    const renamed = resolveConfirmedBusinessName({
      submittedName: "Meridian Atelier",
      existingName: "Meridian Sitting Room"
    });
    expect(renamed.retainedExisting).toBe(false);
    expect(renamed.name).toBe("Meridian Atelier");
    const placeholder = resolveConfirmedBusinessName({
      submittedName: "Northridge",
      existingName: "Your business"
    });
    expect(placeholder.retainedExisting).toBe(false);
    expect(placeholder.name).toBe("Northridge");
  });

  it("persists a confirmation and refuses a silent direction change", async () => {
    const { store, owner, other, workspace } = await setup();
    const context = await workspace.ensureForUser(owner);
    const adoption = new BusinessAdoption(store);
    const first = await adoption.confirm(context.business.id, owner, {
      businessName: "Northridge",
      businessContext: "A quiet sitting room.",
      sourceSelectionId: "dsel_a",
      sourceRevision: 1,
      directionId: "lumen"
    });
    expect(first.businessName).toBe("Northridge");
    await expect(
      adoption.confirm(context.business.id, owner, {
        businessName: "Northridge",
        businessContext: "A quiet sitting room.",
        sourceSelectionId: "dsel_b",
        sourceRevision: 2,
        directionId: "hearth"
      })
    ).rejects.toBeInstanceOf(ConflictError);
    const replaced = await adoption.confirm(context.business.id, owner, {
      businessName: "Northridge",
      businessContext: "A quiet sitting room.",
      sourceSelectionId: "dsel_b",
      sourceRevision: 2,
      directionId: "hearth",
      replaceConfirmedDirection: true
    });
    expect(replaced.sourceSelectionId).toBe("dsel_b");
    await expect(adoption.read(context.business.id, other)).rejects.toBeInstanceOf(ForbiddenError);
  });
});
