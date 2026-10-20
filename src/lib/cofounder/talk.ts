import { aureliusStatus, unavailableNotice } from "@/lib/aurelius/boundary";
import { companionSystemPrompt } from "@/lib/cofounder/instructions";
import { buildAuthorizedModelContext, looksLikeCrossTenantProbe } from "@/lib/cofounder/isolation";
import { formatEstimate, prepareEstimate } from "@/lib/cofounder/estimates";
import {
  detectStartingAction,
  profilePreparedCopy,
  STARTING_ACTIONS
} from "@/lib/cofounder/startingActions";
import { CompanionStudio } from "@/lib/cofounder/studio";
import {
  prepareEstimateToolSchema,
  prepareStudioSchema,
  proposeMemorySchema,
  retrieveStatusSchema,
  saveDraftSchema,
  upsertTaskSchema
} from "@/lib/cofounder/tools";
import { CompanionUsage } from "@/lib/cofounder/usage";
import { CompanionWork } from "@/lib/cofounder/work";
import { CompanionWorkspace } from "@/lib/cofounder/workspace";
import { INTELLIGENCE_DISPLAY_NAME } from "@/lib/copy";
import { ForbiddenError } from "@/lib/domain/errors";
import { confirmedProposal, currentClientProposal, isClientVisibleProposal } from "@/lib/domain/proposal";
import type { PersistenceAdapter } from "@/lib/persistence/adapter";
import type { AuthorizedBusinessContext, CompanionConversation, CompanionMessage } from "@/lib/cofounder/types";
import type { AuthContext, User } from "@/lib/types";

function now() {
  return new Date().toISOString();
}

function companionId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

export type TalkToolResult = {
  name: string;
  ok: boolean;
  result: unknown;
};

export type TalkTurn = {
  conversation: CompanionConversation;
  userMessage: CompanionMessage;
  assistantMessage: CompanionMessage;
  liveAi: boolean;
  toolsUsed: TalkToolResult[];
  interrupted?: boolean;
};

export class CompanionTalk {
  constructor(
    private readonly store: PersistenceAdapter,
    private readonly workspace = new CompanionWorkspace(store),
    private readonly work = new CompanionWork(store),
    private readonly studio = new CompanionStudio(store),
    private readonly usage = new CompanionUsage(store)
  ) {}

  async conversation(businessId: string, user: User, conversationId?: string, projectId?: string) {
    await this.workspace.requireMembership(businessId, user);
    if (conversationId) {
      const existing = await this.store.companion.getConversation(conversationId);
      if (!existing || existing.businessId !== businessId) {
        throw new ForbiddenError("Conversation not found in this workspace.");
      }
      return existing;
    }
    const listed = await this.store.companion.listConversations(businessId);
    const match = listed.find((item) => (projectId ? item.projectId === projectId : !item.projectId));
    if (match) return match;
    const conversation: CompanionConversation = {
      id: companionId("convo"),
      businessId,
      projectId,
      title: "Talk with Aethelios",
      createdAt: now(),
      updatedAt: now()
    };
    return this.store.companion.createConversation(conversation);
  }

  async history(businessId: string, user: User, conversationId?: string) {
    const conversation = await this.conversation(businessId, user, conversationId);
    const companionMessages = await this.store.companion.listMessages(conversation.id);
    let projectMessages: CompanionMessage[] = [];
    if (conversation.projectId) {
      const project = await this.store.getProject(conversation.projectId);
      if (project && project.businessId === businessId && (project.ownerId === user.id || user.role === "founder")) {
        projectMessages = (await this.store.listMessages(project.id)).map((item) => ({
          id: item.id,
          conversationId: conversation.id,
          businessId,
          projectId: project.id,
          authorKind: item.authorKind,
          body: item.body,
          liveAi: item.liveAi,
          createdAt: item.createdAt,
          metadata: { ...item.metadata, importedFromProject: true }
        }));
      }
    }
    const merged = [...projectMessages, ...companionMessages].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return { conversation, messages: merged };
  }

