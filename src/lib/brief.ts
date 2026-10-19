import { INTELLIGENCE_DISPLAY_NAME } from "@/lib/copy";
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
  return Object.fromEntries(BRIEF_FIELD_KEYS.map((key) => [key, emptyField(key)])) as Brief;
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
  return brief;
}

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  website: "Website",
  booking_connected_website: "Booking-connected website",
  digital_infrastructure: "Digital infrastructure",
  undecided: "Project brief"
};

export function briefTitle(brief: Brief) {
  const type = (brief.projectType.value || "undecided") as ProjectType;
  return PROJECT_TYPE_LABELS[type] ?? "Untitled brief";
}

export function displayFieldValue(key: BriefFieldKey, value: string) {
  if (key === "projectType") {
    return PROJECT_TYPE_LABELS[value as ProjectType] ?? value;
  }
  return value;
}

export function isBookingConnected(brief: Brief) {
  return brief.projectType.value === "booking_connected_website";
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

export function fieldsForStep(step: number, brief: Brief): BriefFieldKey[] {
  switch (step) {
    case 1:
      return ["vision", "projectType"];
    case 2:
      return ["audience"];
    case 3:
      return ["references", "existingWebsite"];
    case 4:
      return isBookingConnected(brief)
        ? ["goals", "bookingProvider", "priorities", "timing", "budget", "constraints"]
        : ["goals", "priorities", "timing", "budget", "constraints"];
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
