import { describe, expect, it } from "vitest";
import { nativeFeatureActive } from "./nativeFeatures";
import type { ExtensionSnapshot } from "./types";
describe("native contribution lifecycle", () => {
  it("requires both an enabled installation and a loaded contribution", () => {
    const snapshot = { safeMode: false, preferences: { installed: { "official:habits": { enabled: true } } }, nativeFeatures: ["habits"] } as unknown as ExtensionSnapshot;
    expect(nativeFeatureActive(snapshot, "habits")).toBe(true);
    expect(nativeFeatureActive({ ...snapshot, safeMode: true }, "habits")).toBe(false);
    expect(nativeFeatureActive({ ...snapshot, nativeFeatures: [] }, "habits")).toBe(false);
    expect(nativeFeatureActive({ ...snapshot, preferences: { ...snapshot.preferences, installed: {} } }, "habits")).toBe(false);
    expect(nativeFeatureActive(snapshot, "engagement")).toBe(false);
  });
});
