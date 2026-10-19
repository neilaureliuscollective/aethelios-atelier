export type SaveStatus = "unsaved" | "saving" | "saved" | "conflict" | "rejected" | "uncertain";

export type SaveResult = {
  version: number;
};

export type SaveFailure = {
  kind: "conflict" | "rejected" | "uncertain";
  currentVersion?: number;
  serverBrief?: unknown;
  message: string;
};

export class CoalescedSaveQueue<T> {
  acknowledgedVersion: number;
  status: SaveStatus;
  lastError: string | null = null;
  conflictVersion: number | null = null;
  disposed = false;
  reviewHold = false;
  private inFlight = false;
  private pending: T | null = null;
  private inFlightPayload: T | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Set<() => void>();
  private flight: Promise<void> = Promise.resolve();

  constructor(
    initialVersion: number,
    private readonly saveFn: (payload: T, expectedVersion: number) => Promise<SaveResult>,
    private readonly debounceMs = 450,
    private readonly timers: {
      setTimeout: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
      clearTimeout: (id: ReturnType<typeof setTimeout>) => void;
    } = {
      setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
      clearTimeout: (id) => globalThis.clearTimeout(id)
    },
    initialStatus: SaveStatus = "saved"
  ) {
    this.acknowledgedVersion = initialVersion;
    this.status = initialStatus;
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

  dispose() {
    this.disposed = true;
    this.clearTimer();
    this.listeners.clear();
  }

  setReviewHold(held: boolean) {
    this.reviewHold = held;
    if (held) this.clearTimer();
  }

  enqueue(payload: T) {
    if (this.disposed) return;
    this.pending = payload;
    if (this.reviewHold || this.status === "conflict") {
      this.emit();
      return;
    }
    if (this.status !== "saving") this.status = "unsaved";
    this.emit();
    this.schedule(this.debounceMs);
  }

  async flush() {
    if (this.disposed) return;
    this.clearTimer();
    await this.flight;
    if (
      this.pending &&
      !this.reviewHold &&
      this.status !== "conflict" &&
      this.status !== "rejected"
    ) {
      await this.run();
    }
    await this.flight;
  }

  retry() {
    if (this.disposed) return;
    if (this.reviewHold || this.status === "conflict") return;
    if (this.status !== "saving") this.status = "unsaved";
    this.schedule(0);
  }

  /** After the user reviews a conflict, write local text against the server version. */
  resumeAfterReconcile(serverVersion: number) {
    if (this.disposed) return;
    this.reviewHold = false;
    this.acknowledgedVersion = serverVersion;
    this.conflictVersion = null;
    this.status = "unsaved";
    this.schedule(0);
  }

  /** Adopt the reviewed server snapshot without retrying an older payload. */
  adoptAcknowledged(version: number) {
    if (this.disposed) return;
    this.reviewHold = false;
    this.acknowledgedVersion = version;
    this.conflictVersion = null;
    this.pending = null;
    this.inFlightPayload = null;
    this.status = "saved";
    this.lastError = null;
    this.emit();
  }

  private schedule(ms: number) {
    if (this.disposed || this.reviewHold) return;
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
    if (this.disposed) return this.flight;
    if (this.inFlight) return this.flight;
    if (this.pending === null) return this.flight;
    this.inFlight = true;
    this.flight = this.drain();
    await this.flight;
  }

  private async drain() {
    try {
      while (
        !this.disposed &&
        !this.reviewHold &&
        this.pending &&
        this.status !== "conflict" &&
        this.status !== "rejected"
      ) {
        const payload = this.pending;
        this.pending = null;
        this.inFlightPayload = payload;
        this.status = "saving";
        this.emit();
        const expected = this.acknowledgedVersion;
        try {
          const result = await this.saveFn(payload, expected);
          if (this.disposed) return;
          this.acknowledgedVersion = result.version;
          this.lastError = null;
          this.inFlightPayload = null;
          this.status = this.pending ? "unsaved" : "saved";
        } catch (error) {
          if (this.disposed) return;
          const failure = error as SaveFailure;
          if (!this.pending) this.pending = payload;
          this.inFlightPayload = null;
          if (failure.kind === "conflict") {
            this.status = "conflict";
            this.conflictVersion = typeof failure.currentVersion === "number" ? failure.currentVersion : null;
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
    if (this.disposed) return;
    for (const listener of this.listeners) listener();
  }
}