  async turn(input: {
    businessId: string;
    user: User;
    auth: AuthContext;
    message: string;
    conversationId?: string;
    projectId?: string;
    idempotencyKey?: string;
    signal?: AbortSignal;
  }): Promise<TalkTurn> {
    const context = await this.workspace.requireMembership(input.businessId, input.user);
    const conversation = await this.conversation(input.businessId, input.user, input.conversationId, input.projectId);
    if (input.idempotencyKey) {
      const existing = await this.store.companion.getJobByIdempotency(input.businessId, input.idempotencyKey);
      if (existing?.status === "completed" && existing.resultJson) {
        const parsed = JSON.parse(existing.resultJson) as TalkTurn;
        return parsed;
      }
    }
    const userMessage = await this.store.companion.addMessage({
      id: companionId("msg"),
      conversationId: conversation.id,
      businessId: input.businessId,
      projectId: conversation.projectId,
      authorKind: "client",
      body: input.message,
      liveAi: false,
      createdAt: now()
    });

    if (looksLikeCrossTenantProbe(input.message)) {
      const assistantMessage = await this.store.companion.addMessage({
        id: companionId("msg"),
        conversationId: conversation.id,
        businessId: input.businessId,
        projectId: conversation.projectId,
        authorKind: "assistant",
        body: `${INTELLIGENCE_DISPLAY_NAME} can only use this workspace’s confirmed facts and your saved work. Other clients’ records and private founder notes are not available.`,
        liveAi: false,
        createdAt: now(),
        metadata: { refused: "cross_tenant_or_private_probe" }
      });
      return { conversation, userMessage, assistantMessage, liveAi: false, toolsUsed: [] };
    }

    const toolsUsed: TalkToolResult[] = [];
    const runTool = async (name: string, raw: string) => {
      const result = await this.executeTool(name, raw, context, input.user);
      toolsUsed.push({ name, ok: result.ok, result: result.result });
      return result;
    };

    const action = detectStartingAction(input.message);
    const status = aureliusStatus();
    if (!status.ready) {
      const prepared = action ? profilePreparedCopy(action, context) : null;
      if (prepared) {
        await this.work.saveDraft(input.businessId, input.user, {
          title: prepared.title,
          body: prepared.body,
          kind: action === "announce_service" ? "announcement" : "copy"
        });
      }
      const body = [
        unavailableNotice(),
        prepared
          ? `\nI still prepared editable copy from your confirmed business profile (not a live model draft):\n\n${prepared.body}\n\nIt’s saved in Work. Review it, then send it to Studio.`
          : "\nYou can still use a starting action, edit the business profile, or save work manually."
      ].join("\n");
      const assistantMessage = await this.store.companion.addMessage({
        id: companionId("msg"),
        conversationId: conversation.id,
        businessId: input.businessId,
        projectId: conversation.projectId,
        authorKind: "assistant",
        body,
        liveAi: false,
        createdAt: now(),
        metadata: { liveAi: false, startingAction: action, prepared: Boolean(prepared) }
      });
      const turn = { conversation, userMessage, assistantMessage, liveAi: false as const, toolsUsed };
      if (input.idempotencyKey) {
        await this.store.companion.addJob({
          id: companionId("job"),
          businessId: input.businessId,
          ownerId: input.user.id,
          sessionId: input.auth.session.id,
          kind: "talk",
          status: "completed",
          idempotencyKey: input.idempotencyKey,
          createdAt: now(),
          updatedAt: now(),
          resultJson: JSON.stringify(turn)
        });
      }
      return turn;
    }

    await this.usage.assertConcurrent(input.businessId, input.user, "talk");
    await this.usage.consume(input.businessId, input.user, "talk", 1);
    const job = await this.store.companion.addJob({
      id: companionId("job"),
      businessId: input.businessId,
      ownerId: input.user.id,
      sessionId: input.auth.session.id,
      kind: "talk",
      status: "pending",
      idempotencyKey: input.idempotencyKey ?? companionId("talk"),
      createdAt: now(),
      updatedAt: now()
    });

    try {
      if (input.signal?.aborted) {
        const assistantMessage = await this.store.companion.addMessage({
          id: companionId("msg"),
          conversationId: conversation.id,
          businessId: input.businessId,
          projectId: conversation.projectId,
          authorKind: "system",
          body: "That reply was interrupted. Nothing extra was saved.",
          liveAi: false,
          createdAt: now(),
          metadata: { interrupted: true }
        });
        await this.store.companion.updateJob({ ...job, status: "invalidated", updatedAt: now() });
        return { conversation, userMessage, assistantMessage, liveAi: false, toolsUsed, interrupted: true };
      }

      const history = await this.store.companion.listMessages(conversation.id);
      const modelContext = buildAuthorizedModelContext({ context, history });
      const OpenAI = (await import("openai")).default;
      const { loadConfig } = await import("@/lib/config");
      const config = loadConfig();
      const client = new OpenAI({ apiKey: config.openAiKey, timeout: config.openAiTimeoutMs });
      const { COMPANION_TOOL_DEFINITIONS, CHAT_COMPLETION_TOOL_DEFINITIONS } = await import("@/lib/cofounder/tools");

      let text = "";
      const responsesApi = typeof (client as { responses?: { create?: unknown } }).responses?.create === "function";
      if (responsesApi) {
        const response = await client.responses.create({
          model: config.openAiModel,
          instructions: companionSystemPrompt(),
          input: [
            { role: "system", content: `Authorized workspace context:\n${JSON.stringify(modelContext)}` },
            ...history.slice(-12).map((item) => ({
              role: item.authorKind === "client" ? "user" : "assistant",
              content: item.body
            }))
          ],
          tools: COMPANION_TOOL_DEFINITIONS,
          max_output_tokens: config.openAiMaxOutputTokens
        } as never);
        const output = response as { output_text?: string; output?: Array<{ type?: string; name?: string; arguments?: string }> };
        if (Array.isArray(output.output)) {
          for (const item of output.output) {
            if (item.type === "function_call" && item.name && item.arguments) {
              await runTool(item.name, item.arguments);
            }
          }
        }
        text = output.output_text?.trim() ?? "";
      } else {
        const completion = await client.chat.completions.create(
          {
            model: config.openAiModel,
            temperature: 0.4,
            max_tokens: config.openAiMaxOutputTokens,
            tools: CHAT_COMPLETION_TOOL_DEFINITIONS,
            messages: [
              { role: "system", content: companionSystemPrompt() },
              { role: "system", content: `Authorized workspace context:\n${JSON.stringify(modelContext)}` },
              ...history.slice(-12).map((item) => ({
                role: (item.authorKind === "client" ? "user" : "assistant") as "user" | "assistant",
                content: item.body
              }))
            ]
          },
          { signal: input.signal }
        );
        const msg = completion.choices[0]?.message;
        if (msg?.tool_calls?.length) {
          for (const call of msg.tool_calls) {
            await runTool(call.function.name, call.function.arguments);
          }
        }
        text = msg?.content?.trim() ?? "";
      }

      if (!text) {
        text = toolsUsed.length
          ? "I saved what I could from that turn. Review Work — nothing is published until you say so."
          : "I captured that. Tell me what you want drafted or saved.";
      }

      const latestJob = await this.store.companion.getJob(job.id);
      if (latestJob?.status === "invalidated") {
        const assistantMessage = await this.store.companion.addMessage({
          id: companionId("msg"),
          conversationId: conversation.id,
          businessId: input.businessId,
          projectId: conversation.projectId,
          authorKind: "system",
          body: "That reply was cancelled after sign-out. No extra work was written into another workspace.",
          liveAi: false,
          createdAt: now(),
          metadata: { invalidated: true }
        });
        return { conversation, userMessage, assistantMessage, liveAi: false, toolsUsed };
      }

      const assistantMessage = await this.store.companion.addMessage({
        id: companionId("msg"),
        conversationId: conversation.id,
        businessId: input.businessId,
        projectId: conversation.projectId,
        authorKind: "assistant",
        body: text,
        liveAi: true,
        createdAt: now(),
        metadata: { liveAi: true, toolsUsed: toolsUsed.map((item) => item.name) }
      });
      const turn = { conversation, userMessage, assistantMessage, liveAi: true, toolsUsed };
      await this.store.companion.updateJob({
        ...job,
        status: "completed",
        updatedAt: now(),
        resultJson: JSON.stringify(turn)
      });
      await this.store.companion.updateConversation({ ...conversation, updatedAt: now() });
      return turn;
    } catch (error) {
      const assistantMessage = await this.store.companion.addMessage({
        id: companionId("msg"),
        conversationId: conversation.id,
        businessId: input.businessId,
        projectId: conversation.projectId,
        authorKind: "system",
        body: `${INTELLIGENCE_DISPLAY_NAME} could not complete that reply. Saved work is unchanged. Retry the same message — it will not duplicate the billable action if you reuse the same request id.`,
        liveAi: false,
        createdAt: now(),
        metadata: { failed: true, error: error instanceof Error ? error.name : "unknown" }
      });
      await this.store.companion.updateJob({
        ...job,
        status: "failed",
        updatedAt: now(),
        error: error instanceof Error ? error.message : "unknown"
      });
      return { conversation, userMessage, assistantMessage, liveAi: false, toolsUsed };
    }
  }

