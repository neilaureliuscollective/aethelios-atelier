import "server-only";
import OpenAI from "openai";
import { aureliusSystemPrompt } from "@/lib/aurelius/instructions";
import {
  addUnresolvedQuestionSchema,
  proposeBriefUpdateSchema,
  RESPONSE_TOOL_DEFINITIONS
} from "@/lib/aurelius/tools";
import { SERVICE_CATALOG } from "@/lib/catalog";
import { INTELLIGENCE_DISPLAY_NAME } from "@/lib/copy";
import { loadConfig } from "@/lib/config";
import { clientSafeProfile } from "@/lib/cofounder/isolation";
import { ProjectService } from "@/lib/domain/projects";
import type { PersistenceAdapter } from "@/lib/persistence/adapter";
import { BRIEF_FIELD_KEYS, type Brief, type Project, type User } from "@/lib/types";

const UNAVAILABLE =
  `${INTELLIGENCE_DISPLAY_NAME} is unavailable. No authorized OpenAI configuration is active, so this is not a live AI reply. Continue with the structured brief — your work is saved. Live model calls stay off until separately enabled.`;

export type AureliusStatus = {
  ready: boolean;
  live: boolean;
  reason?: string;
  model?: string;
};

export function aureliusStatus(): AureliusStatus {
  const config = loadConfig();
  if (!config.aurelius.ready) {
    return { ready: false, live: false, reason: config.aurelius.missing };
  }
  return { ready: true, live: true, model: config.aurelius.model };
}

export function unavailableNotice() {
  return UNAVAILABLE;
}

function briefForModel(brief: Brief) {
  const fields = Object.fromEntries(
    BRIEF_FIELD_KEYS.map((key) => [
      key,
      {
        value: brief[key].value,
        provenance: brief[key].provenance,
        unresolvedQuestion: brief[key].unresolvedQuestion ?? null
      }
    ])
  );
  return brief.context ? { ...fields, context: brief.context } : fields;
}

export class AureliusBoundary {
  constructor(
    private readonly store: PersistenceAdapter,
    private readonly projects: ProjectService
  ) {}

