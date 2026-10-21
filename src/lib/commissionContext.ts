import { isServiceOfferId, type ServiceOfferId } from "@/lib/offers/ids";

export const COMMISSION_PURPOSES = [
  "business",
  "professional_workflow",
  "study",
  "personal",
  "unsure"
] as const;

export type CommissionPurpose = (typeof COMMISSION_PURPOSES)[number];

export const COMMISSION_ROUTES = ["business", "custom_project"] as const;
export type CommissionRoute = (typeof COMMISSION_ROUTES)[number];

export const CUSTOM_PROJECT_EXAMPLE_IDS = [
  "follow_up_workspace",
  "study_organizer",
  "personal_tracker"
] as const;

export type CustomProjectExampleId = (typeof CUSTOM_PROJECT_EXAMPLE_IDS)[number];

export type CommissionContext = {
  version: 1;
  purpose: CommissionPurpose | "";
  route: CommissionRoute | "";
  exampleId: CustomProjectExampleId | "";
  bookingNeeded: boolean | null;
  offerId: ServiceOfferId | "";
};

export type BriefContextHost = {
  projectType: { value: string };
  context?: CommissionContext;
};

export const PURPOSE_COPY: Record<
  CommissionPurpose,
  { label: string; short: string; summary: string }
> = {
  business: {
    label: "A business commission",
    short: "Business",
    summary: "A website, brand, application, or operational tool for a company or practice."
  },
  professional_workflow: {
    label: "A professional workflow",
    short: "Work",
    summary: "A useful tool that makes follow-up, coordination, or a repeated work process easier."
  },
  study: {
    label: "A study or learning tool",
    short: "Study",
    summary: "A place to organize topics, practice, and review — not a course platform."
  },
  personal: {
    label: "A personal utility",
    short: "Personal",
    summary: "A bounded tool that helps one person keep track of something that matters."
  },
  unsure: {
    label: "Not sure yet",
    short: "Unsure",
    summary: "Describe the problem first. You do not need to know whether this becomes an app or a website."
  }
};

export function emptyCommissionContext(): CommissionContext {
  return {
    version: 1,
    purpose: "",
    route: "",
    exampleId: "",
    bookingNeeded: null,
    offerId: ""
  };
}

export function isCommissionPurpose(value: string): value is CommissionPurpose {
  return (COMMISSION_PURPOSES as readonly string[]).includes(value);
}

export function isCommissionRoute(value: string): value is CommissionRoute {
  return (COMMISSION_ROUTES as readonly string[]).includes(value);
}

export function isCustomProjectExampleId(value: string): value is CustomProjectExampleId {
  return (CUSTOM_PROJECT_EXAMPLE_IDS as readonly string[]).includes(value);
}

export function normalizeCommissionContext(input: unknown): CommissionContext | undefined {
  if (!input || typeof input !== "object") return undefined;
  const record = input as Record<string, unknown>;
  const purpose = typeof record.purpose === "string" && isCommissionPurpose(record.purpose) ? record.purpose : "";
  const route = typeof record.route === "string" && isCommissionRoute(record.route) ? record.route : "";
  const exampleId =
    typeof record.exampleId === "string" && isCustomProjectExampleId(record.exampleId) ? record.exampleId : "";
  const bookingNeeded = record.bookingNeeded === true ? true : record.bookingNeeded === false ? false : null;
  const offerId = typeof record.offerId === "string" && isServiceOfferId(record.offerId) ? record.offerId : "";
  if (!purpose && !route && !exampleId && bookingNeeded == null && !offerId) return undefined;
  return {
    version: 1,
    purpose,
    route,
    exampleId,
    bookingNeeded,
    offerId
  };
}

export function mergeCommissionContext(
  current: CommissionContext | undefined,
  patch: Partial<CommissionContext>
): CommissionContext {
  const base = current ?? emptyCommissionContext();
  return {
    version: 1,
    purpose: patch.purpose !== undefined ? patch.purpose : base.purpose,
    route: patch.route !== undefined ? patch.route : base.route,
    exampleId: patch.exampleId !== undefined ? patch.exampleId : base.exampleId,
    bookingNeeded: patch.bookingNeeded !== undefined ? patch.bookingNeeded : base.bookingNeeded,
    offerId: patch.offerId !== undefined ? patch.offerId : base.offerId
  };
}

