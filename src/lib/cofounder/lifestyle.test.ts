import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { seedSimulatedUsers } from "@/lib/auth/identities";
import { isLifestyleOwner, LIFESTYLE_PROJECT, lifestyleOwnerEmails } from "@/lib/cofounder/lifestyle";
import { CompanionWorkspace } from "@/lib/cofounder/workspace";
import { MemoryPersistence } from "@/lib/persistence/memory";
import type { User } from "@/lib/types";

const originalEnv = { ...process.env };

describe("Lifestyle founder project", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.ATELIER_LIFESTYLE_OWNER_EMAILS;
  });
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("maps only the configured Lifestyle owner emails", () => {
    expect(isLifestyleOwner("neil.local@atelier.invalid")).toBe(true);
    expect(isLifestyleOwner("owner.local@atelier.invalid")).toBe(false);
    process.env.ATELIER_LIFESTYLE_OWNER_EMAILS = "neil@example.com";
    expect(lifestyleOwnerEmails()).toContain("neil@example.com");
    expect(isLifestyleOwner("neil@example.com")).toBe(true);
  });

  it("creates the Lifestyle workspace from confirmed facts and lists missing assets", async () => {
    const store = new MemoryPersistence();
    await seedSimulatedUsers(store, ["neil.local@atelier.invalid"]);
    const founder = (await store.getUserByEmail("neil.local@atelier.invalid")) as User;
    const ctx = await new CompanionWorkspace(store).ensureForUser(founder);
    expect(ctx.business.name).toBe(LIFESTYLE_PROJECT.brandName);
    expect(ctx.profile.fields.name.value).toBe(LIFESTYLE_PROJECT.brandName);
    expect(ctx.profile.fields.brandNotes.kind).toBe("confirmed");
    expect(ctx.profile.fields.products.value).toBe("");
    expect(ctx.profile.fields.approvedPrices.value).toBe("");
    expect(LIFESTYLE_PROJECT.missingAssets.map((asset) => asset.id)).toEqual([
      "lifestyle-logo",
      "lifestyle-product-photography",
      "lifestyle-labels"
    ]);
  });

  it("does not treat founder visibility on another business as the founder’s own workspace", async () => {
    const store = new MemoryPersistence();
    await seedSimulatedUsers(store, ["neil.local@atelier.invalid"]);
    const owner = (await store.getUserByEmail("owner.local@atelier.invalid")) as User;
    const founder = (await store.getUserByEmail("neil.local@atelier.invalid")) as User;
    const workspace = new CompanionWorkspace(store);
    const ownerCtx = await workspace.ensureForUser(owner);
    await workspace.requireMembership(ownerCtx.business.id, founder);
    const founderCtx = await workspace.ensureForUser(founder);
    expect(founderCtx.business.id).not.toBe(ownerCtx.business.id);
    expect(founderCtx.business.ownerId).toBe(founder.id);
    expect(founderCtx.business.name).toBe(LIFESTYLE_PROJECT.brandName);
  });
});
