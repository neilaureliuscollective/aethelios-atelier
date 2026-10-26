import { z } from "zod";

/**
 * The discovery brief Aethelios fills in as the conversation goes. It is what Neil
 * needs before writing a proposal, and it tells Aethelios what to ask next.
 */
export const DISCOVERY_TOPICS = [
  {
    id: "business",
    label: "The business",
    question: "Tell me about the business itself — what you do, and where you do it."
  },
  {
    id: "audience",
    label: "Who it serves",
    question: "Who is the customer you most want more of? Describe them the way you would to a new hire."
  },
  {
    id: "goals",
    label: "What has to work better",
    question: "What has to work better six months from now — more bookings, a sharper first impression, less time lost to admin, something else?"
  },
  {
    id: "currentSetup",
    label: "What’s in place today",
    question: "What is in place today? A current website, a booking or payment system, spreadsheets — whatever the business actually runs on."
  },
  {
    id: "needs",
    label: "What to build",
    question: "If you could wave a wand, what would you have built — a website, an app or client portal, a storefront, or the systems behind the scenes connected?"
  },
  {
    id: "feel",
    label: "How it should feel",
    question: "When someone meets the business online for the first time, how should it feel? A brand or two you admire helps."
  },
  {
    id: "timeline",
    label: "Timing",
    question: "Is there a date this needs to be ready for — a launch, a season, a second location?"
  }
] as const;

export type DiscoveryTopicId = (typeof DISCOVERY_TOPICS)[number]["id"];

export const DISCOVERY_TOPIC_IDS = DISCOVERY_TOPICS.map((topic) => topic.id) as [
  DiscoveryTopicId,
  ...DiscoveryTopicId[]
];

const field = (max: number) =>
  z
    .string()
    .optional()
    .default("")
    .transform((value) => value.replace(/\s+/g, " ").trim().slice(0, max));

export const discoveryBriefSchema = z.object({
  businessName: field(80),
  location: field(80),
  business: field(400),
  audience: field(400),
  goals: field(400),
  currentSetup: field(400),
  needs: field(400),
  feel: field(400),
  timeline: field(160),
  recommendation: field(400),
  lastAsked: z.enum(DISCOVERY_TOPIC_IDS).optional().catch(undefined)
});

export type DiscoveryBrief = z.infer<typeof discoveryBriefSchema>;

export function emptyBrief(): DiscoveryBrief {
  return discoveryBriefSchema.parse({});
}

export function parseBrief(value: unknown): DiscoveryBrief {
  const parsed = discoveryBriefSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : emptyBrief();
}

export function coveredTopics(brief: DiscoveryBrief): DiscoveryTopicId[] {
  return DISCOVERY_TOPIC_IDS.filter((id) => brief[id].length > 0);
}

export function nextTopic(brief: DiscoveryBrief) {
  return DISCOVERY_TOPICS.find((topic) => !brief[topic.id]) ?? null;
}

/** Enough for Neil to scope: the business, the goal, the build, and most of the rest. */
export function briefReady(brief: DiscoveryBrief) {
  const covered = coveredTopics(brief);
  return ["business", "goals", "needs"].every((id) => covered.includes(id as DiscoveryTopicId)) && covered.length >= 5;
}

/** Newer non-empty values win; an empty update never erases what the visitor already said. */
export function mergeBrief(current: DiscoveryBrief, update: Partial<DiscoveryBrief>): DiscoveryBrief {
  const next = { ...current };
  const incoming = parseBrief({ ...current, ...update });
  for (const key of Object.keys(incoming) as (keyof DiscoveryBrief)[]) {
    if (key === "lastAsked") continue;
    const value = incoming[key];
    if (typeof value === "string" && value) next[key] = value as never;
  }
  next.lastAsked = update.lastAsked ?? current.lastAsked;
  return next;
}

export function topicLabel(id: DiscoveryTopicId) {
  return DISCOVERY_TOPICS.find((topic) => topic.id === id)?.label ?? id;
}

/** Plain lines for the email and the model prompt, in topic order. */
export function briefLines(brief: DiscoveryBrief): string[] {
  const lines: string[] = [];
  if (brief.businessName) lines.push(`Business name: ${brief.businessName}`);
  if (brief.location) lines.push(`Location: ${brief.location}`);
  for (const topic of DISCOVERY_TOPICS) {
    if (brief[topic.id]) lines.push(`${topic.label}: ${brief[topic.id]}`);
  }
  if (brief.recommendation) lines.push(`Aethelios’s read: ${brief.recommendation}`);
  return lines;
}
