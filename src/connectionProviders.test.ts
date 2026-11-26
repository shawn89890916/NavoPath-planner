import { describe, expect, it } from "vitest";
import { CONNECTION_PROVIDERS, connectionProvider, isConnectionAnchor, spPluginConnection, SP_PLUGIN_KEY } from "./connectionProviders";
import type { ExtensionSnapshot } from "./extensions/types";
describe("connection providers", () => {
  it("keeps stable, unique provider destinations and legacy calendar links", () => {
    expect(new Set(CONNECTION_PROVIDERS.map(p => p.anchor)).size).toBe(CONNECTION_PROVIDERS.length);
    expect(connectionProvider("calendar-feed")?.id).toBe("other-calendar");
    expect(connectionProvider("connection-super-productivity")?.id).toBe("super-productivity");
    expect(isConnectionAnchor("connections")).toBe(true);
    expect(isConnectionAnchor("mcp")).toBe(false);
    expect(connectionProvider("unknown")).toBeUndefined();
  });
  it("uses only the official plugin and does not mount disabled or safe-mode pages", () => {
    const official = { sourceId: "official", manifest: { id: "super-productivity-sync", kind: "plugin" } };
    const other = { ...official, sourceId: "third-party" };
    const page = { owner: SP_PLUGIN_KEY, name: "Super Productivity Sync", id: "page" };
    const snap = { catalog: [other, official], preferences: { installed: { [SP_PLUGIN_KEY]: { manifest: official.manifest, enabled: true } } }, settingsPages: [page], safeMode: false } as unknown as ExtensionSnapshot;
    expect(spPluginConnection(snap).catalog).toBe(official);
    expect(spPluginConnection(snap).page).toBe(page);
    expect(spPluginConnection({ ...snap, safeMode: true }).page).toBeUndefined();
    expect(spPluginConnection({ ...snap, preferences: { ...snap.preferences, installed: {} } }).page).toBeUndefined();
  });
});
