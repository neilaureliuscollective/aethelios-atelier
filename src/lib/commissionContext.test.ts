import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  applyBriefContext,
  applyClientValue,
  applyCommissionIntent,
  createEmptyBrief,
  fieldsForStep,
  isBookingConnected,
  normalizeBrief
} from "@/lib/brief";
import { briefsEqual } from "@/lib/client/briefDiff";
import {
  needsBrandQuestions,
  parseCommissionIntent,
  normalizeCommissionContext
} from "@/lib/commissionContext";
import { AURELIUS_FACTS } from "@/lib/catalog";
import { seedSimulatedUsers } from "@/lib/auth/identities";
import { ForbiddenError } from "@/lib/domain/errors";
import { ProjectService } from "@/lib/domain/projects";
import { proposalSeedKind, seedProposalScope } from "@/lib/domain/proposal";
import { MemoryPersistence } from "@/lib/persistence/memory";
import type { User } from "@/lib/types";

describe("commission context metadata", () => {
  it("leaves historical briefs without context untouched", () => {
    const historical = normalizeBrief({
      vision: { key: "vision", value: "A calm studio site.", provenance: "client_statement" },
      projectType: { key: "projectType", value: "booking_connected_website", provenance: "client_statement" }
    });
    expect(historical.context).toBeUndefined();
    expect(historical.projectType.value).toBe("booking_connected_website");
    expect(historical.vision.value).toBe("A calm studio site.");
  });

  it("preserves purpose separately from the stored project type", () => {
    const brief = normalizeBrief({
      projectType: { key: "projectType", value: "custom_apps_platforms", provenance: "client_statement" },
      context: { version: 1, purpose: "study", route: "custom_project", exampleId: "study_organizer", bookingNeeded: null }
    });
    expect(brief.projectType.value).toBe("custom_apps_platforms");
    expect(brief.context?.purpose).toBe("study");
    expect(normalizeCommissionContext({ purpose: "not-real" })).toBeUndefined();
  });

  it("does not treat every custom app as a booking or branding project", () => {
    const tool = applyCommissionIntent(createEmptyBrief(), parseCommissionIntent(new URLSearchParams("interest=custom_apps_platforms&purpose=business")));
    expect(tool.projectType.value).toBe("custom_apps_platforms");
    expect(isBookingConnected(tool)).toBe(false);
    expect(needsBrandQuestions(tool)).toBe(false);
    expect(fieldsForStep(3, tool)).toEqual(["existingWebsite"]);
    expect(fieldsForStep(4, tool)).not.toContain("bookingProvider");
    expect(fieldsForStep(4, tool)).not.toContain("references");
  });

  it("starts the barbers and salons offer as a business website with booking", () => {
    const offer = applyCommissionIntent(
      createEmptyBrief(),
      parseCommissionIntent(new URLSearchParams("offer=barbers_salons"))
    );
    expect(offer.context?.offerId).toBe("barbers_salons");
    expect(offer.context?.purpose).toBe("business");
    expect(offer.context?.route).toBe("business");
    expect(offer.context?.bookingNeeded).toBe(true);
    expect(offer.projectType.value).toBe("website");
    expect(isBookingConnected(offer)).toBe(true);
    expect(offer.vision.value).toMatch(/barber shop or salon/i);
    expect(offer.context?.showcaseId).toBe("");
  });

  it("records Fix It Shop as showcase source without forcing the salon offer", () => {
    const showcase = applyCommissionIntent(
      createEmptyBrief(),
      parseCommissionIntent(new URLSearchParams("source=fix_it_shop"))
    );
    expect(showcase.context?.showcaseId).toBe("fix_it_shop");
    expect(showcase.context?.offerId).toBe("");
    expect(showcase.context?.purpose).toBe("");
    expect(showcase.context?.route).toBe("");
    expect(showcase.context?.bookingNeeded).toBeNull();
    expect(showcase.projectType.value).toBe("");
    expect(showcase.vision.value).toBe("");

    const specialist = applyCommissionIntent(
      createEmptyBrief(),
      parseCommissionIntent(
        new URLSearchParams("offer=barbers_salons&interest=website&purpose=business&booking=1&source=fix_it_shop")
      )
    );
    expect(specialist.context?.offerId).toBe("barbers_salons");
    expect(specialist.context?.showcaseId).toBe("fix_it_shop");
    expect(specialist.context?.purpose).toBe("business");
    expect(specialist.projectType.value).toBe("website");

    const kept = applyCommissionIntent(
      applyClientValue(createEmptyBrief(), "vision", "A written brief that must stay."),
      parseCommissionIntent(new URLSearchParams("source=fix_it_shop"))
    );
    expect(kept.vision.value).toBe("A written brief that must stay.");
    expect(kept.context?.showcaseId).toBe("fix_it_shop");
    expect(kept.context?.offerId).toBe("");
  });

  it("asks booking questions only for the historical type or an explicit request", () => {
    const historical = normalizeBrief({
      projectType: { key: "projectType", value: "booking_connected_website", provenance: "client_statement" }
    });
    expect(isBookingConnected(historical)).toBe(true);
    expect(fieldsForStep(4, historical)).toContain("bookingProvider");

    const explicit = applyCommissionIntent(
      createEmptyBrief(),
      parseCommissionIntent(new URLSearchParams("interest=custom_apps_platforms&purpose=business&booking=1"))
    );
    expect(isBookingConnected(explicit)).toBe(true);
  });

  it("treats purpose metadata as a real brief change", () => {
    const empty = createEmptyBrief();
    const withPurpose = applyBriefContext(empty, { purpose: "personal", route: "custom_project" });
    expect(briefsEqual(empty, withPurpose)).toBe(false);
    expect(briefsEqual(withPurpose, applyBriefContext(createEmptyBrief(), { purpose: "personal", route: "custom_project" }))).toBe(
      true
    );
  });

  it("replaces an illustrative starter when a different example arrives, without touching edited text", () => {
    const study = applyCommissionIntent(
      createEmptyBrief(),
      parseCommissionIntent(new URLSearchParams("purpose=study&example=study_organizer"))
    );
    const switched = applyCommissionIntent(
      study,
      parseCommissionIntent(new URLSearchParams("purpose=personal&example=personal_tracker"))
    );
    expect(switched.vision.value).toMatch(/personal commitments/i);
    expect(switched.context?.exampleId).toBe("personal_tracker");

    const edited = applyClientValue(study, "vision", "My own study idea, written by me.");
    const kept = applyCommissionIntent(
      edited,
      parseCommissionIntent(new URLSearchParams("purpose=personal&example=personal_tracker"))
    );
    expect(kept.vision.value).toBe("My own study idea, written by me.");
  });

  it("starts a functional example without submitting and keeps the idea editable", () => {
    const study = applyCommissionIntent(
      createEmptyBrief(),
      parseCommissionIntent(new URLSearchParams("purpose=study&example=study_organizer&route=custom_project"))
    );
    expect(study.context?.purpose).toBe("study");
    expect(study.projectType.value).toBe("undecided");
    expect(study.vision.value).toMatch(/study list/i);
    expect(needsBrandQuestions(study)).toBe(false);
    expect(fieldsForStep(3, study)).toEqual(["existingWebsite"]);
    expect(fieldsForStep(4, study)).not.toContain("bookingProvider");

    const personal = applyCommissionIntent(
      createEmptyBrief(),
      parseCommissionIntent(new URLSearchParams("purpose=personal&example=personal_tracker"))
    );
    expect(personal.context?.purpose).toBe("personal");
    expect(proposalSeedKind(personal)).toBe("personal");
  });
});

