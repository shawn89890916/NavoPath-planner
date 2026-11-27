import { describe, expect, it } from "vitest";
import { nativeFeatureActive, metricsPluginActive } from "./nativeFeatures";
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

it("stops Metrics recording when its view is unloaded or safe mode is enabled", () => {
  const snapshot = { safeMode: false, preferences: { installed: { "official:metrics": { enabled: true } } }, views: [{ owner: "official:metrics", nativeMode: "metrics" }] } as unknown as ExtensionSnapshot;
  expect(metricsPluginActive(snapshot)).toBe(true);
  expect(metricsPluginActive({ ...snapshot, views: [] })).toBe(false);
  expect(metricsPluginActive({ ...snapshot, safeMode: true })).toBe(false);
});
