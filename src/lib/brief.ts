import { INTELLIGENCE_DISPLAY_NAME } from "@/lib/copy";
import {
  displayPurposeLabel,
  isCustomProjectRoute,
  isFunctionalPurpose,
  mergeCommissionContext,
  needsBrandQuestions,
  needsExistingDestination,
  normalizeCommissionContext,
  type CommissionContext,
  type CommissionIntent
} from "@/lib/commissionContext";
import { exampleById } from "@/lib/customProjectExamples";
import {
  BARBERS_SALON_FIELD_HINTS,
  BARBERS_SALON_FIELD_LABELS,
  BARBERS_SALONS_OFFER,
  displayOfferLabel,
  isBarbersSalonOffer,
  type BarbersSalonStarterKey
} from "@/lib/offers/barbersSalons";
import { isServiceOfferId } from "@/lib/offers/ids";
import {
  asksBookingProvider,
  displayProjectTypeLabel,
  serviceInterestToStoredProjectType
} from "@/lib/serviceCategories";
import {
  BRIEF_FIELD_KEYS,
  type Brief,
  type BriefField,
  type BriefFieldKey,
  type ProjectType
} from "@/lib/types";

export const FIELD_LABELS: Record<BriefFieldKey, string> = {
  vision: "Vision",
  projectType: "Project type",
  audience: "Audience",
  existingWebsite: "Existing website",
  bookingProvider: "Booking provider",
  goals: "Goals",
  references: "References",
  priorities: "Priorities",
  timing: "Timing",
  budget: "Budget (optional)",
  constraints: "Constraints"
};

export const FIELD_HINTS: Record<BriefFieldKey, string> = {
  vision: "What would you like to bring to life?",
  projectType: "Which direction is closest today?",
  audience: "Who should this serve, and what should they feel or do?",
  existingWebsite: "Is there a current site or destination we should know about?",
  bookingProvider: "Which booking platform already handles appointments and payments?",
  goals: "What should this make possible in the next season of the business?",
  references: "Sites, materials, or atmospheres that feel close — treated as untrusted references.",
  priorities: "What must be true for this to be useful?",
  timing: "Is there a real window, or is timing still to confirm?",
  budget: "Optional. Leave blank if you would rather discuss this with Neil.",
  constraints: "Anything that must not be assumed or built?"
};

export function emptyField(key: BriefFieldKey): BriefField {
  return { key, value: "", provenance: "empty" };
}

export function createEmptyBrief(): Brief {
  return Object.fromEntries(BRIEF_FIELD_KEYS.map((key) => [key, emptyField(key)])) as unknown as Brief;
}

export function normalizeBrief(input: unknown): Brief {
  const brief = createEmptyBrief();
  if (!input || typeof input !== "object") return brief;
  const record = input as Record<string, unknown>;
  for (const key of BRIEF_FIELD_KEYS) {
    const raw = record[key];
    if (!raw || typeof raw !== "object") continue;
    const field = raw as Partial<BriefField>;
    brief[key] = {
      key,
      value: typeof field.value === "string" ? field.value : "",
      provenance: field.provenance ?? (field.value ? "client_statement" : "empty"),
      unresolvedQuestion:
        typeof field.unresolvedQuestion === "string" ? field.unresolvedQuestion : undefined,
      pendingSuggestionId:
        typeof field.pendingSuggestionId === "string" ? field.pendingSuggestionId : undefined
    };
  }
  const context = normalizeCommissionContext(record.context);
  if (context) brief.context = context;
  return brief;
}

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  website: "Branded websites",
  custom_apps_platforms: "Custom apps & platforms",
  ecommerce_storefronts: "E-commerce & storefronts",
  digital_infrastructure: "Digital infrastructure",
  undecided: "Project brief",
  booking_connected_website: "Custom apps & platforms"
};

export function briefTitle(brief: Brief) {
  const offer = displayOfferLabel(brief.context?.offerId);
  if (offer) return offer;
  const purpose = displayPurposeLabel(brief.context?.purpose);
  const type = brief.projectType.value || "undecided";
  if (isFunctionalPurpose(brief.context?.purpose) && purpose) return purpose;
  if (!type || type === "undecided") return purpose || "Project brief";
  return displayProjectTypeLabel(type);
}

