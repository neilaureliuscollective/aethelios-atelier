import { CompanionWorkspace } from "@/lib/cofounder/workspace";
import { ForbiddenError, NotFoundError } from "@/lib/domain/errors";
import type { PersistenceAdapter } from "@/lib/persistence/adapter";
import type { TodayView, WorkItem, WorkKind, WorkStatus } from "@/lib/cofounder/types";
import type { User } from "@/lib/types";

function now() {
  return new Date().toISOString();
}

function companionId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

export class CompanionWork {
  constructor(
    private readonly store: PersistenceAdapter,
    private readonly workspace = new CompanionWorkspace(store)
  ) {}

  async saveDraft(
    businessId: string,
    user: User,
    input: {
      title: string;
      body: string;
      kind?: string;
      projectId?: string;
      workItemId?: string;
    }
  ) {
    const context = await this.workspace.requireMembership(businessId, user);
    if (input.projectId && !context.projects.some((project) => project.id === input.projectId)) {
      throw new ForbiddenError("That project is not part of this business.");
    }
    if (input.workItemId) {
      const existing = await this.requireWorkItem(businessId, input.workItemId);
      const updated: WorkItem = {
        ...existing,
        title: input.title,
        status: existing.status === "archived" ? "open" : existing.status,
        payload: { ...existing.payload, body: input.body, kind: input.kind ?? existing.payload.kind },
        projectId: input.projectId ?? existing.projectId,
        updatedAt: now()
      };
      return this.store.companion.updateWorkItem(updated);
    }
    const item: WorkItem = {
      id: companionId("work"),
      businessId,
      projectId: input.projectId,
      kind: "draft",
      title: input.title,
      status: "open",
      payload: { body: input.body, kind: input.kind ?? "copy" },
      createdBy: user.id,
      createdAt: now(),
      updatedAt: now()
    };
    return this.store.companion.addWorkItem(item);
  }

  async upsertTask(
    businessId: string,
    user: User,
    input: { taskId?: string; title: string; detail?: string; status?: WorkStatus; projectId?: string }
  ) {
    await this.workspace.requireMembership(businessId, user);
    if (input.taskId) {
      const existing = await this.requireWorkItem(businessId, input.taskId);
      return this.store.companion.updateWorkItem({
        ...existing,
        title: input.title,
        status: input.status ?? existing.status,
        payload: { ...existing.payload, detail: input.detail ?? existing.payload.detail },
        projectId: input.projectId ?? existing.projectId,
        updatedAt: now(),
        archivedAt: input.status === "archived" ? now() : existing.archivedAt
      });
    }
    const item: WorkItem = {
      id: companionId("task"),
      businessId,
      projectId: input.projectId,
      kind: "task",
      title: input.title,
      status: input.status ?? "open",
      payload: { detail: input.detail ?? "" },
      createdBy: user.id,
      createdAt: now(),
      updatedAt: now()
    };
    return this.store.companion.addWorkItem(item);
  }

  async list(businessId: string, user: User, kind?: WorkKind) {
    await this.workspace.requireMembership(businessId, user);
    const items = await this.store.companion.listWorkItems(businessId);
    return items.filter((item) => !kind || item.kind === kind);
  }

  async get(businessId: string, user: User, workItemId: string) {
    await this.workspace.requireMembership(businessId, user);
    return this.requireWorkItem(businessId, workItemId);
  }

  async archive(businessId: string, user: User, workItemId: string) {
    await this.workspace.requireMembership(businessId, user);
    const item = await this.requireWorkItem(businessId, workItemId);
    return this.store.companion.updateWorkItem({
      ...item,
      status: "archived",
      archivedAt: now(),
      updatedAt: now()
    });
  }

  async today(businessId: string, user: User): Promise<TodayView> {
    const context = await this.workspace.requireMembership(businessId, user);
    const items = await this.store.companion.listWorkItems(businessId);
    const assets = await this.store.companion.listStudioAssets(businessId);
    const unfinishedDrafts = items.filter(
      (item) => item.kind === "draft" && item.status !== "archived" && item.status !== "done" && item.status !== "exported"
    );
    const openTasks = items.filter((item) => item.kind === "task" && (item.status === "open" || item.status === "in_progress"));
    const pendingApprovals = [
      ...context.memoryPending,
      ...items.filter((item) => item.status === "awaiting_review")
    ];
    const pendingAssets = assets.filter((asset) => asset.status === "pending" || asset.status === "failed");
    const empty =
      unfinishedDrafts.length === 0 &&
      openTasks.length === 0 &&
      pendingApprovals.length === 0 &&
      pendingAssets.length === 0;
    return {
      generatedAt: now(),
      unfinishedDrafts,
      openTasks,
      pendingApprovals,
      pendingAssets,
      emptyReason: empty
        ? "Nothing is waiting. Today is built from saved drafts, owner tasks, and pending approvals — not invented insights."
        : undefined
    };
  }

  private async requireWorkItem(businessId: string, workItemId: string) {
    const item = await this.store.companion.getWorkItem(workItemId);
    if (!item || item.businessId !== businessId) {
      throw new NotFoundError("Work item not found.");
    }
    return item;
  }
}
