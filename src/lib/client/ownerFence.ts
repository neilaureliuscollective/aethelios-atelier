export class OwnerFence {
  generation = 0;
  ownerId: string | null = null;

  switchTo(ownerId: string | null) {
    if (this.ownerId === ownerId) return this.generation;
    this.ownerId = ownerId;
    this.generation += 1;
    return this.generation;
  }

  isCurrent(generation: number, ownerId: string | null) {
    return this.generation === generation && this.ownerId === ownerId;
  }
}

export const ownerFence = new OwnerFence();
