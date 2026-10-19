import { describe, expect, it } from "vitest";
import { CoalescedSaveQueue, type SaveFailure } from "@/lib/client/saveQueue";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("coalesced save queue", () => {
  it("serializes rapid typing and advances the acknowledged version from the successful response", async () => {
    const calls: Array<{ payload: string; expected: number }> = [];
    const first = deferred<{ version: number }>();
    let saveCount = 0;
    const queue = new CoalescedSaveQueue<string>(
      1,
      async (payload, expected) => {
        calls.push({ payload, expected });
        saveCount += 1;
        if (saveCount === 1) return first.promise;
        return { version: expected + 1 };
      },
      0
    );
    queue.enqueue("a");
    await Promise.resolve();
    queue.enqueue("ab");
    queue.enqueue("abc");
    expect(calls).toHaveLength(1);
    expect(calls[0]?.expected).toBe(1);
    first.resolve({ version: 2 });
    await queue.flush();
    expect(queue.acknowledgedVersion).toBe(3);
    expect(queue.status).toBe("saved");
    expect(calls[1]?.payload).toBe("abc");
    expect(calls[1]?.expected).toBe(2);
  });

  it("does not treat a later keystroke as saved while an earlier request is in flight", async () => {
    const first = deferred<{ version: number }>();
    const queue = new CoalescedSaveQueue<string>(1, async () => first.promise, 0);
    queue.enqueue("one");
    await Promise.resolve();
    queue.enqueue("two");
    expect(queue.status).toBe("saving");
    expect(queue.hasUnconfirmedEdits).toBe(true);
    first.resolve({ version: 2 });
    await queue.flush();
    expect(queue.status).toBe("saved");
  });

  it("keeps the local payload on conflict without advancing the acknowledged version", async () => {
    const queue = new CoalescedSaveQueue<string>(
      1,
      async () => {
        const error: SaveFailure = {
          kind: "conflict",
          currentVersion: 4,
          message: "stale"
        };
        throw error;
      },
      0
    );
    queue.enqueue("kept locally");
    await queue.flush();
    expect(queue.status).toBe("conflict");
    expect(queue.acknowledgedVersion).toBe(1);
    expect(queue.conflictVersion).toBe(4);
    expect(queue.hasUnconfirmedEdits).toBe(true);
  });

  it("does not dispatch after dispose", async () => {
    const calls: string[] = [];
    const queue = new CoalescedSaveQueue<string>(1, async (payload) => {
      calls.push(payload);
      return { version: 2 };
    }, 0);
    queue.dispose();
    queue.enqueue("late");
    await queue.flush();
    expect(calls).toEqual([]);
  });

  it("ignores a delayed success after dispose instead of advancing the version", async () => {
    const first = deferred<{ version: number }>();
    const queue = new CoalescedSaveQueue<string>(1, async () => first.promise, 0);
    queue.enqueue("stale-project");
    await Promise.resolve();
    queue.dispose();
    first.resolve({ version: 9 });
    await first.promise;
    await Promise.resolve();
    expect(queue.acknowledgedVersion).toBe(1);
    expect(queue.disposed).toBe(true);
  });
});
