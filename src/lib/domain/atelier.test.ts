import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AureliusBoundary, aureliusStatus, unavailableNotice } from "@/lib/aurelius/boundary";
import { CONSENT_TEXT } from "@/lib/copy";
import { createEmptyBrief } from "@/lib/brief";
import { ConflictError, ForbiddenError } from "@/lib/domain/errors";
import { ProjectService } from "@/lib/domain/projects";
import { createGuestDraft, parseGuestDraft } from "@/lib/guest/draft";
import { MemoryPersistence } from "@/lib/persistence/memory";
import { seedSimulatedUsers } from "@/lib/auth/identities";
import type { User } from "@/lib/types";

function setup() {
  const store = new MemoryPersistence();
  seedSimulatedUsers(store, ["neil.local@atelier.invalid"]);
  const owner = store.getUserByEmail("owner.local@atelier.invalid") as User;
  const other = store.getUserByEmail("owner-two.local@atelier.invalid") as User;
  const founder = store.getUserByEmail("neil.local@atelier.invalid") as User;
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

  it("adopts a guest draft only after explicit confirmation and keeps later edits off the snapshot", () => {
    const { owner, service } = setup();
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

    expect(() => service.adoptGuestDraft(owner, guest, false)).toThrow(ForbiddenError);

    const project = service.adoptGuestDraft(owner, guest, true);
    expect(project.ownerId).toBe(owner.id);
    expect(project.adoptedFromGuestId).toBe(guest.draftId);
    expect(project.status).toBe("draft");

    const parsed = parseGuestDraft(guest);
    expect(parsed?.kind).toBe("guest_draft");

    const saved = service.saveBrief(
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

    const { submission } = service.submit(
      saved.project.id,
      owner,
      true,
      "idem-submit-1",
      saved.project.version
    );
    expect(submission.receiptId.startsWith("rcpt_")).toBe(true);
    expect(submission.consentText).toBe(CONSENT_TEXT);
    expect(submission.snapshot.bookingProvider.value).toBe("Square Appointments");

    const submittedProject = service.getOwnedProject(saved.project.id, owner);
    service.saveBrief(
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

    const view = service.clientView(project.id, owner);
    expect(view.submission?.snapshot.bookingProvider.value).toBe("Square Appointments");
    expect(view.project.brief.bookingProvider.value).toContain("Edited after submit");
    expect(view.reviewStartedAt).toBeNull();
    expect(view.nextStep.code).toBe("awaiting_founder_receipt");
    expect(view.project.status).toBe("submitted");
  });

  it("denies a second user and keeps founder notes out of the client view", () => {
    const { owner, other, founder, service } = setup();
    const project = service.createProject(owner, createEmptyBrief());
    service.saveBrief(
      project.id,
      owner,
      {
        ...project.brief,
        vision: { key: "vision", value: "Private family practice site", provenance: "client_statement" }
      },
      1
    );
    service.submit(project.id, owner, true, "idem-2", 2);

    expect(() => service.clientView(project.id, other)).toThrow(ForbiddenError);
    expect(() => service.saveBrief(project.id, other, project.brief, 2)).toThrow(ForbiddenError);
    expect(() => service.founderQueue(owner)).toThrow(ForbiddenError);
    expect(() => service.founderView(project.id, owner)).toThrow(ForbiddenError);

    const note = service.addPrivateNote(project.id, founder, "Internal price sketch 8400 — never publish", "internal_proposal");
    expect(note.kind).toBe("internal_proposal");

    const client = service.clientView(project.id, owner);
    expect("privateNotes" in client).toBe(false);
    expect(JSON.stringify(client)).not.toContain("8400");
    expect(JSON.stringify(client)).not.toContain("Internal price");

    const founderView = service.founderView(project.id, founder);
    expect(founderView.privateNotes[0]?.body).toContain("Internal price sketch");
  });

  it("does not show founder review until an authorized review event", () => {
    const { owner, founder, service } = setup();
    const project = service.createProject(owner);
    service.submit(project.id, owner, true, "idem-review", 1);
    const before = service.clientView(project.id, owner);
    expect(before.reviewStartedAt).toBeNull();
    expect(before.nextStep.code).toBe("awaiting_founder_receipt");

    service.startReview(project.id, founder);
    const after = service.clientView(project.id, owner);
    expect(after.reviewStartedAt).toBeTruthy();
    expect(after.project.status).toBe("founder_reviewing");
    expect(after.nextStep.code).toBe("founder_is_reviewing");
  });

  it("publishes clarifications to the owner and keeps retries idempotent", () => {
    const { owner, founder, service } = setup();
    const project = service.createProject(owner);
    const first = service.submit(project.id, owner, true, "same-key", 1);
    const second = service.submit(project.id, owner, true, "same-key", 1);
    expect(second.duplicate).toBe(true);
    expect(second.submission.id).toBe(first.submission.id);

    service.startReview(project.id, founder);
    const update = service.publishUpdate(
      project.id,
      founder,
      "clarification",
      "Which booking platform do you currently use?"
    );
    const view = service.clientView(project.id, owner);
    expect(view.project.status).toBe("clarification_requested");
    expect(view.nextStep.code).toBe("respond_to_clarification");

    service.respondToClarification(project.id, owner, update.id, "Square Appointments");
    const after = service.clientView(project.id, owner);
    expect(after.clarificationResponses).toHaveLength(1);
    expect(after.project.status).toBe("founder_reviewing");
  });

  it("preserves newer typing when a stale save is rejected", () => {
    const { owner, service } = setup();
    const project = service.createProject(owner);
    const first = service.saveBrief(
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
      service.saveBrief(
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
      expect(((error as ConflictError).currentBrief as { vision: { value: string } }).vision.value).toBe("first");
    }
    expect(first.project.brief.vision.value).toBe("first");
    expect(service.getOwnedProject(project.id, owner).brief.vision.value).toBe("first");
  });

  it("records uncertain retries as owner-bound ledger entries without duplicating consent", () => {
    const { owner, service, store } = setup();
    const project = service.createProject(owner);
    service.markUncertain(owner.id, "retry-1", project.id, "submit");
    const ledger = store.getLedger(`${owner.id}:retry-1`);
    expect(ledger?.status).toBe("uncertain");
    expect(ledger?.ownerId).toBe(owner.id);
    const result = service.submit(project.id, owner, true, "retry-1", 1);
    expect(result.duplicate).toBe(false);
    const again = service.submit(project.id, owner, true, "retry-1", 1);
    expect(again.duplicate).toBe(true);
    expect(store.listSubmissions(project.id)).toHaveLength(1);
  });

  it("keeps Aurelius unavailable without disguising fixtures as live AI", () => {
    const { owner, service, store } = setup();
    const project = service.createProject(owner);
    const boundary = new AureliusBoundary(store, service);
    const status = aureliusStatus();
    expect(status.ready).toBe(false);
    expect(status.live).toBe(false);
    expect(unavailableNotice()).toContain("not a live AI reply");

    return boundary
      .reply({ project, user: owner, message: "Can you quote a website?" })
      .then((result) => {
        expect(result.liveAi).toBe(false);
        expect(result.message.liveAi).toBe(false);
        expect(result.message.body).toContain("not a live AI reply");
        const view = service.clientView(project.id, owner);
        expect(view.messages.some((item) => item.authorKind === "client")).toBe(true);
        expect(view.project.brief.vision.value).toBe("");
      });
  });

  it("does not treat suggestions as approved content", () => {
    const { owner, service } = setup();
    const project = service.createProject(owner);
    const suggestion = service.proposeSuggestion(
      project.id,
      "audience",
      "Busy wellness clients booking evening appointments",
      "Inferred from the vision"
    );
    const pending = service.clientView(project.id, owner);
    expect(pending.suggestions[0]?.status).toBe("pending");
    expect(pending.project.brief.audience.pendingSuggestionId).toBe(suggestion.id);

    service.resolveSuggestion(project.id, suggestion.id, owner, "accept");
    const accepted = service.clientView(project.id, owner);
    expect(accepted.project.brief.audience.provenance).toBe("ai_suggestion_accepted");
    expect(accepted.project.brief.audience.provenance).not.toBe("founder_decision");
  });
});