export function displayFieldValue(key: BriefFieldKey, value: string) {
  if (key === "projectType") {
    return displayProjectTypeLabel(value) || PROJECT_TYPE_LABELS[value as ProjectType] || value;
  }
  return value;
}

export function isBookingConnected(brief: Brief) {
  return asksBookingProvider(brief.projectType.value, brief.context);
}

export function applyClientValue(brief: Brief, key: BriefFieldKey, value: string): Brief {
  const next = { ...brief, [key]: { ...brief[key] } };
  next[key] = {
    key,
    value,
    provenance: value.trim() ? "client_statement" : "empty",
    unresolvedQuestion: undefined,
    pendingSuggestionId: undefined
  };
  return next;
}

export function applyBriefContext(brief: Brief, patch: Partial<CommissionContext>): Brief {
  return {
    ...brief,
    context: mergeCommissionContext(brief.context, patch)
  };
}

const EXAMPLE_STARTER_KEYS = [
  "vision",
  "audience",
  "existingWebsite",
  "goals",
  "priorities",
  "constraints"
] as const;

function applyStarterField(
  brief: Brief,
  key: BriefFieldKey,
  value: string,
  previousStarter: string
): Brief {
  if (!value.trim()) return brief;
  const current = brief[key].value.trim();
  if (current && current !== previousStarter.trim()) return brief;
  return applyClientValue(brief, key, value);
}

function clearMatchingStarter(brief: Brief, exampleId: string | undefined): Brief {
  const previous = exampleId ? exampleById(exampleId) : undefined;
  if (!previous) return brief;
  let next = brief;
  for (const key of EXAMPLE_STARTER_KEYS) {
    if (brief[key].value.trim() === previous.starter[key].trim()) {
      next = applyClientValue(next, key, "");
    }
  }
  return next;
}

const OFFER_STARTER_KEYS = [
  "vision",
  "audience",
  "existingWebsite",
  "bookingProvider",
  "goals",
  "priorities",
  "constraints"
] as const satisfies readonly BarbersSalonStarterKey[];

function offerStarter(offerId: string | undefined) {
  return offerId === BARBERS_SALONS_OFFER.id ? BARBERS_SALONS_OFFER.starter : undefined;
}

export function applyOfferStarters(brief: Brief, offerId: string, previousOfferId = ""): Brief {
  if (!isServiceOfferId(offerId)) return brief;
  const starter = offerStarter(offerId);
  if (!starter) return brief;
  const previous = offerStarter(previousOfferId);
  let next = brief;
  for (const key of OFFER_STARTER_KEYS) {
    next = applyStarterField(next, key, starter[key], previous?.[key] ?? "");
  }
  return next;
}

export function clearMatchingOfferStarters(brief: Brief, offerId: string | undefined): Brief {
  const starter = offerStarter(offerId);
  if (!starter) return brief;
  let next = brief;
  for (const key of OFFER_STARTER_KEYS) {
    if (brief[key].value.trim() === starter[key].trim()) {
      next = applyClientValue(next, key, "");
    }
  }
  return next;
}

export function applyCommissionIntent(brief: Brief, intent: CommissionIntent): Brief {
  const previousExample = brief.context?.exampleId || "";
  const nextExample = intent.context.exampleId || "";
  const previousOffer = brief.context?.offerId || "";
  const nextOffer = intent.context.offerId || "";
  const purposeChanged = Boolean(intent.context.purpose && intent.context.purpose !== brief.context?.purpose);
  const exampleChanged = Boolean(nextExample && nextExample !== previousExample);
  const offerChanged = Boolean(nextOffer && nextOffer !== previousOffer);
  let next = brief;
  if ((exampleChanged || (purposeChanged && !nextExample)) && previousExample) {
    next = clearMatchingStarter(next, previousExample);
  }
  if ((offerChanged || (purposeChanged && !nextOffer)) && previousOffer && previousOffer !== nextOffer) {
    next = clearMatchingOfferStarters(next, previousOffer);
  }
  next = applyBriefContext(next, intent.context);
  if (intent.projectType) {
    const stored = serviceInterestToStoredProjectType(intent.projectType);
    if (stored) next = applyClientValue(next, "projectType", stored);
    else if (intent.projectType === "undecided") next = applyClientValue(next, "projectType", "undecided");
  }
  if (
    !next.projectType.value.trim() &&
    (isFunctionalPurpose(intent.context.purpose) || intent.context.route === "custom_project")
  ) {
    next = applyClientValue(next, "projectType", "undecided");
  }
  if (intent.applyExampleStarter && intent.context.exampleId) {
    const example = exampleById(intent.context.exampleId);
    const previous = exampleById(previousExample);
    if (example) {
      for (const key of EXAMPLE_STARTER_KEYS) {
        next = applyStarterField(next, key, example.starter[key], previous?.starter[key] ?? "");
      }
    }
  }
  if (nextOffer) {
    next = applyOfferStarters(next, nextOffer, previousOffer);
  }
  return next;
}

