export type SaveStatus = "unsaved" | "saving" | "saved" | "conflict" | "rejected" | "uncertain";

export type SaveResult = {
  version: number;
};

export type SaveFailure = {
  kind: "conflict" | "rejected" | "uncertain";
  currentVersion?: number;
  message: string;
};

export class CoalescedSaveQueue<T> {
  acknowledgedVersion: number;
  status: SaveStatus;
  lastError: string | null = null;
  private inFlight = false;
  private pending: T | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Set<() => void>();
  private flight: Promise<void> = Promise.resolve();

  constructor(
    initialVersion: number,
    private readonly saveFn: (payload: T, expectedVersion: number) => Promise<SaveResult>,
    private readonly debounceMs = 450,
    private readonly timers: {
      setTimeout: typeof setTimeout;
      clearTimeout: typeof clearTimeout;
    } = { setTimeout, clearTimeout }
  ) {
    this.acknowledgedVersion = initialVersion;
    this.status = "saved";
  }

  get hasUnconfirmedEdits() {
    return (
      this.pending !== null ||
      this.inFlight ||
      this.status === "unsaved" ||
      this.status === "saving" ||
      this.status === "uncertain" ||
      this.status === "conflict" ||
      this.status === "rejected"
    );
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  enqueue(payload: T) {
    this.pending = payload;
    if (this.status !== "saving") this.status = "unsaved";
    this.emit();
    this.schedule(this.debounceMs);
  }

  async flush() {
    this.clearTimer();
    await this.flight;
    if (this.pending && this.status !== "conflict" && this.status !== "rejected") {
      await this.run();
    }
    await this.flight;
  }

  retry() {
    if (this.status !== "saving") this.status = "unsaved";
    this.schedule(0);
  }

  private schedule(ms: number) {
    this.clearTimer();
    if (ms <= 0) {
      void this.run();
      return;
    }
    this.timer = this.timers.setTimeout(() => {
      void this.run();
    }, ms);
  }

  private clearTimer() {
    if (this.timer) this.timers.clearTimeout(this.timer);
    this.timer = null;
  }

  private async run() {
    if (this.inFlight) return this.flight;
    if (this.pending === null) return this.flight;
    this.inFlight = true;
    this.flight = this.drain();
    await this.flight;
  }

  private async drain() {
    try {
      while (this.pending && this.status !== "conflict" && this.status !== "rejected") {
        const payload = this.pending;
        this.pending = null;
        this.status = "saving";
        this.emit();
        const expected = this.acknowledgedVersion;
        try {
          const result = await this.saveFn(payload, expected);
          this.acknowledgedVersion = result.version;
          this.lastError = null;
          this.status = this.pending ? "unsaved" : "saved";
        } catch (error) {
          const failure = error as SaveFailure;
          if (!this.pending) this.pending = payload;
          if (failure.kind === "conflict") {
            this.status = "conflict";
            if (typeof failure.currentVersion === "number") {
              this.acknowledgedVersion = failure.currentVersion;
            }
          } else if (failure.kind === "rejected") {
            this.status = "rejected";
          } else {
            this.status = "uncertain";
          }
          this.lastError = failure.message ?? "Save did not confirm.";
          break;
        }
      }
    } finally {
      this.inFlight = false;
      this.emit();
    }
  }

  private emit() {
    for (const listener of this.listeners) listener();
  }
}