  async reply(input: {
    project: Project;
    user: User;
    message: string;
    signal?: AbortSignal;
  }) {
    const status = aureliusStatus();
    await this.projects.addClientMessage(input.project.id, input.user, input.message);

    if (!status.ready) {
      const notice = await this.projects.addSystemMessage(input.project.id, UNAVAILABLE, false, {
        liveAi: false,
        reason: status.reason
      });
      return { message: notice, liveAi: false as const, status };
    }

    const config = loadConfig();
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const used = await this.store.countAssistantMessagesSince(input.project.id, since);
    if (used >= config.openAiDailyLimit) {
      const notice = await this.projects.addSystemMessage(
        input.project.id,
        `${INTELLIGENCE_DISPLAY_NAME} has reached the configured daily limit for this commission. Your brief is unchanged. Continue manually or try again later.`,
        false,
        { liveAi: false, reason: "usage_limit" }
      );
      return { message: notice, liveAi: false as const, status: { ...status, ready: false } };
    }

    const client = new OpenAI({ apiKey: config.openAiKey, timeout: config.openAiTimeoutMs });
    const history = (await this.store.listMessages(input.project.id)).slice(-12);
    const toolsUsed: string[] = [];

    const runTools = async (name: string, raw: string) => {
      toolsUsed.push(name);
      if (name === "read_brief") {
        const latest = await this.store.getProject(input.project.id);
        return JSON.stringify(briefForModel(latest?.brief ?? input.project.brief));
      }
      if (name === "list_services") {
        return JSON.stringify({
          pricingStatus: SERVICE_CATALOG.pricingStatus,
          offers: SERVICE_CATALOG.offers,
          note: "Estimates are nonbinding. Neil confirms each proposal."
        });
      }
      if (name === "propose_brief_update") {
        const parsed = proposeBriefUpdateSchema.safeParse(JSON.parse(raw || "{}"));
        if (!parsed.success) return JSON.stringify({ error: "invalid_tool_input" });
        const suggestion = await this.projects.proposeSuggestion(
          input.project.id,
          parsed.data.fieldKey,
          parsed.data.proposedValue,
          parsed.data.rationale
        );
        return JSON.stringify({
          ok: true,
          suggestionId: suggestion.id,
          status: "pending",
          labeled: `${INTELLIGENCE_DISPLAY_NAME} suggestion — not approved`
        });
      }
      if (name === "add_unresolved_question") {
        const parsed = addUnresolvedQuestionSchema.safeParse(JSON.parse(raw || "{}"));
        if (!parsed.success) return JSON.stringify({ error: "invalid_tool_input" });
        const latest = await this.store.getProject(input.project.id);
        if (!latest) return JSON.stringify({ error: "missing_project" });
        const brief = { ...latest.brief };
        brief[parsed.data.fieldKey] = {
          ...brief[parsed.data.fieldKey],
          provenance:
            brief[parsed.data.fieldKey].provenance === "empty"
              ? "unresolved"
              : brief[parsed.data.fieldKey].provenance,
          unresolvedQuestion: parsed.data.question
        };
        await this.store.updateProject({ ...latest, brief, updatedAt: new Date().toISOString() });
        return JSON.stringify({ ok: true });
      }
      return JSON.stringify({ error: "unknown_tool" });
    };

    try {
      const startingInput: Array<Record<string, unknown>> = history.map((item) => ({
        role: item.authorKind === "client" ? "user" : "assistant",
        content: item.body
      }));
      const instructions = [
        aureliusSystemPrompt(),
        `Authorized project ${input.project.id}. Durable brief:\n${JSON.stringify(
          briefForModel(input.project.brief)
        )}${await this.authorizedBusinessNote(input.project)}`
      ].join("\n\n");

      let previousResponseId: string | undefined;
      let pendingOutputs: Array<{ type: "function_call_output"; call_id: string; output: string }> = [];
      let pendingFunctionCalls: Array<Record<string, unknown>> = [];
      let text = "";

      for (let hop = 0; hop < 4; hop += 1) {
        const continuation =
          hop === 0
            ? { input: startingInput }
            : previousResponseId
              ? { previous_response_id: previousResponseId, input: pendingOutputs }
              : { input: [...pendingFunctionCalls, ...pendingOutputs] };
        const response = await client.responses.create(
          {
            model: config.openAiModel,
            instructions,
            tools: RESPONSE_TOOL_DEFINITIONS,
            reasoning: { effort: "low" },
            ...continuation
          } as never,
          { signal: input.signal }
        );
        const typed = response as {
          id?: string;
          output_text?: string;
          output?: Array<{ type?: string; name?: string; arguments?: string; call_id?: string }>;
        };
        if (typed.id) previousResponseId = typed.id;
        if (typed.output_text?.trim()) text = typed.output_text.trim();
        const calls = (typed.output ?? []).filter((item) => item.type === "function_call" && item.name);
        if (!calls.length) break;
        pendingOutputs = [];
        pendingFunctionCalls = [];
        for (const call of calls) {
          const output = await runTools(call.name ?? "", call.arguments ?? "{}");
          pendingOutputs.push({
            type: "function_call_output",
            call_id: call.call_id ?? call.name ?? "tool",
            output
          });
          pendingFunctionCalls.push(call);
        }
      }

      text =
        text ||
        "I captured that. Review the living brief — suggestions stay pending until you accept them.";
      const saved = await this.store.addMessage({
        id: `msg_${crypto.randomUUID()}`,
        projectId: input.project.id,
        authorKind: "assistant",
        body: text,
        liveAi: true,
        createdAt: new Date().toISOString(),
        metadata: { liveAi: true, toolsUsed }
      });
      return { message: saved, liveAi: true as const, status, toolsUsed };
    } catch (error) {
      const failed = await this.projects.addSystemMessage(
        input.project.id,
        `${INTELLIGENCE_DISPLAY_NAME} could not complete that reply. Your brief and previous messages are unchanged. You can retry the same question or continue the structured brief.`,
        false,
        {
          liveAi: false,
          failed: true,
          error: error instanceof Error ? error.name : "unknown"
        }
      );
      return { message: failed, liveAi: false as const, status: { ready: false, live: false, reason: "request_failed" } };
    }
  }

  private async authorizedBusinessNote(project: Project) {
    if (!project.businessId) return "";
    const profile = await this.store.companion.getProfile(project.businessId);
    return `\nAuthorized business context (confirmed/preferences only; never founder notes):\n${JSON.stringify(clientSafeProfile(profile))}`;
  }
}
