import {
  assertWithinBudget,
  limitsForPlan,
  periodStartIso,
  toUsageSnapshot,
  type PlanLimits
} from "@/lib/cofounder/entitlements";
import { LimitError } from "@/lib/domain/errors";
import type { PersistenceAdapter } from "@/lib/persistence/adapter";
import type { UsageKind, UsageSnapshot } from "@/lib/cofounder/types";
import type { User } from "@/lib/types";
import { CompanionWorkspace } from "@/lib/cofounder/workspace";

function companionId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function configuredLimitOverrides(): Partial<PlanLimits> {
  const talk = Number(process.env.ATELIER_PLAN_TALK_LIMIT ?? "");
  const images = Number(process.env.ATELIER_PLAN_IMAGE_LIMIT ?? "");
  const voice = Number(process.env.ATELIER_PLAN_VOICE_MINUTES ?? "");
  const concurrent = Number(process.env.ATELIER_MAX_CONCURRENT_GENERATIONS ?? "");
  return {
    ...(Number.isFinite(talk) && talk > 0 ? { talk } : {}),
    ...(Number.isFinite(images) && images > 0 ? { images } : {}),
    ...(Number.isFinite(voice) && voice > 0 ? { voiceMinutes: voice } : {}),
    ...(Number.isFinite(concurrent) && concurrent > 0 ? { concurrentGenerations: concurrent } : {})
  };
}

export class CompanionUsage {
  constructor(
    private readonly store: PersistenceAdapter,
    private readonly workspace = new CompanionWorkspace(store)
  ) {}

  async snapshot(businessId: string, user: User): Promise<UsageSnapshot> {
    const context = await this.workspace.requireMembership(businessId, user);
    const since = periodStartIso();
    const [talkUsed, imagesUsed, voiceMinutesUsed] = await Promise.all([
      this.store.companion.sumUsage(businessId, "talk", since),
      this.store.companion.sumUsage(businessId, "image", since),
      this.store.companion.sumUsage(businessId, "voice", since)
    ]);
    return toUsageSnapshot({
      planId: context.business.planId,
      talkUsed,
      imagesUsed,
      voiceMinutesUsed,
      limits: configuredLimitOverrides()
    });
  }

  async consume(businessId: string, user: User, kind: UsageKind, units = 1, metadata?: Record<string, unknown>) {
    const snapshot = await this.snapshot(businessId, user);
    const check = assertWithinBudget(snapshot, kind, units);
    if (!check.ok) throw new LimitError(check.message);
    await this.store.companion.addUsageEvent({
      id: companionId("use"),
      businessId,
      userId: user.id,
      kind,
      units,
      createdAt: new Date().toISOString(),
      metadata
    });
    return this.snapshot(businessId, user);
  }

  async assertConcurrent(businessId: string, user: User, kind: "talk" | "image" | "voice") {
    const context = await this.workspace.requireMembership(businessId, user);
    const pending = await this.store.companion.countPendingJobs(businessId, kind);
    const limit = limitsForPlan(context.business.planId, configuredLimitOverrides()).concurrentGenerations;
    if (pending >= limit) {
      throw new LimitError("A generation is already in progress for this workspace. Wait for it to finish or retry the same request.");
    }
  }
}
