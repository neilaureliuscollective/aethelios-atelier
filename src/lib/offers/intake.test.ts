import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { seedSimulatedUsers } from "@/lib/auth/identities";
import {
  applyClientValue,
  applyCommissionIntent,
  briefTitle,
  createEmptyBrief,
  fieldLabel,
  fieldsForStep,
  isBookingConnected
} from "@/lib/brief";
import { briefsEqual } from "@/lib/client/briefDiff";
import { parseCommissionIntent } from "@/lib/commissionContext";
import { ForbiddenError } from "@/lib/domain/errors";
import { ProjectService } from "@/lib/domain/projects";
import { createGuestDraft } from "@/lib/guest/draft";
import { BARBERS_SALONS_OFFER } from "@/lib/offers/barbersSalons";
import {
  applyOfferImportDecisions,
  barbersSalonReviewSummary,
  dismissOfferImport,
  proposeOfferImport
} from "@/lib/offers/intake";
import { MemoryPersistence } from "@/lib/persistence/memory";
import type { User } from "@/lib/types";

function offerIntent() {
  return parseCommissionIntent(
    new URLSearchParams("offer=barbers_salons&interest=website&purpose=business&booking=1")
  );
}

describe("barbers and salons intake", () => {
  it("prefills offer context on an empty brief without inventing a business identity", () => {
    const brief = applyCommissionIntent(createEmptyBrief(), offerIntent());
    expect(brief.context?.offerId).toBe("barbers_salons");
    expect(brief.context?.purpose).toBe("business");
    expect(brief.context?.bookingNeeded).toBe(true);
    expect(brief.projectType.value).toBe("website");
    expect(brief.vision.value).toBe(BARBERS_SALONS_OFFER.starter.vision);
    expect(brief.audience.value).toBe("");
    expect(brief.existingWebsite.value).toBe("");
    expect(brief.bookingProvider.value).toBe("");
    expect(briefTitle(brief)).toBe("Atelier for Barbers & Salons");
    expect(fieldLabel("vision", brief)).toBe("Business name");
    expect(fieldLabel("bookingProvider", brief)).toBe("Booking provider and public URL");
    expect(isBookingConnected(brief)).toBe(true);
    expect(fieldsForStep(3, brief)).toEqual(["existingWebsite", "references"]);
    expect(fieldsForStep(4, brief)).toContain("bookingProvider");
  });

  it("does not overwrite an existing brief when the offer arrives again", () => {
    const existing = applyClientValue(createEmptyBrief(), "vision", "Oak Street Barbers, written by the owner.");
    const next = applyCommissionIntent(existing, offerIntent());
    expect(next.vision.value).toBe("Oak Street Barbers, written by the owner.");
    expect(next.context?.offerId).toBe("barbers_salons");
    expect(proposeOfferImport(next).fields.find((field) => field.key === "vision")?.defaultDecision).toBe("skip");
  });

  it("lets a client dismiss imported starters without wiping unrelated wording", () => {
    const seeded = applyCommissionIntent(createEmptyBrief(), offerIntent());
    const edited = applyClientValue(seeded, "audience", "Independent stylist");
    const dismissed = dismissOfferImport(edited);
    expect(dismissed.context?.offerId).toBe("");
    expect(dismissed.audience.value).toBe("Independent stylist");
    expect(dismissed.vision.value).toBe("");
  });

  it("applies only the decisions the client confirms", () => {
    const existing = applyClientValue(createEmptyBrief(), "vision", "My own shop name.");
    const next = applyOfferImportDecisions(existing, {
      vision: "skip",
      goals: "append",
      constraints: "replace"
    });
    expect(next.vision.value).toBe("My own shop name.");
    expect(next.goals.value).toMatch(/existing provider/i);
    expect(next.constraints.value).toBe(BARBERS_SALONS_OFFER.starter.constraints);
  });
});

describe("barbers and salons founder review", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.ATELIER_PERSISTENCE_ADAPTER = "memory";
    process.env.ATELIER_AUTH_ADAPTER = "simulated";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("keeps offer, booking destination, assets, and unknowns through submit and founder review", async () => {
    const store = new MemoryPersistence();
    await seedSimulatedUsers(store, ["neil.local@atelier.invalid"]);
    const owner = (await store.getUserByEmail("owner.local@atelier.invalid")) as User;
    const other = (await store.getUserByEmail("owner-two.local@atelier.invalid")) as User;
    const founder = (await store.getUserByEmail("neil.local@atelier.invalid")) as User;
    const service = new ProjectService(store);

    let brief = applyCommissionIntent(createEmptyBrief(), offerIntent());
    brief = applyClientValue(brief, "vision", "Vale test shop");
    brief = applyClientValue(brief, "bookingProvider", "https://example.com/book");
    brief = applyClientValue(brief, "references", "A gold emblem and shop photographs, pending permission.");
    const guest = createGuestDraft();
    expect(briefsEqual(guest.brief, createEmptyBrief())).toBe(true);

    const project = await service.createProject(owner, brief);
    const saved = await service.saveBrief(project.id, owner, brief, project.version);
    const submitted = await service.submit(saved.project.id, owner, true, "barbers-submit", saved.project.version);
    expect(submitted.submission.receiptId).toMatch(/^rcpt_/);

    const duplicate = await service.submit(saved.project.id, owner, true, "barbers-submit", saved.project.version);
    expect(duplicate.submission.receiptId).toBe(submitted.submission.receiptId);
    expect(duplicate.duplicate).toBe(true);

    const founderView = await service.founderView(project.id, founder);
    const snapshot = founderView.submission?.snapshot;
    expect(snapshot?.context?.offerId).toBe("barbers_salons");
    const summary = barbersSalonReviewSummary(snapshot ?? createEmptyBrief());
    expect(summary?.offerTitle).toBe("Atelier for Barbers & Salons");
    expect(summary?.bookingDestination).toContain("example.com/book");
    expect(summary?.assets).toMatch(/gold emblem/i);
    expect(summary?.unresolved).toEqual(expect.arrayContaining(["audience", "existingWebsite"]));

    await expect(service.clientView(project.id, other)).rejects.toBeInstanceOf(ForbiddenError);
    const otherProject = await service.createProject(other, createEmptyBrief());
    expect(otherProject.brief.context?.offerId).toBeUndefined();
    expect(otherProject.id).not.toBe(project.id);
  });
});
