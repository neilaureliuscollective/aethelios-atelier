import { safeCallbackUrl } from "@/lib/auth/callbackUrl";
import type { GuestWorkClaim, GuestWorkKind } from "@/lib/cofounder/types";
import { ConflictError, ForbiddenError } from "@/lib/domain/errors";
import type { PersistenceAdapter } from "@/lib/persistence/adapter";
import type { User } from "@/lib/types";

export type GuestClaimInput = {
  guestWorkId: string;
  kind: GuestWorkKind;
  destination?: string;
  payload?: unknown;
};

function sanitizeGuestWorkId(value: string) {
  return value.trim().slice(0, 80);
}

function payloadJson(payload: unknown) {
  if (payload == null) return "{}";
  return JSON.stringify(payload).slice(0, 20_000);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function revisionFromClaimPayload(payload: unknown): number {
  const record = asRecord(payload);
  const raw = record.localRevision ?? record.sourceRevision;
  const revision = Number(raw ?? 0);
  return Number.isInteger(revision) && revision >= 0 ? revision : 0;
}

function payloadsEquivalent(left: string, right: string) {
  if (left === right) return true;
  try {
    return JSON.stringify(JSON.parse(left)) === JSON.stringify(JSON.parse(right));
  } catch {
    return false;
  }
}

export class GuestWorkService {
  constructor(private readonly store: PersistenceAdapter) {}

  async claim(user: User, input: GuestClaimInput): Promise<GuestWorkClaim> {
    const guestWorkId = sanitizeGuestWorkId(input.guestWorkId);
    if (!guestWorkId) {
      throw new ForbiddenError("A guest work identifier is required.");
    }
    const destination = safeCallbackUrl(input.destination, "/companion/confirm");
    const sourceRevision = revisionFromClaimPayload(input.payload);
    const next: GuestWorkClaim = {
      guestWorkId,
      sourceRevision,
      ownerId: user.id,
      kind: input.kind,
      destination,
      payloadJson: payloadJson(input.payload),
      createdAt: new Date().toISOString()
    };

    return this.store.runInTransaction(async () => {
      const siblings = await this.store.companion.listGuestWorkClaims(guestWorkId);
      const foreign = siblings.find((item) => item.ownerId !== user.id);
      if (foreign) {
        throw new ForbiddenError("This guest work already belongs to another account.");
      }
      const existing = siblings.find((item) => item.sourceRevision === sourceRevision);
      if (existing) {
        if (!payloadsEquivalent(existing.payloadJson, next.payloadJson)) {
          throw new ConflictError(
            "This Discovery revision was already claimed with different content. A newer revision can be claimed separately.",
            existing.sourceRevision,
            existing
          );
        }
        return existing;
      }

      const stored = await this.store.companion.insertGuestWorkClaim(next);
      if (stored.ownerId !== user.id) {
        throw new ForbiddenError("This guest work already belongs to another account.");
      }
      if (!payloadsEquivalent(stored.payloadJson, next.payloadJson)) {
        throw new ConflictError(
          "This Discovery revision was already claimed with different content. A newer revision can be claimed separately.",
          stored.sourceRevision,
          stored
        );
      }
      return stored;
    });
  }

  async requireOwnedClaim(user: User, guestWorkId: string, sourceRevision?: number | null) {
    const claim = await this.readForUser(user, guestWorkId, sourceRevision);
    if (!claim) {
      throw new ForbiddenError("This Discovery direction has not been claimed for the signed-in account.");
    }
    return claim;
  }

  async readForUser(user: User, guestWorkId: string, sourceRevision?: number | null) {
    const id = sanitizeGuestWorkId(guestWorkId);
    const claim =
      sourceRevision == null
        ? await this.store.companion.getGuestWorkClaim(id)
        : await this.store.companion.getGuestWorkClaim(id, sourceRevision);
    if (!claim) return null;
    if (claim.ownerId !== user.id && user.role !== "founder") {
      throw new ForbiddenError("This guest work already belongs to another account.");
    }
    return claim;
  }
}

export function publicGuestClaim(claim: GuestWorkClaim) {
  return {
    guestWorkId: claim.guestWorkId,
    sourceRevision: claim.sourceRevision,
    ownerId: claim.ownerId,
    kind: claim.kind,
    destination: claim.destination,
    createdAt: claim.createdAt
  };
}