export function isFunctionalPurpose(purpose: string | undefined | null): boolean {
  return purpose === "professional_workflow" || purpose === "study" || purpose === "personal";
}

export function isCustomProjectRoute(brief: BriefContextHost): boolean {
  return brief.context?.route === "custom_project" || isFunctionalPurpose(brief.context?.purpose);
}

export function needsBrandQuestions(brief: BriefContextHost): boolean {
  if (isFunctionalPurpose(brief.context?.purpose)) return false;
  const type = brief.projectType.value;
  if (brief.context?.route === "custom_project" && type !== "website" && type !== "ecommerce_storefronts") {
    return false;
  }
  return (
    type === "website" ||
    type === "ecommerce_storefronts" ||
    type === "" ||
    type === "undecided"
  );
}

export function needsExistingDestination(brief: BriefContextHost): boolean {
  if (isFunctionalPurpose(brief.context?.purpose)) return true;
  const type = brief.projectType.value;
  return (
    type === "website" ||
    type === "ecommerce_storefronts" ||
    type === "digital_infrastructure" ||
    type === "booking_connected_website" ||
    type === "" ||
    type === "undecided"
  );
}

export function needsCompanyDetails(brief: BriefContextHost): boolean {
  return brief.context?.purpose === "business" && !isFunctionalPurpose(brief.context.purpose);
}

export function displayPurposeLabel(purpose: string | undefined): string {
  if (purpose && isCommissionPurpose(purpose)) return PURPOSE_COPY[purpose].label;
  return "";
}

export type CommissionIntent = {
  context: CommissionContext;
  projectType?: string;
  applyExampleStarter: boolean;
};

export function parseCommissionIntent(params: { get(name: string): string | null }): CommissionIntent {
  const purposeRaw = params.get("purpose") ?? "";
  const routeRaw = params.get("route") ?? "";
  const exampleRaw = params.get("example") ?? "";
  const interest = params.get("interest") ?? "";
  const bookingRaw = params.get("booking");
  const offerRaw = params.get("offer") ?? "";

  const exampleId = isCustomProjectExampleId(exampleRaw) ? exampleRaw : "";
  const offerId = isServiceOfferId(offerRaw) ? offerRaw : "";
  let purpose: CommissionPurpose | "" = isCommissionPurpose(purposeRaw) ? purposeRaw : "";
  if (!purpose && exampleId === "follow_up_workspace") purpose = "professional_workflow";
  if (!purpose && exampleId === "study_organizer") purpose = "study";
  if (!purpose && exampleId === "personal_tracker") purpose = "personal";
  if (!purpose && offerId === "barbers_salons") purpose = "business";

  let route: CommissionRoute | "" = isCommissionRoute(routeRaw) ? routeRaw : "";
  if (!route && (isFunctionalPurpose(purpose) || exampleId)) route = "custom_project";
  if (!route && (purpose === "business" || interest || offerId)) route = "business";

  let bookingNeeded: boolean | null = null;
  if (bookingRaw === "1" || bookingRaw === "true") bookingNeeded = true;
  if (bookingRaw === "0" || bookingRaw === "false") bookingNeeded = false;
  if (interest === "booking_connected_website") bookingNeeded = true;
  if (offerId === "barbers_salons" && bookingNeeded == null) bookingNeeded = true;

  return {
    context: {
      version: 1,
      purpose,
      route,
      exampleId,
      bookingNeeded,
      offerId
    },
    projectType: interest || (offerId === "barbers_salons" ? "website" : undefined),
    applyExampleStarter: Boolean(exampleId)
  };
}

export function commissionIntentPresent(intent: CommissionIntent): boolean {
  const { context, projectType } = intent;
  return Boolean(
    context.purpose ||
      context.route ||
      context.exampleId ||
      context.offerId ||
      context.bookingNeeded != null ||
      projectType
  );
}
