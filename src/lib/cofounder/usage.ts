import {
  assertWithinBudget,
  limitsForPlan,
  periodStartIso,
  toUsageSnapshot,
  type PlanLimits
} from "@/lib/cofounder/entitlements";
import { LimitError } from "@/lib/domain/errors";
import type { PersistenceAdapter } from "@/lib/persistence/adapter";
import type { UsageEvent, UsageKind, UsageSnapshot } from "@/lib/cofounder/types";
import type { User } from "@/lib/types";
import { CompanionWorkspace } from "@/lib/cofounder/workspace";

function companionId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

const locks = new Map<string, Promise<void>>();

async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const previous = locks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  locks.set(
    key,
    previous.then(() => current)
  );
  await previous;
  try {
    return await fn();
  } finally {
    release();
    if (locks.get(key) === current) locks.delete(key);
  }
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

export type UsageReservation = {
  event: UsageEvent;
};

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

  async reserve(
    businessId: string,
    user: User,
    kind: UsageKind,
    units = 1,
    metadata?: Record<string, unknown>
  ): Promise<UsageReservation> {
    return withLock(`${businessId}:${kind}`, async () => {
      const snapshot = await this.snapshot(businessId, user);
      const check = assertWithinBudget(snapshot, kind, units);
      if (!check.ok) throw new LimitError(check.message);
      const event = await this.store.companion.addUsageEvent({
        id: companionId("use"),
        businessId,
        userId: user.id,
        kind,
        units,
        createdAt: new Date().toISOString(),
        status: "held",
        metadata: { ...metadata, status: "held" }
      });
      return { event };
    });
  }

  async settle(reservation: UsageReservation, actualUnits?: number) {
    const units = actualUnits ?? reservation.event.units;
    const event: UsageEvent = {
      ...reservation.event,
      units,
      status: "settled",
      metadata: { ...reservation.event.metadata, status: "settled", settledAt: new Date().toISOString() }
    };
    await this.store.companion.updateUsageEvent(event);
    return event;
  }

  async release(reservation: UsageReservation) {
    const event: UsageEvent = {
      ...reservation.event,
      status: "released",
      metadata: { ...reservation.event.metadata, status: "released", releasedAt: new Date().toISOString() }
    };
    await this.store.companion.updateUsageEvent(event);
    return event;
  }

  async consume(businessId: string, user: User, kind: UsageKind, units = 1, metadata?: Record<string, unknown>) {
    const reservation = await this.reserve(businessId, user, kind, units, metadata);
    await this.settle(reservation, units);
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
