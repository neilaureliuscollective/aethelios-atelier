import { confirmedFacts } from "@/lib/cofounder/profile";
import type { AuthorizedBusinessContext } from "@/lib/cofounder/types";

export const STARTING_ACTIONS = [
  {
    id: "announce_service",
    label: "Announce a new service",
    prompt: "Help me announce my new service."
  },
  {
    id: "draft_reply",
    label: "Draft a customer reply",
    prompt: "Draft a considered reply I can edit before sending."
  },
  {
    id: "service_description",
    label: "Write a service description",
    prompt: "Draft a service description from my confirmed offerings."
  },
  {
    id: "prepare_estimate",
    label: "Prepare a draft estimate",
    prompt: "Prepare a draft estimate from my approved rates."
  }
] as const;

export type StartingActionId = (typeof STARTING_ACTIONS)[number]["id"];

export function detectStartingAction(message: string): StartingActionId | null {
  const text = message.toLowerCase();
  if (text.includes("announce") || text.includes("new service") || text.includes("promotion")) {
    return "announce_service";
  }
  if (text.includes("reply") || text.includes("respond to")) return "draft_reply";
  if (text.includes("service description") || text.includes("describe our")) return "service_description";
  if (text.includes("estimate") || text.includes("quote from my rates")) return "prepare_estimate";
  return null;
}

export function profilePreparedCopy(action: StartingActionId, context: AuthorizedBusinessContext) {
  const facts = confirmedFacts(context.profile);
  const name = context.profile.fields.name.value || context.business.name;
  const audience = context.profile.fields.audience.value;
  const services = context.profile.fields.services.value;
  const tone = context.profile.fields.tone.value || "clear, calm, and specific";
  const missing = ["name", "audience", "services"].filter((key) => {
    const field = context.profile.fields[key as "name" | "audience" | "services"];
    return !field.value.trim();
  });

  if (action === "announce_service") {
    return {
      title: `Announcement draft for ${name}`,
      body: [
        `We’re introducing a new offering from ${name}.`,
        services ? `It continues the work we already do: ${services}.` : "Name the service in your own words before this is published.",
        audience ? `It’s for ${audience}.` : "Add who this is for so the announcement stays honest.",
        `Tone to keep while editing: ${tone}.`,
        missing.length
          ? `Missing confirmed facts: ${missing.join(", ")}. Those blanks were not invented.`
          : "Built only from confirmed business facts. Edit freely, then send it to Studio."
      ].join("\n\n")
    };
  }
  if (action === "draft_reply") {
    return {
      title: `Customer reply draft for ${name}`,
      body: [
        `Thank you for writing to ${name}.`,
        services ? `We can help with ${services}.` : "I can confirm what we offer after you add it to the business profile.",
        "If you share the date or detail you have in mind, I’ll follow up with a clear next step.",
        "This is a draft for you to edit. It has not been sent."
      ].join("\n\n")
    };
  }
  if (action === "service_description") {
    return {
      title: `Service description for ${name}`,
      body: [
        name,
        services || "Add the confirmed services or products before this description is used publicly.",
        audience ? `Made for ${audience}.` : "",
        context.profile.fields.priorities.value
          ? `We keep ${context.profile.fields.priorities.value}.`
          : ""
      ]
        .filter(Boolean)
        .join("\n\n")
    };
  }
  const rates = context.profile.approvedRates;
  return {
    title: `Estimate notes for ${name}`,
    body: rates.length
      ? [
          "Approved rates on file (not a quote):",
          ...rates.map(
            (rate) =>
              `- ${rate.label}: ${(rate.amountCents / 100).toFixed(2)} ${rate.currency} / ${rate.unit} (source: ${rate.source})`
          ),
          "Tell me the items and quantities. Arithmetic will use these rates only."
        ].join("\n")
      : "There are no approved rates on this business yet. Add owner-supplied rates before an estimate can be prepared. Prices will not be invented.",
    facts
  };
}
