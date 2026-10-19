import { DIRECTIONS } from "./catalog";
import { displayName, sanitizeMultiline, sanitizePlainText, LIMITS } from "./sanitize";
import type {
  BusinessTypeId,
  ConceptContent,
  DirectionId,
  DiscoveryDraft,
  FeelingId,
  IntentId,
  QualityId,
  VisualDirectionId
} from "./types";

const SERVICE_SETS: Record<
  DirectionId,
  Record<"appointment" | "generic", Array<{ id: string; title: string; detail: string }>>
> = {
  lumen: {
    appointment: [
      {
        id: "consult",
        title: "Consultation",
        detail: "A first sitting to understand what they came for — unhurried, in person or by the path you already use."
      },
      {
        id: "sitting",
        title: "The sitting",
        detail: "The core appointment. The site should make the ritual clear without inventing a menu you do not offer."
      },
      {
        id: "after",
        title: "Aftercare",
        detail: "A quiet next step: how to return, what to bring, and where booking continues."
      }
    ],
    generic: [
      {
        id: "intro",
        title: "Introduction",
        detail: "A considered first meeting with the work, written so a stranger can picture it."
      },
      {
        id: "work",
        title: "The work",
        detail: "The primary offering, named in their language rather than design jargon."
      },
      {
        id: "return",
        title: "Return",
        detail: "How someone continues — a message, a visit, or their existing booking tool."
      }
    ]
  },
  hearth: {
    appointment: [
      {
        id: "welcome",
        title: "Welcome visit",
        detail: "Arrive, be received, and understand the room before anything is scheduled as a commitment."
      },
      {
        id: "craft",
        title: "The work itself",
        detail: "Time set aside for the service they actually offer — the site does not invent extra packages."
      },
      {
        id: "again",
        title: "Come again",
        detail: "A simple return path that can later point at the booking provider they already trust."
      }
    ],
    generic: [
      {
        id: "hello",
        title: "A first hello",
        detail: "Warm orientation: who this is for, and what walking in should feel like."
      },
      {
        id: "offer",
        title: "What you offer",
        detail: "Plain service language, not a marketplace of invented products."
      },
      {
        id: "next",
        title: "The next visit",
        detail: "A human close — write, call, or continue in the tool they already use."
      }
    ]
  },
  signal: {
    appointment: [
      {
        id: "intro-session",
        title: "Intro session",
        detail: "A defined first block of time. The copy stays specific without promising a result."
      },
      {
        id: "core",
        title: "Core service",
        detail: "The main appointment, presented as a clear choice rather than a long catalog."
      },
      {
        id: "follow",
        title: "Follow-through",
        detail: "What happens after: a return booking on their existing provider, not a new scheduler here."
      }
    ],
    generic: [
      {
        id: "brief",
        title: "Brief intake",
        detail: "A short, structured start so the work is understood before anyone commits."
      },
      {
        id: "delivery",
        title: "The engagement",
        detail: "The primary service, named once, with no fabricated case studies."
      },
      {
        id: "continue",
        title: "Continue",
        detail: "A single next action — contact or the booking destination they already have."
      }
    ]
  }
};

const OPENINGS: Record<DirectionId, string> = {
  lumen: "A composed first impression: the name, a single atmosphere, and time treated as something precious.",
  hearth: "A hosted opening: someone is received before they are asked to choose.",
  signal: "A graphic first frame: the name as a mark, the offer as a clear line, the next step already in view."
};

function feelingLine(feeling: FeelingId | ""): string {
  switch (feeling) {
    case "calm":
      return "Visitors should leave the page slower than they arrived.";
    case "welcomed":
      return "Visitors should feel received, as if someone has already made space for them.";
    case "confident":
      return "Visitors should know what happens next without being pushed.";
    case "grounded":
      return "Visitors should trust the room — materials, type, and claims all stay honest.";
    case "contemporary":
      return "Visitors should feel the work is current, precise, and uncluttered.";
    default:
      return "The feeling is still open. The layout can carry it once they name it.";
  }
}

function intentLine(intent: IntentId | ""): string {
  switch (intent) {
    case "clearer_presence":
      return "The site exists to make the work legible before anyone reaches out.";
    case "easier_booking":
      return "The site exists to make the path to an existing booking tool feel obvious.";
    case "truer_feeling":
      return "The site exists to carry the same mood as the real visit.";
    case "connect_booking":
      return "The site will point at a booking provider they already use — not replace it.";
    default:
      return "The purpose can stay unnamed while they try a direction on.";
  }
}

