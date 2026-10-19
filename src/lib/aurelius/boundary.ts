import "server-only";
import OpenAI from "openai";
import { aureliusSystemPrompt } from "@/lib/aurelius/instructions";
import {
  addUnresolvedQuestionSchema,
  proposeBriefUpdateSchema,
  TOOL_DEFINITIONS
} from "@/lib/aurelius/tools";
import { SERVICE_CATALOG } from "@/lib/catalog";
import { INTELLIGENCE_DISPLAY_NAME } from "@/lib/copy";
import { loadConfig } from "@/lib/config";
import { ProjectService } from "@/lib/domain/projects";
import type { PersistenceAdapter } from "@/lib/persistence/adapter";
import type { Brief, Project, User } from "@/lib/types";

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
  return Object.fromEntries(
    Object.values(brief).map((field) => [
      field.key,
      {
        value: field.value,
        provenance: field.provenance,
        unresolvedQuestion: field.unresolvedQuestion ?? null
      }
    ])
  );
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
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: "system", content: aureliusSystemPrompt() },
        {
          role: "system",
          content: `Authorized project ${input.project.id}. Durable brief:\n${JSON.stringify(
            briefForModel(input.project.brief)
          )}`
        },
        ...history.map((item) => ({
          role: (item.authorKind === "client" ? "user" : "assistant") as "user" | "assistant",
          content: item.body
        }))
      ];

      let completion = await client.chat.completions.create(
        {
          model: config.openAiModel,
          temperature: 0.4,
          max_tokens: config.openAiMaxOutputTokens,
          tools: TOOL_DEFINITIONS,
          messages
        },
        { signal: input.signal }
      );

      for (let hop = 0; hop < 4; hop += 1) {
        const msg = completion.choices[0]?.message;
        if (!msg?.tool_calls?.length) break;
        messages.push(msg);
        for (const call of msg.tool_calls) {
          const output = await runTools(call.function.name, call.function.arguments);
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: output
          });
        }
        completion = await client.chat.completions.create(
          {
            model: config.openAiModel,
            temperature: 0.4,
            max_tokens: config.openAiMaxOutputTokens,
            tools: TOOL_DEFINITIONS,
            messages
          },
          { signal: input.signal }
        );
      }

      const text =
        completion.choices[0]?.message?.content?.trim() ||
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
}
