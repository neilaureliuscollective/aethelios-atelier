import { afterEach, describe, expect, it } from "vitest";
import { clearOwnerScopedData, readOwnerJson, writeOwnerJson } from "@/lib/client/ownerScope";

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    key(index: number) {
      return [...map.keys()][index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    }
  };
}

describe("owner-scoped recovery storage", () => {
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  it("stores recovery under the owner and project and clears only that owner on signout", () => {
    const sessionStorage = memoryStorage();
    const localStorage = memoryStorage();
    localStorage.setItem("atelier.guestDraft.v1", JSON.stringify({ keep: true }));
    (globalThis as { window: unknown }).window = { sessionStorage, localStorage };
    writeOwnerJson("owner-a", "submit", { key: "a" }, "prj-1");
    writeOwnerJson("owner-b", "submit", { key: "b" }, "prj-1");
    expect(readOwnerJson("owner-a", "submit", "prj-1")).toEqual({ key: "a" });
    clearOwnerScopedData("owner-a");
    expect(readOwnerJson("owner-a", "submit", "prj-1")).toBeNull();
    expect(readOwnerJson("owner-b", "submit", "prj-1")).toEqual({ key: "b" });
    expect(localStorage.getItem("atelier.guestDraft.v1")).toContain("keep");
  });
});