function typeNoun(type: BusinessTypeId | ""): string {
  switch (type) {
    case "appointment":
      return "appointment studio";
    case "local_service":
      return "local practice";
    case "independent":
      return "independent practice";
    default:
      return "business";
  }
}

function plateCaption(visual: VisualDirectionId, name: string): string {
  switch (visual) {
    case "glass":
      return `Architectural study for ${name} — reflection, depth, and composed light. Not a photograph of a completed project.`;
    case "material":
      return `Material study for ${name} — cloth, stone, and quiet texture. Illustrative, not a client portfolio.`;
    default:
      return `Graphic study for ${name} — geometry and type as the image. Not a live brand system.`;
  }
}

function defaultHeadline(directionId: DirectionId, name: string, qualities: QualityId[]): string {
  const quality = qualities[0];
  if (directionId === "lumen") {
    if (quality === "refined") return `${name}, given time.`;
    return `A quieter way to meet ${name}.`;
  }
  if (directionId === "hearth") {
    if (quality === "welcoming") return `Come in. ${name} is ready.`;
    return `A place at ${name}.`;
  }
  if (quality === "bold") return `${name}.`;
  return `${name}, clearly.`;
}

export function recommendDirection(qualities: QualityId[]): DirectionId {
  const score: Record<DirectionId, number> = { lumen: 0, hearth: 0, signal: 0 };
  for (const quality of qualities) {
    if (quality === "refined" || quality === "contemporary") score.lumen += 2;
    if (quality === "welcoming" || quality === "grounded") score.hearth += 2;
    if (quality === "bold") score.signal += 3;
    if (quality === "contemporary") score.signal += 1;
  }
  if (qualities.length === 0) return "lumen";
  const ranked = (Object.keys(score) as DirectionId[]).sort((a, b) => {
    if (score[b] !== score[a]) return score[b] - score[a];
    return a.localeCompare(b);
  });
  return ranked[0] ?? "lumen";
}

export function buildConceptContent(draft: DiscoveryDraft, directionId: DirectionId): ConceptContent {
  const name = displayName(draft.businessName);
  const direction = DIRECTIONS[directionId];
  const typeKey = draft.businessType === "appointment" ? "appointment" : "generic";
  const headline =
    collapseOrDefault(
      sanitizePlainText(draft.headline, LIMITS.headline),
      defaultHeadline(directionId, name, draft.qualities)
    );
  const visual = draft.visualDirectionId;
  const noun = typeNoun(draft.businessType);

  return {
    directionId,
    businessName: name,
    kicker: `${direction.epithet} · ${noun}`,
    headline,
    opening: `${OPENINGS[directionId]} ${intentLine(draft.intent)}`,
    atmosphere: feelingLine(draft.customerFeeling),
    imageCaption: plateCaption(visual, name),
    services: SERVICE_SETS[directionId][typeKey],
    journey: [
      {
        id: "arrive",
        title: "Arrive",
        detail: `Meet ${name} in a composition that matches a ${direction.epithet.toLowerCase()}.`
      },
      {
        id: "understand",
        title: "Understand",
        detail: "Read the offering in plain language. No invented testimonials, ratings, or addresses."
      },
      {
        id: "continue",
        title: "Continue",
        detail:
          "Take the demonstrated next step. A finished commission can later link to an existing booking provider."
      }
    ],
    actionLabel: actionLabel(directionId),
    actionHint:
      "Demonstration only. Nothing is booked, sent, or charged. The eventual website can connect the booking tool they already use.",
    closing: `${name} remains a sketch of direction — curated and personalized from the answers on this device, not generated by a model.`,
    comparisonFeeling: direction.feeling,
    comparisonEmphasis: direction.emphasis,
    comparisonAction: direction.customerAction
  };
}

function actionLabel(directionId: DirectionId): string {
  if (directionId === "lumen") return "Request a sitting";
  if (directionId === "hearth") return "Save a time";
  return "Reserve";
}

function collapseOrDefault(value: string, fallback: string): string {
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed || fallback;
}

export function visitorNotesFromDraft(draft: DiscoveryDraft): string {
  const likes = sanitizeMultiline(draft.likesNote, LIMITS.note).trim();
  const changes = sanitizeMultiline(draft.changeNote, LIMITS.note).trim();
  const parts: string[] = [];
  if (likes) parts.push(`What they like:\n${likes}`);
  if (changes) parts.push(`What they want changed:\n${changes}`);
  return parts.join("\n\n");
}