export function fieldLabel(key: BriefFieldKey, brief: Brief): string {
  if (isBarbersSalonOffer(brief) && key in BARBERS_SALON_FIELD_LABELS) {
    return BARBERS_SALON_FIELD_LABELS[key];
  }
  if (!isCustomProjectRoute(brief) && !isFunctionalPurpose(brief.context?.purpose)) {
    return FIELD_LABELS[key];
  }
  switch (key) {
    case "vision":
      return "What you are trying to create";
    case "projectType":
      return "Form this might take — optional";
    case "audience":
      return "Who will use it";
    case "existingWebsite":
      return "How you handle it today";
    case "goals":
      return "A useful first version";
    case "priorities":
      return "Must-haves now";
    case "constraints":
      return "Permissions, data, and later additions";
    default:
      return FIELD_LABELS[key];
  }
}

export function fieldHint(key: BriefFieldKey, brief: Brief): string {
  if (isBarbersSalonOffer(brief) && key in BARBERS_SALON_FIELD_HINTS) {
    return BARBERS_SALON_FIELD_HINTS[key];
  }
  if (!isCustomProjectRoute(brief) && !isFunctionalPurpose(brief.context?.purpose)) {
    if (key === "goals" && brief.projectType.value === "custom_apps_platforms") {
      return "What should a useful first version let people do?";
    }
    return FIELD_HINTS[key];
  }
  switch (key) {
    case "vision":
      return "What are you trying to create or make easier?";
    case "projectType":
      return "You can leave this as Not sure yet. The form this takes can be decided later.";
    case "audience":
      return "Who will use it? One person, a small team, students, or someone else?";
    case "existingWebsite":
      return "How do you handle it today — notes, a spreadsheet, memory, or another tool?";
    case "goals":
      return "What should a useful first version let you do?";
    case "priorities":
      return "Which actions must work first? What can wait?";
    case "constraints":
      return "Devices, permissions, or data that must stay private or out of scope?";
    case "timing":
      return "Is there a real window, or is timing still to confirm? Unsure is fine.";
    case "budget":
      return "Optional. Leave blank if you would rather discuss this with Neil.";
    default:
      return FIELD_HINTS[key];
  }
}

export function fieldsForStep(step: number, brief: Brief): BriefFieldKey[] {
  const functional = isCustomProjectRoute(brief) || isFunctionalPurpose(brief.context?.purpose);
  const focusedOffer = isBarbersSalonOffer(brief);
  switch (step) {
    case 1:
      return ["vision", "projectType"];
    case 2:
      return ["audience"];
    case 3: {
      const fields: BriefFieldKey[] = [];
      if (needsExistingDestination(brief) || functional || focusedOffer) fields.push("existingWebsite");
      if (needsBrandQuestions(brief) || focusedOffer) fields.push("references");
      return fields.length ? fields : ["existingWebsite"];
    }
    case 4: {
      const fields: BriefFieldKey[] = ["goals"];
      if (isBookingConnected(brief) || focusedOffer) fields.push("bookingProvider");
      fields.push("priorities", "timing", "budget", "constraints");
      return fields;
    }
    default:
      return [...BRIEF_FIELD_KEYS];
  }
}

export function provenanceLabel(provenance: BriefField["provenance"]) {
  switch (provenance) {
    case "client_statement":
      return "Your statement";
    case "ai_suggestion_pending":
      return `${INTELLIGENCE_DISPLAY_NAME} suggestion — not approved`;
    case "ai_suggestion_accepted":
      return "Accepted suggestion";
    case "ai_suggestion_edited":
      return "Edited suggestion";
    case "unresolved":
      return "Unresolved";
    case "founder_decision":
      return "Founder decision";
    default:
      return "Not yet captured";
  }
}
