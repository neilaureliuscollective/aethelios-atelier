import { z } from "zod";
import { BRIEF_FIELD_KEYS } from "@/lib/types";

export const proposeBriefUpdateSchema = z.object({
  fieldKey: z.enum(BRIEF_FIELD_KEYS),
  proposedValue: z.string().min(1).max(4000),
  rationale: z.string().max(500).optional()
});

export const addUnresolvedQuestionSchema = z.object({
  fieldKey: z.enum(BRIEF_FIELD_KEYS),
  question: z.string().min(1).max(400)
});

export const TOOL_DEFINITIONS = [
  {
    type: "function" as const,
    function: {
      name: "read_brief",
      description: "Read the current living brief for this authorized project only.",
      parameters: { type: "object", properties: {}, additionalProperties: false }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "list_services",
      description: "List approved service options and nonbinding pricing status.",
      parameters: { type: "object", properties: {}, additionalProperties: false }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "propose_brief_update",
      description:
        "Propose a brief field update. The owner must accept, edit, or reject it. Never marks content approved.",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["fieldKey", "proposedValue"],
        properties: {
          fieldKey: { type: "string", enum: [...BRIEF_FIELD_KEYS] },
          proposedValue: { type: "string" },
          rationale: { type: "string" }
        }
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "add_unresolved_question",
      description: "Record an unresolved question on a brief field without overwriting the owner’s words.",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["fieldKey", "question"],
        properties: {
          fieldKey: { type: "string", enum: [...BRIEF_FIELD_KEYS] },
          question: { type: "string" }
        }
      }
    }
  }
];
