import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAtelierAuthAdapter } from "@/lib/auth/adapter";
import { seedSimulatedUsers } from "@/lib/auth/identities";
import { createEmptyBrief } from "@/lib/brief";
import { emptyCommissionContext } from "@/lib/commissionContext";
import { ForbiddenError } from "@/lib/domain/errors";
import { handoffSummaryFromBrief } from "@/lib/domain/handoffSummary";
import { ProjectService } from "@/lib/domain/projects";
import { createGuestDraft } from "@/lib/guest/draft";
import { MemoryPersistence } from "@/lib/persistence/memory";
import { planInterestNote } from "@/lib/pricing/context";
import type { AdapterUser } from "next-auth/adapters";
import type { Brief, User } from "@/lib/types";

const SECRET = "atelier-early-access-secret-value-32ch";

function authjsEnv() {
  process.env.ATELIER_PERSISTENCE_ADAPTER = "memory";
  process.env.ATELIER_AUTH_ADAPTER = "authjs";
  process.env.AUTH_SECRET = SECRET;
  process.env.ATELIER_SESSION_SECRET = SECRET;
  process.env.ATELIER_FOUNDER_EMAILS = "founder.auth@atelier.invalid";
  process.env.ATELIER_OPENAI_ENABLED = "false";
  delete process.env.VERCEL;
}

function briefWithHandoff(vision: string): Brief {
  const brief = createEmptyBrief();
  brief.vision.value = vision;
  brief.vision.provenance = "client_statement";
  brief.projectType.value = "website";
  brief.projectType.provenance = "client_statement";
  brief.constraints.value = planInterestNote("atelier");
  brief.constraints.provenance = "client_statement";
  brief.context = {
    ...emptyCommissionContext(),
    purpose: "business",
    offerId: "barbers_salons"
  };
  return brief;
}