  startingActions() {
    return STARTING_ACTIONS;
  }

  async executeTool(
    name: string,
    raw: string,
    context: AuthorizedBusinessContext,
    user: User
  ): Promise<{ ok: boolean; result: unknown }> {
    const args = safeJson(raw);
    if (name === "read_business_context") {
      return { ok: true, result: buildAuthorizedModelContext({ context, history: [] }) };
    }
    if (name === "save_draft") {
      const parsed = saveDraftSchema.safeParse(args);
      if (!parsed.success) return { ok: false, result: { error: "invalid_tool_input" } };
      const draft = await this.work.saveDraft(context.business.id, user, parsed.data);
      return { ok: true, result: { workItemId: draft.id, status: draft.status, labeled: "saved_draft" } };
    }
    if (name === "create_or_update_task") {
      const parsed = upsertTaskSchema.safeParse(args);
      if (!parsed.success) return { ok: false, result: { error: "invalid_tool_input" } };
      const task = await this.work.upsertTask(context.business.id, user, parsed.data);
      return { ok: true, result: { taskId: task.id, status: task.status } };
    }
    if (name === "propose_memory_update") {
      const parsed = proposeMemorySchema.safeParse(args);
      if (!parsed.success) return { ok: false, result: { error: "invalid_tool_input" } };
      const proposal = await this.workspace.proposeMemory(
        context.business.id,
        user,
        parsed.data.fieldKey,
        parsed.data.proposedValue,
        parsed.data.rationale
      );
      return {
        ok: true,
        result: { proposalId: proposal.id, status: "pending", labeled: `${INTELLIGENCE_DISPLAY_NAME} suggestion — not a confirmed fact` }
      };
    }
    if (name === "prepare_studio_generation") {
      const parsed = prepareStudioSchema.safeParse(args);
      if (!parsed.success) return { ok: false, result: { error: "invalid_tool_input" } };
      const created = await this.studio.createFromCopy(context.business.id, user, parsed.data);
      return { ok: true, result: { draftId: created.draft.id, workItemId: created.workItem.id, status: "draft_ready" } };
    }
    if (name === "prepare_estimate") {
      const parsed = prepareEstimateToolSchema.safeParse(args);
      if (!parsed.success) return { ok: false, result: { error: "invalid_tool_input" } };
      const estimate = prepareEstimate(parsed.data.items, context.profile.approvedRates);
      if (!estimate.ok) return { ok: false, result: { error: estimate.error } };
      const workItem = await this.work.saveDraft(context.business.id, user, {
        title: "Draft estimate — owner review required",
        body: formatEstimate(estimate.estimate),
        kind: "copy"
      });
      return { ok: true, result: { ...estimate.estimate, workItemId: workItem.id } };
    }
    if (name === "retrieve_project_proposal_status") {
      const parsed = retrieveStatusSchema.safeParse(args);
      if (!parsed.success) return { ok: false, result: { error: "invalid_tool_input" } };
      const status = await this.workspace.authorizedProjectStatus(context.business.id, user, parsed.data.projectId);
      if (parsed.data.projectId) {
        const project = await this.store.getProject(parsed.data.projectId);
        if (!project || project.businessId !== context.business.id) {
          return { ok: false, result: { error: "project_not_in_workspace" } };
        }
        const proposals = (await this.store.listProposals(project.id)).filter(isClientVisibleProposal);
        return {
          ok: true,
          result: {
            ...status,
            current: currentClientProposal(proposals)?.version ?? null,
            confirmed: confirmedProposal(proposals)?.version ?? null
          }
        };
      }
      return { ok: true, result: status };
    }
    return { ok: false, result: { error: "unknown_tool" } };
  }
}

function safeJson(raw: string) {
  try {
    return JSON.parse(raw || "{}") as unknown;
  } catch {
    return {};
  }
}
