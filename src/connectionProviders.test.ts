import { describe, expect, it } from "vitest";
import { CONNECTION_PROVIDERS, connectionProvider, isConnectionAnchor, readSpPairState, spConnectionListed, spConnectionLabel, spPluginConnection, SP_PLUGIN_KEY } from "./connectionProviders";
import type { ExtensionSnapshot } from "./extensions/types";

describe("connection providers", () => {
  it("keeps stable destinations and routes shared credentials separately", () => {
    expect(new Set(CONNECTION_PROVIDERS.map(p => p.anchor)).size).toBe(CONNECTION_PROVIDERS.length);
    expect(connectionProvider("connection-other-calendar")?.id).toBe("other-calendar");
    expect(connectionProvider("calendar-feed")).toBeUndefined();
    for (const anchor of ["connections", "connection-add", "connection-advanced", "calendar-feed", "external-calendar", "mcp", "sync-bridge"]) expect(isConnectionAnchor(anchor)).toBe(true);
    expect(isConnectionAnchor("unknown")).toBe(false);
  });
  it("only loads the trusted installed official sync page", () => {
    const official = { sourceId: "official", manifest: { id: "super-productivity-sync", kind: "plugin" } };
    const other = { ...official, sourceId: "third-party" };
    const page = { owner: SP_PLUGIN_KEY, name: "Super Productivity Sync", id: "page" };
    const snap = { catalog: [other, official], preferences: { installed: { [SP_PLUGIN_KEY]: { manifest: official.manifest, enabled: true } } }, settingsPages: [page], safeMode: false } as unknown as ExtensionSnapshot;
    expect(spPluginConnection(snap).catalog).toBe(official);
    expect(spPluginConnection(snap).page).toBe(page);
    expect(spPluginConnection({ ...snap, safeMode: true }).page).toBeUndefined();
    expect(spPluginConnection({ ...snap, preferences: { ...snap.preferences, installed: {} } }).page).toBeUndefined();
  });
  it("does not claim successful sync or a connected app without evidence", () => {
    const unknown = readSpPairState({ status: "active" });
    expect(unknown.kind).toBe("unknown");
    expect(spConnectionListed(unknown, false)).toBe(false);
    const active = readSpPairState({ pairId: "id", status: "active", conflicts: [] });
    expect(spConnectionLabel(active, true, false)).toBe("Paired");
    expect(spConnectionLabel(active, false, false)).toBe("Paired · plugin not running");
    expect(spConnectionListed(active, false)).toBe(true);
    expect(spConnectionLabel(readSpPairState({ pairId: "id", status: "active", conflicts: [{}] }), true, false)).toBe("Sync conflicts");
    expect(spConnectionLabel(readSpPairState({ pairId: "id", status: "preview" }), true, false)).toBe("Review initial import");
    expect(spConnectionLabel(readSpPairState({ pairId: "id", status: "paused" }), true, false)).toBe("Sync paused");
  });
});
