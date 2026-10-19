import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AureliusBoundary, aureliusStatus, unavailableNotice } from "@/lib/aurelius/boundary";
import { INTELLIGENCE_DISPLAY_NAME, displayIntelligenceLabel } from "@/lib/copy";
import { CONSENT_TEXT } from "@/lib/copy";
import { createEmptyBrief } from "@/lib/brief";
import { ConflictError, ForbiddenError } from "@/lib/domain/errors";
import { ProjectService } from "@/lib/domain/projects";
import { createGuestDraft, parseGuestDraft } from "@/lib/guest/draft";
import { MemoryPersistence } from "@/lib/persistence/memory";
import { seedSimulatedUsers } from "@/lib/auth/identities";
import type { User } from "@/lib/types";

async function setup() {
  const store = new MemoryPersistence();
  await seedSimulatedUsers(store, ["neil.local@atelier.invalid"]);
  const owner = (await store.getUserByEmail("owner.local@atelier.invalid")) as User;
  const other = (await store.getUserByEmail("owner-two.local@atelier.invalid")) as User;
  const founder = (await store.getUserByEmail("neil.local@atelier.invalid")) as User;
  const service = new ProjectService(store);
  return { store, owner, other, founder, service };
}

describe("commission lifecycle", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.ATELIER_PERSISTENCE_ADAPTER = "memory";
    process.env.ATELIER_AUTH_ADAPTER = "simulated";
    process.env.ATELIER_OPENAI_ENABLED = "false";
    delete process.env.OPENAI_API_KEY;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("adopts a guest draft only after explicit confirmation and keeps later edits off the snapshot", async () => {
    const { owner, service } = await setup();
    const guest = createGuestDraft();
    guest.brief.vision.value = "A calm studio site that links to my existing booking page.";
    guest.brief.vision.provenance = "client_statement";
    guest.brief.projectType.value = "booking_connected_website";
    guest.brief.projectType.provenance = "client_statement";
    guest.messages.push({
      id: "local-1",
      authorKind: "client",
      body: "I already use Square Appointments.",
      liveAi: false,
      createdAt: new Date().toISOString()
    });

    await expect(service.adoptGuestDraft(owner, guest, false)).rejects.toBeInstanceOf(ForbiddenError);

    const project = await service.adoptGuestDraft(owner, guest, true);
    expect(project.ownerId).toBe(owner.id);
    expect(project.adoptedFromGuestId).toBe(guest.draftId);
    expect(project.status).toBe("draft");

    const parsed = parseGuestDraft(guest);
    expect(parsed?.kind).toBe("guest_draft");

    const saved = await service.saveBrief(
      project.id,
      owner,
      {
        ...project.brief,
        bookingProvider: {
          key: "bookingProvider",
          value: "Square Appointments",
          provenance: "client_statement"
        }
      },
      project.version
    );

    const { submission } = await service.submit(
      saved.project.id,
      owner,
      true,
      "idem-submit-1",
      saved.project.version
    );
    expect(submission.receiptId.startsWith("rcpt_")).toBe(true);
    expect(submission.consentText).toBe(CONSENT_TEXT);
    expect(submission.snapshot.bookingProvider.value).toBe("Square Appointments");

    const submittedProject = await service.getOwnedProject(saved.project.id, owner);
    await service.saveBrief(
      saved.project.id,
      owner,
      {
        ...submittedProject.brief,
        bookingProvider: {
          key: "bookingProvider",
          value: "Edited after submit — must not rewrite snapshot",
          provenance: "client_statement"
        }
      },
      submittedProject.version
    );

    const view = await service.clientView(project.id, owner);
    expect(view.submission?.snapshot.bookingProvider.value).toBe("Square Appointments");
    expect(view.project.brief.bookingProvider.value).toContain("Edited after submit");
    expect(view.reviewStartedAt).toBeNull();
    expect(view.nextStep.code).toBe("awaiting_founder_receipt");
    expect(view.project.status).toBe("submitted");
  });

  it("denies a second user and keeps founder notes out of the client view", async () => {
    const { owner, other, founder, service } = await setup();
    const project = await service.createProject(owner, createEmptyBrief());
    await service.saveBrief(
      project.id,
      owner,
      {
        ...project.brief,
        vision: { key: "vision", value: "Private family practice site", provenance: "client_statement" }
      },
      1
    );
    await service.submit(project.id, owner, true, "idem-2", 2);

    await expect(service.clientView(project.id, other)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(service.saveBrief(project.id, other, project.brief, 2)).rejects.toBeInstanceOf(
      ForbiddenError
    );
    await expect(service.founderQueue(owner)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(service.founderView(project.id, owner)).rejects.toBeInstanceOf(ForbiddenError);

    const note = await service.addPrivateNote(
      project.id,
      founder,
      "Internal price sketch 8400 — never publish",
      "internal_proposal"
    );
    expect(note.kind).toBe("internal_proposal");

    const client = await service.clientView(project.id, owner);
    expect("privateNotes" in client).toBe(false);
    expect(JSON.stringify(client)).not.toContain("8400");
    expect(JSON.stringify(client)).not.toContain("Internal price");

    const founderView = await service.founderView(project.id, founder);
    expect(founderView.privateNotes[0]?.body).toContain("Internal price sketch");
  });

  it("does not show founder review until an authorized review event", async () => {
    const { owner, founder, service } = await setup();
    const project = await service.createProject(owner);
    await service.submit(project.id, owner, true, "idem-review", 1);
    const before = await service.clientView(project.id, owner);
    expect(before.reviewStartedAt).toBeNull();
    expect(before.nextStep.code).toBe("awaiting_founder_receipt");

    await service.startReview(project.id, founder);
    const after = await service.clientView(project.id, owner);
    expect(after.reviewStartedAt).toBeTruthy();
    expect(after.project.status).toBe("founder_reviewing");
    expect(after.nextStep.code).toBe("founder_is_reviewing");
  });

  it("publishes clarifications to the owner and keeps retries idempotent", async () => {
    const { owner, founder, service } = await setup();
    const project = await service.createProject(owner);
    const first = await service.submit(project.id, owner, true, "same-key", 1);
    const second = await service.submit(project.id, owner, true, "same-key", 1);
    expect(second.duplicate).toBe(true);
    expect(second.submission.id).toBe(first.submission.id);

    await service.startReview(project.id, founder);
    const update = await service.publishUpdate(
      project.id,
      founder,
      "clarification",
      "Which booking platform do you currently use?"
    );
    const view = await service.clientView(project.id, owner);
    expect(view.project.status).toBe("clarification_requested");
    expect(view.nextStep.code).toBe("respond_to_clarification");

    await service.respondToClarification(project.id, owner, update.id, "Square Appointments");
    const after = await service.clientView(project.id, owner);
    expect(after.clarificationResponses).toHaveLength(1);
    expect(after.project.status).toBe("founder_reviewing");
  });

  it("preserves newer typing when a stale save is rejected", async () => {
    const { owner, service } = await setup();
    const project = await service.createProject(owner);
    const first = await service.saveBrief(
      project.id,
      owner,
      {
        ...project.brief,
        vision: { key: "vision", value: "first", provenance: "client_statement" }
      },
      1,
      1
    );
    try {
      await service.saveBrief(
        project.id,
        owner,
        {
          ...project.brief,
          vision: { key: "vision", value: "stale", provenance: "client_statement" }
        },
        1,
        2
      );
      throw new Error("expected conflict");
    } catch (error) {
      expect(error).toBeInstanceOf(ConflictError);
      expect((error as ConflictError).currentVersion).toBe(first.project.version);
      expect(((error as ConflictError).currentBrief as { vision: { value: string } }).vision.value).toBe(
        "first"
      );
    }
    expect(first.project.brief.vision.value).toBe("first");
    expect((await service.getOwnedProject(project.id, owner)).brief.vision.value).toBe("first");
  });

  it("records uncertain retries as owner-bound ledger entries without duplicating consent", async () => {
    const { owner, service, store } = await setup();
    const project = await service.createProject(owner);
    await service.markUncertain(owner.id, "retry-1", project.id, "submit");
    const ledger = await store.getLedger(`${owner.id}:retry-1`);
    expect(ledger?.status).toBe("uncertain");
    expect(ledger?.ownerId).toBe(owner.id);
    const result = await service.submit(project.id, owner, true, "retry-1", 1);
    expect(result.duplicate).toBe(false);
    const again = await service.submit(project.id, owner, true, "retry-1", 1);
    expect(again.duplicate).toBe(true);
    expect(await store.listSubmissions(project.id)).toHaveLength(1);
  });

  it("maps stored Aurelius labels to Aethelios without rewriting persisted identifiers", () => {
    expect(INTELLIGENCE_DISPLAY_NAME).toBe("Aethelios");
    expect(displayIntelligenceLabel("Aurelius is unavailable.")).toBe("Aethelios is unavailable.");
    expect(displayIntelligenceLabel("Aethelios suggestion — not approved")).toBe(
      "Aethelios suggestion — not approved"
    );
  });

  it("keeps Aethelios unavailable without disguising fixtures as live AI", async () => {
    const { owner, service, store } = await setup();
    const project = await service.createProject(owner);
    const boundary = new AureliusBoundary(store, service);
    const status = aureliusStatus();
    expect(status.ready).toBe(false);
    expect(status.live).toBe(false);
    expect(unavailableNotice()).toContain("not a live AI reply");

    const result = await boundary.reply({
      project,
      user: owner,
      message: "Can you quote a website?"
    });
    expect(result.liveAi).toBe(false);
    expect(result.message.liveAi).toBe(false);
    expect(result.message.body).toContain("not a live AI reply");
    const view = await service.clientView(project.id, owner);
    expect(view.messages.some((item) => item.authorKind === "client")).toBe(true);
    expect(view.project.brief.vision.value).toBe("");
  });

  it("does not treat suggestions as approved content", async () => {
    const { owner, service } = await setup();
    const project = await service.createProject(owner);
    const suggestion = await service.proposeSuggestion(
      project.id,
      "audience",
      "Busy wellness clients booking evening appointments",
      "Inferred from the vision"
    );
    const pending = await service.clientView(project.id, owner);
    expect(pending.suggestions[0]?.status).toBe("pending");
    expect(pending.project.brief.audience.pendingSuggestionId).toBe(suggestion.id);

    await service.resolveSuggestion(project.id, suggestion.id, owner, "accept");
    const accepted = await service.clientView(project.id, owner);
    expect(accepted.project.brief.audience.provenance).toBe("ai_suggestion_accepted");
    expect(accepted.project.brief.audience.provenance).not.toBe("founder_decision");
  });
});
