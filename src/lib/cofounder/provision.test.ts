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
    expect(a.business.name).toBe("Project workspace");
    expect(b.business.name).toBe("Project workspace");
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
      destination: "/companion/studio",
      payload: { selectedDirectionId: "lumen" }
    });
    expect(retry.ownerId).toBe(first.ownerId);
    expect(retry.createdAt).toBe(first.createdAt);
    expect(retry.sourceRevision).toBe(0);
    await expect(
      service.claim(owner, {
        guestWorkId: "dsel_one",
        kind: "discovery",
        payload: { selectedDirectionId: "hearth" }
      })
    ).rejects.toBeInstanceOf(ConflictError);
    await expect(
      service.claim(other, { guestWorkId: "dsel_one", kind: "discovery", destination: "/companion/confirm" })
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(service.readForUser(other, "dsel_one")).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("stores immutable Discovery revisions and keeps the first snapshot", async () => {
    const { store, owner, other } = await setup();
    const service = new GuestWorkService(store);
    const first = await service.claim(owner, {
      guestWorkId: "dsel_rev",
      kind: "discovery",
      payload: {
        selectionId: "dsel_rev",
        localRevision: 1,
        selectedDirectionId: "lumen",
        paletteId: "ivory_hall",
        visualDirectionId: "glass",
        businessName: "Lumen House"
      }
    });
    const newer = await service.claim(owner, {
      guestWorkId: "dsel_rev",
      kind: "discovery",
      payload: {
        selectionId: "dsel_rev",
        localRevision: 2,
        selectedDirectionId: "hearth",
        paletteId: "hearth_linen",
        visualDirectionId: "material",
        businessName: "Hearth Room"
      }
    });
    expect(newer.sourceRevision).toBe(2);
    expect(newer.payloadJson).not.toBe(first.payloadJson);
    expect((await store.companion.getGuestWorkClaim("dsel_rev", 1))?.payloadJson).toContain("ivory_hall");
    expect((await store.companion.getGuestWorkClaim("dsel_rev", 2))?.payloadJson).toContain("hearth_linen");
    await expect(
      service.claim(owner, {
        guestWorkId: "dsel_rev",
        kind: "discovery",
        payload: {
          selectionId: "dsel_rev",
          localRevision: 1,
          selectedDirectionId: "signal"
        }
      })
    ).rejects.toBeInstanceOf(ConflictError);
    await expect(
      service.claim(other, {
        guestWorkId: "dsel_rev",
        kind: "discovery",
        payload: {
          selectionId: "dsel_rev",
          localRevision: 3,
          selectedDirectionId: "signal"
        }
      })
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("converges concurrent claims on one owner without a post-conflict select in a failed transaction", async () => {
    const { store, owner, other } = await setup();
    const service = new GuestWorkService(store);
    const [a, b] = await Promise.all([
      service.claim(owner, {
        guestWorkId: "dsel_race",
        kind: "discovery",
        payload: { selectionId: "dsel_race", localRevision: 1, selectedDirectionId: "lumen" }
      }),
      service.claim(owner, {
        guestWorkId: "dsel_race",
        kind: "discovery",
        payload: { selectionId: "dsel_race", localRevision: 1, selectedDirectionId: "lumen" }
      })
    ]);
    expect(a.ownerId).toBe(owner.id);
    expect(b.guestWorkId).toBe(a.guestWorkId);
    expect(b.createdAt).toBe(a.createdAt);
    await expect(
      service.claim(other, {
        guestWorkId: "dsel_race",
        kind: "discovery",
        payload: { selectionId: "dsel_race", localRevision: 1, selectedDirectionId: "hearth" }
      })
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("assigns one owner when two accounts race different revisions of an unclaimed selection", async () => {
    const { store, owner, other } = await setup();
    const service = new GuestWorkService(store);
    const results = await Promise.allSettled([
      service.claim(owner, {
        guestWorkId: "dsel_split",
        kind: "discovery",
        payload: { selectionId: "dsel_split", localRevision: 1, selectedDirectionId: "lumen" }
      }),
      service.claim(other, {
        guestWorkId: "dsel_split",
        kind: "discovery",
        payload: { selectionId: "dsel_split", localRevision: 2, selectedDirectionId: "signal" }
      })
    ]);
    const won = results.filter((item) => item.status === "fulfilled");
    const lost = results.filter((item) => item.status === "rejected");
    expect(won).toHaveLength(1);
    expect(lost).toHaveLength(1);
    expect(lost[0]?.status === "rejected" && lost[0].reason).toBeInstanceOf(ForbiddenError);
    const winner = won[0]?.status === "fulfilled" ? won[0].value : null;
    expect(winner).toBeTruthy();
    const ownerRow = await store.companion.getGuestWorkOwner("dsel_split");
    expect(ownerRow?.ownerId).toBe(winner?.ownerId);
    const loser = winner?.ownerId === owner.id ? other : owner;
    await expect(service.readForUser(loser, "dsel_split")).rejects.toBeInstanceOf(ForbiddenError);
    await expect(service.readForUser(loser, "dsel_split", 1)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(service.readForUser(loser, "dsel_split", 2)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      service.claim(loser, {
        guestWorkId: "dsel_split",
        kind: "discovery",
        payload: { selectionId: "dsel_split", localRevision: 3, selectedDirectionId: "hearth" }
      })
    ).rejects.toBeInstanceOf(ForbiddenError);
    const unrelated = await service.claim(loser, {
      guestWorkId: "dsel_other",
      kind: "discovery",
      payload: { selectionId: "dsel_other", localRevision: 1, selectedDirectionId: "hearth" }
    });
    expect(unrelated.ownerId).toBe(loser.id);
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
    const individual = resolveConfirmedBusinessName({
      submittedName: "",
      existingName: "Project workspace"
    });
    expect(individual.retainedExisting).toBe(false);
    expect(individual.name).toBe("Project workspace");
  });

  it("persists a confirmation and refuses a silent direction change", async () => {
    const { store, owner, other, workspace } = await setup();
    const context = await workspace.ensureForUser(owner);
    const guests = new GuestWorkService(store);
    await guests.claim(owner, {
      guestWorkId: "dsel_a",
      kind: "discovery",
      payload: { selectionId: "dsel_a", localRevision: 1, selectedDirectionId: "lumen", businessName: "Northridge" }
    });
    await guests.claim(owner, {
      guestWorkId: "dsel_b",
      kind: "discovery",
      payload: { selectionId: "dsel_b", localRevision: 2, selectedDirectionId: "hearth", businessName: "Northridge" }
    });
    const adoption = new BusinessAdoption(store);
    const first = await adoption.confirm(context.business.id, owner, {
      businessName: "Northridge",
      businessContext: "A quiet sitting room.",
      sourceSelectionId: "dsel_a",
      sourceRevision: 1,
      directionId: "lumen"
    });
    expect(first.confirmation.businessName).toBe("Northridge");
    expect(first.draft?.id).toBeTruthy();
    expect(first.draft?.layers.some((layer) => layer.text?.includes("Lumen"))).toBe(true);
    expect(first.draft?.brandKit?.designSpec.directionId).toBe("lumen");
    expect(first.draft?.palette?.canvas).toBeTruthy();
    expect(first.draft?.layout).toBe("direction_board");
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
    expect(replaced.confirmation.sourceSelectionId).toBe("dsel_b");
    expect(replaced.draft?.id).toBeTruthy();
    expect(replaced.draft?.id).not.toBe(first.draft?.id);
    expect(replaced.draft?.brandKit?.designSpec.directionId).toBe("hearth");
    expect(replaced.draft?.palette?.canvas).not.toBe(first.draft?.palette?.canvas);
    expect(await store.companion.getStudioDraft(first.draft!.id)).toBeTruthy();
    await expect(adoption.read(context.business.id, other)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("adopts a newer revision of the same selection without overwriting the first draft", async () => {
    const { store, owner, workspace } = await setup();
    const context = await workspace.ensureForUser(owner);
    const guests = new GuestWorkService(store);
    await guests.claim(owner, {
      guestWorkId: "dsel_same",
      kind: "discovery",
      payload: {
        selectionId: "dsel_same",
        localRevision: 1,
        selectedDirectionId: "lumen",
        paletteId: "ivory_hall",
        visualDirectionId: "glass",
        businessName: "Lumen House",
        visualPreferences: { headline: "Glass evening", paletteId: "ivory_hall", visualDirectionId: "glass" }
      }
    });
    await guests.claim(owner, {
      guestWorkId: "dsel_same",
      kind: "discovery",
      payload: {
        selectionId: "dsel_same",
        localRevision: 2,
        selectedDirectionId: "hearth",
        paletteId: "hearth_linen",
        visualDirectionId: "material",
        businessName: "Hearth Room",
        visualPreferences: { headline: "Linen gathering", paletteId: "hearth_linen", visualDirectionId: "material" }
      }
    });
    const adoption = new BusinessAdoption(store);
    const first = await adoption.confirm(context.business.id, owner, {
      businessName: "Lumen House",
      businessContext: "Quiet glass.",
      sourceSelectionId: "dsel_same",
      sourceRevision: 1,
      directionId: "lumen"
    });
    await expect(
      adoption.confirm(context.business.id, owner, {
        businessName: "Hearth Room",
        businessContext: "Warm linen.",
        sourceSelectionId: "dsel_same",
        sourceRevision: 2,
        directionId: "hearth"
      })
    ).rejects.toBeInstanceOf(ConflictError);
    const replaced = await adoption.confirm(context.business.id, owner, {
      businessName: "Hearth Room",
      businessContext: "Warm linen.",
      sourceSelectionId: "dsel_same",
      sourceRevision: 2,
      directionId: "hearth",
      replaceConfirmedDirection: true
    });
    expect(replaced.draft?.id).not.toBe(first.draft?.id);
    expect(replaced.draft?.layers.find((layer) => layer.kind === "headline")?.text).toBe("Linen gathering");
    expect(replaced.draft?.brandKit?.designSpec.paletteId).toBe("hearth_linen");
    expect(first.draft?.brandKit?.designSpec.paletteId).toBe("ivory_hall");
    const preserved = await store.companion.getStudioDraft(first.draft!.id);
    expect(preserved?.layers.find((layer) => layer.kind === "headline")?.text).toBe("Glass evening");
    expect(preserved?.brandKit?.designSpec.paletteId).toBe("ivory_hall");
    expect(await store.companion.listStudioDrafts(context.business.id)).toHaveLength(2);
  });

  it("refuses adoption when the Discovery snapshot was never claimed", async () => {
    const { store, owner, workspace } = await setup();
    const context = await workspace.ensureForUser(owner);
    await expect(
      new BusinessAdoption(store).confirm(context.business.id, owner, {
        businessName: "Northridge",
        businessContext: "A quiet sitting room.",
        sourceSelectionId: "dsel_missing",
        sourceRevision: 1,
        directionId: "lumen"
      })
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(await store.companion.getBusinessConfirmation(context.business.id)).toBeNull();
    expect(await store.companion.listStudioDrafts(context.business.id)).toHaveLength(0);
  });

  it("rejects a client-supplied revision that does not match the claimed snapshot", async () => {
    const { store, owner, workspace } = await setup();
    const context = await workspace.ensureForUser(owner);
    await new GuestWorkService(store).claim(owner, {
      guestWorkId: "dsel_stale",
      kind: "discovery",
      payload: { selectionId: "dsel_stale", localRevision: 3, selectedDirectionId: "lumen" }
    });
    await expect(
      new BusinessAdoption(store).confirm(context.business.id, owner, {
        businessName: "Northridge",
        businessContext: "A quiet sitting room.",
        sourceSelectionId: "dsel_stale",
        sourceRevision: 1,
        directionId: "lumen"
      })
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("adopts one Studio draft concurrently and rolls back an injected failure", async () => {
    const { store, owner, other, workspace } = await setup();
    const context = await workspace.ensureForUser(owner);
    const guests = new GuestWorkService(store);
    await guests.claim(owner, {
      guestWorkId: "dsel_adopt",
      kind: "discovery",
      payload: {
        selectionId: "dsel_adopt",
        localRevision: 4,
        selectedDirectionId: "signal",
        businessName: "Northridge",
        audience: "Returning guests",
        visualPreferences: { headline: "A clear mark" }
      }
    });
    const adoption = new BusinessAdoption(store);
    const [first, second] = await Promise.all([
      adoption.confirm(context.business.id, owner, {
        businessName: "Northridge",
        businessContext: "Returning guests.",
        sourceSelectionId: "dsel_adopt",
        sourceRevision: 4,
        directionId: "signal"
      }),
      adoption.confirm(context.business.id, owner, {
        businessName: "Northridge",
        businessContext: "Returning guests.",
        sourceSelectionId: "dsel_adopt",
        sourceRevision: 4,
        directionId: "signal"
      })
    ]);
    expect(first.draft?.id).toBe(second.draft?.id);
    expect(await store.companion.listStudioDrafts(context.business.id)).toHaveLength(1);
    expect(first.draft?.layers.find((layer) => layer.kind === "headline")?.text).toBe("A clear mark");

    const otherContext = await workspace.ensureForUser(other);
    await expect(
      adoption.confirm(otherContext.business.id, other, {
        businessName: "Stolen",
        businessContext: "no",
        sourceSelectionId: "dsel_adopt",
        sourceRevision: 4,
        directionId: "signal"
      })
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(await store.companion.listStudioDrafts(otherContext.business.id)).toHaveLength(0);

    await expect(
      store.runInTransaction(async () => {
        await guests.claim(owner, {
          guestWorkId: "dsel_fail",
          kind: "discovery",
          payload: { selectionId: "dsel_fail", localRevision: 1, selectedDirectionId: "hearth" }
        });
        await adoption.confirm(context.business.id, owner, {
          businessName: "Should roll back",
          businessContext: "no",
          sourceSelectionId: "dsel_fail",
          sourceRevision: 1,
          directionId: "hearth",
          replaceConfirmedDirection: true
        });
        throw new Error("injected confirmation failure");
      })
    ).rejects.toThrow("injected confirmation failure");
    expect(await store.companion.getGuestWorkClaim("dsel_fail")).toBeNull();
    expect((await store.companion.getBusinessConfirmation(context.business.id))?.sourceSelectionId).toBe("dsel_adopt");
    expect(await store.companion.listStudioDrafts(context.business.id)).toHaveLength(1);
  });
});