describe("tailored proposal seeds", () => {
  it("keeps website pages on a branded website and not on a functional tool", () => {
    const website = applyCommissionIntent(createEmptyBrief(), parseCommissionIntent(new URLSearchParams("interest=website&purpose=business")));
    website.vision.value = "A public site for the practice.";
    const websiteScope = seedProposalScope(website);
    expect(websiteScope.includedPages).toEqual(["Home", "About", "Contact"]);
    expect(websiteScope.clientResponsibilities.join(" ")).toMatch(/brand materials/i);

    const tool = applyCommissionIntent(
      createEmptyBrief(),
      parseCommissionIntent(new URLSearchParams("interest=custom_apps_platforms&purpose=business"))
    );
    tool.vision.value = "An internal follow-up list for the studio.";
    const toolScope = seedProposalScope(tool);
    expect(toolScope.includedPages).toEqual([]);
    expect(toolScope.includedFeatures.join(" ")).toMatch(/actions/i);
    expect(toolScope.clientResponsibilities.join(" ")).not.toMatch(/photographs/i);
    expect(toolScope.exclusions.join(" ")).toMatch(/booking engine/i);
  });

  it("seeds study and personal utilities with bounded outcomes", () => {
    const study = applyCommissionIntent(
      createEmptyBrief(),
      parseCommissionIntent(new URLSearchParams("purpose=study&example=study_organizer"))
    );
    const studyScope = seedProposalScope(study);
    expect(studyScope.includedFeatures).toEqual(
      expect.arrayContaining(["Topic organization", "Practice or error log", "A simple review interaction"])
    );
    expect(studyScope.exclusions.join(" ")).toMatch(/school-system/i);

    const personal = applyCommissionIntent(
      createEmptyBrief(),
      parseCommissionIntent(new URLSearchParams("purpose=personal&example=personal_tracker"))
    );
    const personalScope = seedProposalScope(personal);
    expect(personalScope.deliverables.join(" ")).toMatch(/bounded personal utility/i);
    expect(personalScope.includedPages).toEqual([]);
  });

  it("keeps a historical booking snapshot on the booking-site seed", () => {
    const historical = normalizeBrief({
      vision: { key: "vision", value: "Link the site to Square.", provenance: "client_statement" },
      projectType: { key: "projectType", value: "booking_connected_website", provenance: "client_statement" }
    });
    const scope = seedProposalScope(historical);
    expect(scope.includedPages).toContain("Booking destination");
    expect(proposalSeedKind(historical)).toBe("booking_site");
  });
});

