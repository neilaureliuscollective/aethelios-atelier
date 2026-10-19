import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createEmptyBrief } from "@/lib/brief";
import { PROPOSAL_AGREEMENT_TEXT } from "@/lib/copy";
import { ConflictError, ForbiddenError } from "@/lib/domain/errors";
import { ProjectService } from "@/lib/domain/projects";
import { seedProposalScope } from "@/lib/domain/proposal";
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

async function submittedCommission(service: ProjectService, owner: User, founder: User) {
  const project = await service.createProject(owner, {
    ...createEmptyBrief(),
    vision: {
      key: "vision",
      value: "A calm studio site that links to Square Appointments.",
      provenance: "client_statement"
    },
    projectType: {
      key: "projectType",
      value: "booking_connected_website",
      provenance: "client_statement"
    },
    priorities: {
      key: "priorities",
      value: "Quiet luxury, never crowded.",
      provenance: "client_statement"
    }
  });
  await service.submit(project.id, owner, true, "proposal-submit", project.version);
  await service.startReview(project.id, founder);
  return service.getOwnedProject(project.id, owner);
}

describe("proposal approval workflow", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.ATELIER_PERSISTENCE_ADAPTER = "memory";
    process.env.ATELIER_AUTH_ADAPTER = "simulated";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("keeps unpublished drafts and private notes off the client view", async () => {
    const { owner, other, founder, service } = await setup();
    const project = await submittedCommission(service, owner, founder);
    await service.addPrivateNote(project.id, founder, "Internal price sketch 8400 — never publish", "internal_proposal");
    const draft = await service.saveProposalDraft(project.id, founder, {}, "", true);
    expect(draft.status).toBe("draft");
    expect(draft.scope.deliverables.length).toBeGreaterThan(0);

    const client = await service.clientView(project.id, owner);
    expect(client.proposals).toHaveLength(0);
    expect(JSON.stringify(client)).not.toContain("8400");
    expect(JSON.stringify(client)).not.toContain("internal_proposal");
    expect(JSON.stringify(client)).not.toContain("privateNotes");
    await expect(service.clientView(project.id, other)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(service.publishProposal(project.id, owner, draft.id)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("lets the client review, send back, and agree to an exact published version", async () => {
    const { owner, founder, service } = await setup();
    const project = await submittedCommission(service, owner, founder);
    const draft = await service.saveProposalDraft(project.id, founder, {}, "First scoped offer", true);
    await expect(service.publishProposal(project.id, founder, draft.id)).rejects.toBeInstanceOf(ForbiddenError);

    const priced = await service.saveProposalDraft(
      project.id,
      founder,
      { ...draft.scope, price: { ...draft.scope.price, amount: "9200" } },
      "First scoped offer"
    );
    const published = await service.publishProposal(project.id, founder, priced.id);
    expect(published.status).toBe("published");
    expect(published.version).toBe(1);

    const waiting = await service.clientView(project.id, owner);
    expect(waiting.proposals).toHaveLength(1);
    expect(waiting.proposals[0]?.status).toBe("published");
    expect(waiting.nextStep.code).toBe("review_proposal");
    expect(waiting.project.status).toBe("proposal_ready");

    await expect(
      service.decideProposal(project.id, owner, published.id, "approve", 99, "", true)
    ).rejects.toBeInstanceOf(ConflictError);

    const changes = await service.decideProposal(
      project.id,
      owner,
      published.id,
      "request_changes",
      1,
      "Please include a treatments page and keep Square as the booking destination."
    );
    expect(changes.proposal.status).toBe("changes_requested");
    expect((await service.clientView(project.id, owner)).nextStep.code).toBe("proposal_revision_in_progress");

    const v2 = await service.saveProposalDraft(
      project.id,
      founder,
      {
        ...priced.scope,
        price: { ...priced.scope.price, amount: "9200" },
        includedPages: [...priced.scope.includedPages, "Treatments"]
      },
      "Added treatments page after client request"
    );
    expect(v2.version).toBe(2);
    expect(v2.id).not.toBe(published.id);
    const original = await service.clientView(project.id, owner);
    expect(original.proposals.find((item) => item.version === 1)?.scope.includedPages).not.toContain("Treatments");

    const publishedV2 = await service.publishProposal(project.id, founder, v2.id);
    expect(publishedV2.version).toBe(2);
    const afterPublish = await service.clientView(project.id, owner);
    expect(afterPublish.proposals.find((item) => item.version === 1)?.status).toBe("superseded");
    expect(afterPublish.proposals.find((item) => item.version === 2)?.status).toBe("published");

    const approved = await service.decideProposal(
      project.id,
      owner,
      publishedV2.id,
      "approve",
      2,
      "",
      true
    );
    expect(approved.proposal.status).toBe("approved");
    expect(approved.decision.agreementText).toBe(PROPOSAL_AGREEMENT_TEXT);
    const confirmed = await service.clientView(project.id, owner);
    expect(confirmed.project.status).toBe("scope_confirmed");
    expect(confirmed.nextStep.code).toBe("read_confirmed_scope");
    expect(confirmed.milestones.length).toBeGreaterThan(0);
    expect(confirmed.proposals.find((item) => item.version === 2)?.scope.includedPages).toContain("Treatments");

    const mutation = confirmed.proposals.find((item) => item.version === 1);
    expect(mutation?.scope.includedPages).not.toContain("Treatments");

    const founderView = await service.founderView(project.id, founder);
    expect(founderView.handoff?.confirmedProposalVersion).toBe(2);
    expect(founderView.handoff?.markdown).toContain("Treatments");
    expect(founderView.handoff?.markdown).toContain("not_collected");
    expect(JSON.stringify(confirmed)).not.toContain("handoff");
  });

  it("binds design review feedback to a version and keeps later edits as a new version", async () => {
    const { owner, founder, service } = await setup();
    const project = await submittedCommission(service, owner, founder);
    const draft = await service.saveProposalDraft(
      project.id,
      founder,
      { ...seedProposalScope(project.brief), price: { amount: "6400", currency: "USD", terms: "Founder-set", paymentStatus: "not_collected" } },
      "Scoped"
    );
    const published = await service.publishProposal(project.id, founder, draft.id);
    await service.decideProposal(project.id, owner, published.id, "approve", published.version, "", true);

    const design = await service.saveDeliveryDraft(project.id, founder, {
      kind: "design",
      title: "First composition",
      summary: "Quiet home and booking path.",
      previewUrl: "https://preview.atelier.invalid/v1"
    });
    const shown = await service.publishDeliveryVersion(project.id, founder, design.id);
    const reviewing = await service.clientView(project.id, owner);
    expect(reviewing.nextStep.code).toBe("review_delivery_version");
    expect(reviewing.deliveryVersions).toHaveLength(1);

    await service.addDeliveryFeedback(
      project.id,
      owner,
      shown.id,
      "request_changes",
      1,
      "Soften the gold and keep more empty space on the home frame."
    );
    const v2 = await service.saveDeliveryDraft(project.id, founder, {
      kind: "design",
      title: "Revised composition",
      summary: "Softer gold, more quiet space on home."
    });
    expect(v2.version).toBe(2);
    const publishedV2 = await service.publishDeliveryVersion(project.id, founder, v2.id);
    await service.addDeliveryFeedback(project.id, owner, publishedV2.id, "approve", 2, "", true);

    const done = await service.clientView(project.id, owner);
    expect(done.deliveryVersions.find((item) => item.version === 1)?.status).toBe("superseded");
    expect(done.deliveryVersions.find((item) => item.version === 2)?.status).toBe("approved");
    expect(done.deliveryFeedback.every((item) => item.expectedVersion === 1 || item.expectedVersion === 2)).toBe(true);

    const content = await service.addContentRequest(
      project.id,
      founder,
      "Logo files",
      "Please send the vector mark and wordmark."
    );
    const waiting = await service.clientView(project.id, owner);
    expect(waiting.nextStep.code).toBe("provide_client_content");
    await service.respondToContentRequest(project.id, owner, content.id, "Logo pack is in the shared folder.");
    const queue = await service.founderQueue(founder);
    const row = queue.find((item) => item.id === project.id);
    expect(row?.confirmedProposalVersion).toBe(1);
    expect(row?.attention.some((item) => item.code === "next_milestone")).toBe(true);
  });
});
