import { safeCallbackUrl } from "@/lib/auth/callbackUrl";
import type { GuestWorkClaim, GuestWorkKind } from "@/lib/cofounder/types";
import { ForbiddenError } from "@/lib/domain/errors";
import { isUniqueViolation } from "@/lib/persistence/unique";
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

export class GuestWorkService {
  constructor(private readonly store: PersistenceAdapter) {}

  async claim(user: User, input: GuestClaimInput): Promise<GuestWorkClaim> {
    const guestWorkId = sanitizeGuestWorkId(input.guestWorkId);
    if (!guestWorkId) {
      throw new ForbiddenError("A guest work identifier is required.");
    }
    const destination = safeCallbackUrl(input.destination, "/companion/confirm");
    const next: GuestWorkClaim = {
      guestWorkId,
      ownerId: user.id,
      kind: input.kind,
      destination,
      payloadJson: payloadJson(input.payload),
      createdAt: new Date().toISOString()
    };

    return this.store.runInTransaction(async () => {
      const existing = await this.store.companion.getGuestWorkClaim(guestWorkId);
      if (existing) {
        if (existing.ownerId !== user.id) {
          throw new ForbiddenError("This guest work already belongs to another account.");
        }
        return existing;
      }
      try {
        return await this.store.companion.insertGuestWorkClaim(next);
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        const raced = await this.store.companion.getGuestWorkClaim(guestWorkId);
        if (raced && raced.ownerId === user.id) return raced;
        throw new ForbiddenError("This guest work already belongs to another account.");
      }
    });
  }

  async readForUser(user: User, guestWorkId: string) {
    const claim = await this.store.companion.getGuestWorkClaim(sanitizeGuestWorkId(guestWorkId));
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
    ownerId: claim.ownerId,
    kind: claim.kind,
    destination: claim.destination,
    createdAt: claim.createdAt
  };
}