describe("commission journey persistence", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.ATELIER_PERSISTENCE_ADAPTER = "memory";
    process.env.ATELIER_AUTH_ADAPTER = "simulated";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("keeps purpose metadata through save, submit, and founder review without rewriting old snapshots", async () => {
    const store = new MemoryPersistence();
    await seedSimulatedUsers(store, ["neil.local@atelier.invalid"]);
    const owner = (await store.getUserByEmail("owner.local@atelier.invalid")) as User;
    const other = (await store.getUserByEmail("owner-two.local@atelier.invalid")) as User;
    const founder = (await store.getUserByEmail("neil.local@atelier.invalid")) as User;
    const service = new ProjectService(store);

    const historical = await service.createProject(
      owner,
      normalizeBrief({
        vision: { key: "vision", value: "Original branded site", provenance: "client_statement" },
        projectType: { key: "projectType", value: "website", provenance: "client_statement" }
      })
    );
    expect(historical.brief.context).toBeUndefined();

    const study = applyCommissionIntent(
      createEmptyBrief(),
      parseCommissionIntent(new URLSearchParams("purpose=study&example=study_organizer"))
    );
    const project = await service.createProject(owner, study);
    expect(project.brief.context?.purpose).toBe("study");
    const saved = await service.saveBrief(project.id, owner, project.brief, project.version);
    await service.submit(saved.project.id, owner, true, "study-submit", saved.project.version);
    const view = await service.clientView(project.id, owner);
    expect(view.submission?.snapshot.context?.purpose).toBe("study");
    expect(view.submission?.snapshot.context?.exampleId).toBe("study_organizer");

    const founderView = await service.founderView(project.id, founder);
    expect(founderView.project.brief.context?.purpose).toBe("study");
    expect(seedProposalScope(founderView.submission?.snapshot ?? founderView.project.brief).includedPages).toEqual([]);

    await expect(service.clientView(project.id, other)).rejects.toBeInstanceOf(ForbiddenError);
    const old = await service.clientView(historical.id, owner);
    expect(old.project.brief.context).toBeUndefined();
    expect(old.project.brief.projectType.value).toBe("website");
  });
});

describe("catalog facts", () => {
  it("states business-first Atelier plus the secondary custom-project route", () => {
    const facts = AURELIUS_FACTS.join(" ");
    expect(facts).toMatch(/business-first/i);
    expect(facts).toMatch(/study tools/i);
    expect(facts).toMatch(/personal utilities/i);
    expect(facts).toMatch(/do not replace business clients/i);
    expect(facts).toMatch(/when that is part of the request/i);
    expect(facts).toMatch(/not lower quality or unlimited work at a discount/i);
  });
});