describe("client early-access commission intake", () => {
  const original = { ...process.env };

  beforeEach(() => {
    authjsEnv();
  });

  afterEach(() => {
    process.env = { ...original };
  });

  it("provisions an ordinary client, preserves a saved brief, and hands the exact snapshot to the founder", async () => {
    const store = new MemoryPersistence();
    const adapter = createAtelierAuthAdapter(store);
    const created = await adapter.createUser?.({
      id: undefined as unknown as string,
      email: "client.a@example.com",
      name: "Client A",
      emailVerified: new Date("2026-03-01T00:00:00.000Z"),
      image: null
    } as AdapterUser);
    const founderCreated = await adapter.createUser?.({
      id: undefined as unknown as string,
      email: "founder.auth@atelier.invalid",
      name: "Neil",
      emailVerified: new Date("2026-03-01T00:00:00.000Z"),
      image: null
    } as AdapterUser);
    const owner = (await store.getUserById(created!.id)) as User;
    const founder = (await store.getUserById(founderCreated!.id)) as User;
    expect(owner.role).toBe("client");
    expect(owner.emailVerifiedAt).toBe("2026-03-01T00:00:00.000Z");
    expect(founder.role).toBe("founder");

    const service = new ProjectService(store);
    const first = await service.createProject(owner, briefWithHandoff("Ivory salon site with existing GlossGenius booking."));
    const saved = await service.saveBrief(
      first.id,
      owner,
      {
        ...first.brief,
        audience: {
          key: "audience",
          value: "Neighborhood clients booking cuts.",
          provenance: "client_statement"
        }
      },
      first.version
    );
    expect(saved.project.brief.audience.value).toBe("Neighborhood clients booking cuts.");

    const returned = await service.clientView(first.id, owner);
    expect(returned.project.brief.audience.value).toBe("Neighborhood clients booking cuts.");
    expect(returned.project.brief.vision.value).toContain("Ivory salon");

    const { submission } = await service.submit(
      first.id,
      owner,
      true,
      "early-access-submit-1",
      saved.project.version
    );
    expect(submission.receiptId).toBeTruthy();
    expect(submission.snapshot.audience.value).toBe("Neighborhood clients booking cuts.");
    expect(handoffSummaryFromBrief(submission.snapshot)).toMatch(/Barbers & Salons/);
    expect(handoffSummaryFromBrief(submission.snapshot)).toMatch(/Atelier plan interest/);

    const later = await service.saveBrief(
      first.id,
      owner,
      {
        ...saved.project.brief,
        vision: {
          key: "vision",
          value: "Later draft change that must not rewrite the receipt.",
          provenance: "client_statement"
        }
      },
        saved.project.version
    );
    expect(later.project.brief.vision.value).toMatch(/Later draft change/);

    const queue = await service.founderQueue(founder);
    expect(queue).toHaveLength(1);
    expect(queue[0]?.owner?.email).toBe("client.a@example.com");
    expect(queue[0]?.receiptId).toBe(submission.receiptId);
    expect(queue[0]?.submittedAt).toBe(submission.createdAt);
    expect(queue[0]?.handoffSummary).toMatch(/Barbers & Salons/);
    expect(queue[0]?.status).toBe("submitted");

    const founderView = await service.founderView(first.id, founder);
    expect(founderView.submission?.snapshot.vision.value).toContain("Ivory salon");
    expect(founderView.submission?.snapshot.vision.value).not.toMatch(/Later draft change/);
    expect(founderView.project.brief.vision.value).toMatch(/Later draft change/);
  });

  it("refuses guest-draft adoption without consent and keeps another client off private records", async () => {
    const store = new MemoryPersistence();
    await seedSimulatedUsers(store, ["neil.local@atelier.invalid"]);
    process.env.ATELIER_AUTH_ADAPTER = "simulated";
    const owner = (await store.getUserByEmail("owner.local@atelier.invalid")) as User;
    const other = (await store.getUserByEmail("owner-two.local@atelier.invalid")) as User;
    const service = new ProjectService(store);
    const guest = createGuestDraft();
    guest.brief.vision.value = "Guest wording that must stay on the device until confirmed.";
    guest.brief.vision.provenance = "client_statement";

    await expect(service.adoptGuestDraft(owner, guest, false)).rejects.toBeInstanceOf(ForbiddenError);
    const adopted = await service.adoptGuestDraft(owner, guest, true);
    await expect(service.clientView(adopted.id, other)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(service.founderQueue(owner)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(service.founderView(adopted.id, other)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("does not merge an unverified identity into a verified account or invent verification", async () => {
    const store = new MemoryPersistence();
    const adapter = createAtelierAuthAdapter(store);
    const verified = await adapter.createUser?.({
      id: undefined as unknown as string,
      email: "client.a@example.com",
      name: "Client A",
      emailVerified: new Date("2026-03-01T00:00:00.000Z"),
      image: null
    } as AdapterUser);
    await expect(
      adapter.createUser?.({
        id: undefined as unknown as string,
        email: "client.a@example.com",
        name: "Collision",
        emailVerified: null,
        image: null
      } as AdapterUser)
    ).rejects.toThrow(/Unverified/);
    const kept = await store.getUserById(verified!.id);
    expect(kept?.displayName).toBe("Client A");
    expect(kept?.emailVerifiedAt).toBe("2026-03-01T00:00:00.000Z");

    const unverified = await adapter.createUser?.({
      id: undefined as unknown as string,
      email: "unverified@example.com",
      name: "Unverified",
      emailVerified: null,
      image: null
    } as AdapterUser);
    const stored = await store.getUserById(unverified!.id);
    expect(stored?.emailVerifiedAt).toBeUndefined();
    expect(stored?.role).toBe("client");
    await expect(
      adapter.createUser?.({
        id: undefined as unknown as string,
        email: "unverified@example.com",
        name: "Google Claim",
        emailVerified: new Date(),
        image: null
      } as AdapterUser)
    ).rejects.toThrow(/unverified account cannot be claimed/i);
  });
});
