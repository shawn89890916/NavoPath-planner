import { describe, expect, it, vi } from "vitest";
import { createAuthSessionStorage, setAuthPersistencePreference, type AuthStorage } from "./authSessionStorage";

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  const storage: AuthStorage = {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { values.set(key, value); }),
    removeItem: vi.fn((key: string) => { values.delete(key); }),
  };
  return { storage, values };
}

describe("auth session storage", () => {
  it("prefers an existing persistent session during startup", async () => {
    const persistent = memoryStorage({ auth: "persisted" });
    const transient = memoryStorage({ auth: "transient" });
    const storage = createAuthSessionStorage(persistent.storage, transient.storage);

    await expect(storage.getItem("auth")).resolves.toBe("persisted");
    await storage.setItem("auth", "refreshed");

    expect(persistent.values.get("auth")).toBe("refreshed");
    expect(transient.values.has("auth")).toBe(false);
  });

  it("keeps an unchecked login in session storage only", async () => {
    const persistent = memoryStorage();
    const transient = memoryStorage();
    const storage = createAuthSessionStorage(persistent.storage, transient.storage);

    setAuthPersistencePreference(false);
    await storage.setItem("auth", "current-window");

    expect(transient.values.get("auth")).toBe("current-window");
    expect(persistent.values.has("auth")).toBe(false);
  });

  it("removes sign-out data from both stores", async () => {
    const persistent = memoryStorage({ auth: "persisted" });
    const transient = memoryStorage({ auth: "transient" });
    const storage = createAuthSessionStorage(persistent.storage, transient.storage);

    await storage.removeItem("auth");

    expect(persistent.values.has("auth")).toBe(false);
    expect(transient.values.has("auth")).toBe(false);
  });
});
