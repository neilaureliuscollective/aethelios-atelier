import type { CustomProjectExampleId, CommissionPurpose } from "@/lib/commissionContext";

export type CustomProjectExample = {
  id: CustomProjectExampleId;
  purpose: CommissionPurpose;
  title: string;
  kicker: string;
  summary: string;
  briefHref: string;
  starter: {
    vision: string;
    audience: string;
    existingWebsite: string;
    goals: string;
    priorities: string;
    constraints: string;
  };
};

export const CUSTOM_PROJECT_EXAMPLES: CustomProjectExample[] = [
  {
    id: "follow_up_workspace",
    purpose: "professional_workflow",
    title: "Follow-up workspace",
    kicker: "Illustrative professional tool",
    summary:
      "A quiet list of people to return to, with priority and status that change what you see. Synthetic names only — not a client system.",
    briefHref: "/project?purpose=professional_workflow&example=follow_up_workspace&route=custom_project",
    starter: {
      vision: "A simple place to see which follow-ups need attention today.",
      audience: "Me, and anyone I later choose to share the list with.",
      existingWebsite: "A notes app and a few email reminders. Nothing is connected.",
      goals: "See what is waiting, change priority or status, and keep the rest out of the way.",
      priorities: "A first version should let me add a follow-up, mark it waiting or done, and filter by priority.",
      constraints: "No employer accounts, no live inbox, and no invented customer data."
    }
  },
  {
    id: "study_organizer",
    purpose: "study",
    title: "Study organizer",
    kicker: "Illustrative learning tool",
    summary:
      "Topics to cover, a short log of missed practice, and a calm review pass. This is a labeled example, not a school product.",
    briefHref: "/project?purpose=study&example=study_organizer&route=custom_project",
    starter: {
      vision: "A study list that keeps topics, missed practice, and a short review in one place.",
      audience: "Just me, while I learn a subject.",
      existingWebsite: "Paper notes and a scattered checklist.",
      goals: "Add a topic, record a practice miss, and review those misses without building a course platform.",
      priorities: "A first version should organize topics and let me mark what still needs practice.",
      constraints: "No school accounts, no live tutoring, and no claim of learning outcomes."
    }
  },
  {
    id: "personal_tracker",
    purpose: "personal",
    title: "Personal tracker",
    kicker: "Illustrative personal utility",
    summary:
      "A bounded tracker for habits or small commitments. Synthetic entries only — not connected to a health or bank service.",
    briefHref: "/project?purpose=personal&example=personal_tracker&route=custom_project",
    starter: {
      vision: "A small tracker that helps me keep a few personal commitments visible.",
      audience: "Only me.",
      existingWebsite: "A mix of calendar pings and memory.",
      goals: "Add an item, mark today done or skipped, and see a short recent history.",
      priorities: "A first version should stay small, private, and useful without becoming a lifestyle platform.",
      constraints: "No health claims, no payment data, and no accounts beyond this project."
    }
  }
];

export function exampleById(id: string): CustomProjectExample | undefined {
  return CUSTOM_PROJECT_EXAMPLES.find((item) => item.id === id);
}
