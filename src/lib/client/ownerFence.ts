export type CapturedFence = {
  ownerId: string | null;
  generation: number;
  signOutEpoch: number;
};

export class OwnerFence {
  generation = 0;
  ownerId: string | null = null;
  signOutEpoch = 0;
  private ownerSignOutEpoch = new Map<string, number>();

  capture(): CapturedFence {
    return {
      ownerId: this.ownerId,
      generation: this.generation,
      signOutEpoch: this.signOutEpoch
    };
  }

  switchTo(ownerId: string | null) {
    if (this.ownerId === ownerId) return this.generation;
    this.ownerId = ownerId;
    this.generation += 1;
    return this.generation;
  }

  /** Explicit sign-out invalidates delayed storage writes for this owner. Account switching does not. */
  markSignOut(ownerId: string) {
    this.signOutEpoch += 1;
    this.ownerSignOutEpoch.set(ownerId, this.signOutEpoch);
    return this.switchTo(null);
  }

  allowsStorageWrite(captured: { ownerId: string; signOutEpoch: number }) {
    const invalidatedAt = this.ownerSignOutEpoch.get(captured.ownerId);
    if (invalidatedAt == null) return true;
    return captured.signOutEpoch >= invalidatedAt;
  }

  isCurrent(generation: number, ownerId: string | null) {
    return this.generation === generation && this.ownerId === ownerId;
  }
}

export const ownerFence = new OwnerFence();
