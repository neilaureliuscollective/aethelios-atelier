import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { seedSimulatedUsers } from "@/lib/auth/identities";
import {
  applyCommissionIntent,
  applyClientValue,
  createEmptyBrief,
  fieldsForStep,
  isBookingConnected
} from "@/lib/brief";
import { needsBrandQuestions, parseCommissionIntent } from "@/lib/commissionContext";
import { ConflictError, ForbiddenError } from "@/lib/domain/errors";
import { ProjectService } from "@/lib/domain/projects";
import { proposalSeedKind } from "@/lib/domain/proposal";
import { createGuestDraft } from "@/lib/guest/draft";
import { MemoryPersistence } from "@/lib/persistence/memory";
import type { Brief, ProposalScope, User } from "@/lib/types";

const originalEnv = { ...process.env };

async function setup() {
  process.env.ATELIER_PERSISTENCE_ADAPTER = "memory";
  process.env.ATELIER_AUTH_ADAPTER = "simulated";
  const store = new MemoryPersistence();
  await seedSimulatedUsers(store, ["neil.local@atelier.invalid"]);
  const owner = (await store.getUserByEmail("owner.local@atelier.invalid")) as User;
  const other = (await store.getUserByEmail("owner-two.local@atelier.invalid")) as User;
  const founder = (await store.getUserByEmail("neil.local@atelier.invalid")) as User;
  return { store, owner, other, founder, service: new ProjectService(store) };
}

function websiteBrief(): Brief {
  let brief = applyCommissionIntent(
    createEmptyBrief(),
    parseCommissionIntent(new URLSearchParams("interest=website&purpose=business&route=business"))
  );
  brief = applyClientValue(brief, "vision", "A public site for the sitting-room practice.");
  brief = applyClientValue(brief, "audience", "Local clients looking for a considered first visit.");
  brief = applyClientValue(brief, "references", "Quiet gold, deep green, and ivory.");
  brief = applyClientValue(brief, "goals", "Look considered and invite enquiry.");
  return brief;
}

function workflowBrief(): Brief {
  let brief = applyCommissionIntent(
    createEmptyBrief(),
    parseCommissionIntent(
      new URLSearchParams("purpose=professional_workflow&example=follow_up_workspace&route=custom_project")
    )
  );
  brief = applyClientValue(brief, "vision", "A follow-up list for people I still need to return to.");
  brief = applyClientValue(brief, "audience", "Just me, later a small studio if it helps.");
  brief = applyClientValue(brief, "existingWebsite", "A notes app and a few email reminders.");
  brief = applyClientValue(brief, "goals", "See what is waiting and change priority or status.");
  return brief;
}

function priceScope(scope: ProposalScope): ProposalScope {
  return {
    ...scope,
    price: {
      amount: "6400",
      currency: "USD",
      terms: "Founder-set. Not a collected payment.",
      paymentStatus: "not_collected"
    }
  };
}

