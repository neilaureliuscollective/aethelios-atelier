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

/** Local extra serialization only. Database transactions are the real guarantee. */
const locks = new Map<string, Promise<unknown>>();

export async function withProcessLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const previous = locks.get(key) ?? Promise.resolve();
  let release!: (value?: unknown) => void;
  const current = new Promise((resolve) => {
    release = resolve;
  });
  locks.set(key, current);
  await previous.catch(() => undefined);
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

export const USAGE_HOLD_MS = 15 * 60 * 1000;

export type UsageReservation = {
  event: UsageEvent;
  reused?: boolean;
};

export class CompanionUsage {
  constructor(
    private readonly store: PersistenceAdapter,
    private readonly workspace = new CompanionWorkspace(store)
  ) {}

  async snapshot(businessId: string, user: User): Promise<UsageSnapshot> {
    const context = await this.workspace.requireMembership(businessId, user);
    await this.recoverExpiredHolds();
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

  async recoverExpiredHolds() {
    return this.store.companion.releaseExpiredHolds(new Date().toISOString());
  }

  async reserve(
    businessId: string,
    user: User,
    kind: UsageKind,
    units = 1,
    metadata?: Record<string, unknown>,
    operationId?: string
  ): Promise<UsageReservation> {
    const op = operationId || (typeof metadata?.operationId === "string" ? metadata.operationId : companionId("op"));
    return withProcessLock(`${businessId}:${kind}:${periodStartIso()}`, () =>
    this.store.runInTransaction(async () => {
      await this.workspace.requireMembership(businessId, user);
      await this.store.companion.lockUsageBudget(businessId, kind, periodStartIso());
      await this.store.companion.releaseExpiredHolds(new Date().toISOString());
      const existing = await this.store.companion.getUsageByOperation(businessId, op);
      if (existing?.status === "held" || existing?.status === "settled") {
        return { event: existing, reused: true };
      }
      if (kind === "talk" || kind === "image" || kind === "voice") {
        const held = await this.store.companion.countHeldUsage(businessId, kind);
        const limit = limitsForPlan(
          (await this.workspace.requireMembership(businessId, user)).business.planId,
          configuredLimitOverrides()
        ).concurrentGenerations;
        if (held >= limit) {
          throw new LimitError("A generation is already in progress for this workspace. Wait for it to finish or retry the same request.");
        }
      }
      if (existing?.status === "released") {
        const reheld: UsageEvent = {
          ...existing,
          status: "held",
          units,
          expiresAt: new Date(Date.now() + USAGE_HOLD_MS).toISOString(),
          metadata: { ...metadata, status: "held", operationId: op, retriedAt: new Date().toISOString() }
        };
        const swapped = await this.store.companion.transitionUsageEvent(existing.id, "released", reheld);
        if (swapped) return { event: swapped };
      }
      const snapshot = await this.snapshotInTx(businessId, user);
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
        operationId: op,
        expiresAt: new Date(Date.now() + USAGE_HOLD_MS).toISOString(),
        metadata: { ...metadata, status: "held", operationId: op }
      });
      return { event };
    })
    );
  }

  async settle(reservation: UsageReservation, actualUnits?: number) {
    return this.store.runInTransaction(async () => {
      const latest =
        (await this.store.companion.getUsageEvent(reservation.event.id)) ?? reservation.event;
      if (latest.status === "settled") return latest;
      if (latest.status === "released") {
        throw new LimitError("That usage hold was already released and cannot be settled.");
      }
      const units = actualUnits ?? latest.units;
      const event: UsageEvent = {
        ...latest,
        units,
        status: "settled",
        expiresAt: undefined,
        metadata: { ...latest.metadata, status: "settled", settledAt: new Date().toISOString() }
      };
      const swapped = await this.store.companion.transitionUsageEvent(latest.id, "held", event);
      if (swapped) return swapped;
      const current = await this.store.companion.getUsageEvent(latest.id);
      if (current?.status === "settled") return current;
      if (current?.status === "released") {
        throw new LimitError("That usage hold was already released and cannot be settled.");
      }
      throw new LimitError("That usage hold could not be settled.");
    });
  }

  async release(reservation: UsageReservation) {
    return this.store.runInTransaction(async () => {
      const latest =
        (await this.store.companion.getUsageEvent(reservation.event.id)) ?? reservation.event;
      if (latest.status === "released" || latest.status === "settled") return latest;
      const event: UsageEvent = {
        ...latest,
        status: "released",
        expiresAt: undefined,
        metadata: { ...latest.metadata, status: "released", releasedAt: new Date().toISOString() }
      };
      const swapped = await this.store.companion.transitionUsageEvent(latest.id, "held", event);
      if (swapped) return swapped;
      const current = await this.store.companion.getUsageEvent(latest.id);
      if (current) return current;
      return event;
    });
  }

  async consume(
    businessId: string,
    user: User,
    kind: UsageKind,
    units = 1,
    metadata?: Record<string, unknown>,
    operationId?: string
  ) {
    const reservation = await this.reserve(businessId, user, kind, units, metadata, operationId);
    if (!reservation.reused) await this.settle(reservation, units);
    return this.snapshot(businessId, user);
  }

  async assertConcurrent(businessId: string, user: User, kind: "talk" | "image" | "voice") {
    const context = await this.workspace.requireMembership(businessId, user);
    const held = await this.store.companion.countHeldUsage(businessId, kind);
    const limit = limitsForPlan(context.business.planId, configuredLimitOverrides()).concurrentGenerations;
    if (held >= limit) {
      throw new LimitError("A generation is already in progress for this workspace. Wait for it to finish or retry the same request.");
    }
  }

  private async snapshotInTx(businessId: string, user: User): Promise<UsageSnapshot> {
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
}