describe("combined-head commission journeys", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.ATELIER_PERSISTENCE_ADAPTER = "memory";
    process.env.ATELIER_AUTH_ADAPTER = "simulated";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("takes a business website from guest intake through exact proposal acceptance", async () => {
    const { owner, other, founder, service } = await setup();
    const intake = websiteBrief();
    expect(intake.context?.purpose).toBe("business");
    expect(intake.context?.route).toBe("business");
    expect(intake.projectType.value).toBe("website");
    expect(needsBrandQuestions(intake)).toBe(true);
    expect(isBookingConnected(intake)).toBe(false);
    expect(fieldsForStep(3, intake)).toEqual(expect.arrayContaining(["references"]));
    expect(fieldsForStep(4, intake)).not.toContain("bookingProvider");

    const guest = createGuestDraft();
    guest.brief = intake;
    await expect(service.adoptGuestDraft(owner, guest, false)).rejects.toBeInstanceOf(ForbiddenError);
    const project = await service.adoptGuestDraft(owner, guest, true);
    expect(project.brief.context?.purpose).toBe("business");
    expect(project.adoptedFromGuestId).toBe(guest.draftId);

    const reloaded = await service.getOwnedProject(project.id, owner);
    expect(reloaded.brief.context?.route).toBe("business");
    expect(reloaded.brief.references.value).toMatch(/Quiet gold/);

    const saved = await service.saveBrief(project.id, owner, reloaded.brief, reloaded.version);
    await expect(service.saveBrief(project.id, owner, reloaded.brief, reloaded.version)).rejects.toBeInstanceOf(
      ConflictError
    );

    const first = await service.submit(saved.project.id, owner, true, "website-submit", saved.project.version);
    const retry = await service.submit(saved.project.id, owner, true, "website-submit", saved.project.version);
    expect(retry.duplicate).toBe(true);
    expect(retry.submission.receiptId).toBe(first.submission.receiptId);

    await expect(
      service.submit(saved.project.id, owner, true, "website-stale", reloaded.version)
    ).rejects.toBeInstanceOf(ConflictError);

    const queue = await service.founderQueue(founder);
    expect(queue.some((item) => item.id === project.id)).toBe(true);
    await service.startReview(project.id, founder);
    const founderView = await service.founderView(project.id, founder);
    expect(founderView.project.brief.context?.purpose).toBe("business");
    expect(founderView.submission?.snapshot.context?.purpose).toBe("business");
    expect(founderView.submission?.snapshot.context?.route).toBe("business");
    expect(founderView.submission?.snapshot.references.value).toMatch(/Quiet gold/);
    expect(proposalSeedKind(founderView.submission?.snapshot ?? founderView.project.brief)).toBe("website");

    const draft = await service.saveProposalDraft(project.id, founder, {}, "Website offer", true);
    expect(draft.scope.includedPages).toEqual(["Home", "About", "Contact"]);
    expect(draft.scope.summary).toBe("A public site for the sitting-room practice.");
    const priced = await service.saveProposalDraft(project.id, founder, priceScope(draft.scope), "Website offer");
    const published = await service.publishProposal(project.id, founder, priced.id);
    const decided = await service.decideProposal(
      project.id,
      owner,
      published.id,
      "approve",
      published.version,
      "",
      true
    );
    expect(decided.proposal.status).toBe("approved");
    expect(decided.proposal.version).toBe(published.version);

    await expect(service.clientView(project.id, other)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(service.saveBrief(project.id, other, intake, saved.project.version)).rejects.toBeInstanceOf(
      ForbiddenError
    );
    await expect(
      service.decideProposal(project.id, other, published.id, "approve", published.version, "", true)
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(service.founderView(project.id, owner)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("takes a professional workflow without brand or booking through exact proposal acceptance", async () => {
    const { owner, other, founder, service } = await setup();
    const intake = workflowBrief();
    expect(intake.context?.purpose).toBe("professional_workflow");
    expect(intake.context?.route).toBe("custom_project");
    expect(intake.context?.exampleId).toBe("follow_up_workspace");
    expect(needsBrandQuestions(intake)).toBe(false);
    expect(isBookingConnected(intake)).toBe(false);
    expect(fieldsForStep(3, intake)).toEqual(["existingWebsite"]);
    expect(fieldsForStep(4, intake)).not.toContain("bookingProvider");
    expect(fieldsForStep(4, intake)).not.toContain("references");

    const guest = createGuestDraft();
    guest.brief = intake;
    const project = await service.adoptGuestDraft(owner, guest, true);
    const again = await service.adoptGuestDraft(owner, guest, true);
    expect(again.id).toBe(project.id);

    const saved = await service.saveBrief(project.id, owner, project.brief, project.version);
    const submitted = await service.submit(saved.project.id, owner, true, "workflow-submit", saved.project.version);
    const retry = await service.submit(saved.project.id, owner, true, "workflow-submit", saved.project.version);
    expect(retry.duplicate).toBe(true);
    expect(retry.submission.id).toBe(submitted.submission.id);

    await service.startReview(project.id, founder);
    const founderView = await service.founderView(project.id, founder);
    expect(founderView.project.brief.context?.purpose).toBe("professional_workflow");
    expect(founderView.submission?.snapshot.context?.exampleId).toBe("follow_up_workspace");
    expect(founderView.submission?.snapshot.context?.bookingNeeded ?? null).toBeNull();
    expect(proposalSeedKind(founderView.submission?.snapshot ?? founderView.project.brief)).toBe(
      "professional_tool"
    );

    const draft = await service.saveProposalDraft(project.id, founder, {}, "Workflow offer", true);
    expect(draft.scope.includedPages).toEqual([]);
    expect(draft.scope.includedFeatures.join(" ")).toMatch(/actions/i);
    expect(draft.scope.clientResponsibilities.join(" ")).not.toMatch(/photographs/i);
    expect(draft.scope.exclusions.join(" ")).toMatch(/booking engine/i);
    const priced = await service.saveProposalDraft(project.id, founder, priceScope(draft.scope), "Workflow offer");
    const published = await service.publishProposal(project.id, founder, priced.id);
    await expect(
      service.decideProposal(project.id, owner, published.id, "approve", 99, "", true)
    ).rejects.toBeInstanceOf(ConflictError);
    const decided = await service.decideProposal(
      project.id,
      owner,
      published.id,
      "approve",
      published.version,
      "",
      true
    );
    expect(decided.proposal.status).toBe("approved");
    expect(decided.proposal.scope.summary).toBe("A follow-up list for people I still need to return to.");

    await expect(service.clientView(project.id, other)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(service.founderQueue(owner)).rejects.toBeInstanceOf(ForbiddenError);
  });
});
