import { describe, expect, it } from "vitest";
import { getAppHeaderPlugins, getCompactPluginGroups, moveCompactPlugin } from "./compactDock";
import { defaultExtensionPreferences, mergeExtensionPreferences, normalizeExtensionPreferences } from "./packages";
import type { InstalledExtension } from "./model";
import type { ExtensionSnapshot } from "./types";

function plugin(day: number): InstalledExtension {
  const id = `plugin-${day}`;
  return {
    key: `local:${id}`, sourceId: "local", sha256: "a".repeat(64), enabled: true,
    installedAt: new Date(Date.UTC(2026, 10, day)).toISOString(),
    manifest: { id, name: id, description: "Test plugin", author: "Tests", version: "1.0.0", kind: "plugin", apiVersion: 1, minAppVersion: "1.0.0", platforms: ["desktop"] },
  };
}

const items = [7, 3, 1, 6, 2, 5, 4].map(plugin);
const toolbarOwners = new Set(items.map((item) => item.key));
const preferences = () => ({ ...defaultExtensionPreferences(), installed: Object.fromEntries(items.map((item) => [item.key, item])) });
const names = (group: InstalledExtension[]) => group.map((item) => item.manifest.id);

describe("compact plugin dock", () => {
  it("fills five slots from the earliest installations and exposes the rest in More", () => {
    const { dock, more } = getCompactPluginGroups(preferences(), toolbarOwners);
    expect(names(dock)).toEqual(["plugin-1", "plugin-2", "plugin-3", "plugin-4", "plugin-5"]);
    expect(names(more)).toEqual(["plugin-6", "plugin-7"]);
  });

  it("honors existing placement choices and keeps every overflow shortcut accessible", () => {
    const prefs = { ...preferences(), compactDockLimit: 4, compactPlacements: {
      "local:plugin-1": "settings", "local:plugin-2": "more", "local:plugin-7": "bottom",
    } } as const;
    const { dock, more } = getCompactPluginGroups(prefs, toolbarOwners);
    expect(names(dock)).toEqual(["plugin-3", "plugin-4", "plugin-5", "plugin-7"]);
    expect(names(more)).toEqual(["plugin-2", "plugin-6"]);
  });

  it("replaces the targeted slot in a full dock and allows moving the plugin back to More", () => {
    const prefs = preferences();
    const pinned = { ...prefs, compactPlacements: moveCompactPlugin(prefs, toolbarOwners, "local:plugin-7", "bottom", "local:plugin-2") };
    expect(names(getCompactPluginGroups(pinned, toolbarOwners).dock)).toEqual(["plugin-1", "plugin-3", "plugin-4", "plugin-5", "plugin-7"]);
    expect(names(getCompactPluginGroups(pinned, toolbarOwners).more)).toEqual(["plugin-2", "plugin-6"]);
    const unpinned = { ...pinned, compactPlacements: moveCompactPlugin(pinned, toolbarOwners, "local:plugin-7", "more") };
    expect(names(getCompactPluginGroups(unpinned, toolbarOwners).more)).toEqual(["plugin-2", "plugin-7"]);
  });

  it("excludes Tasks views even when an older preference pinned them, while keeping Metrics and app-header contributions", () => {
    const prefs = { ...preferences(), compactPlacements: { "local:plugin-1": "bottom", "local:plugin-2": "more" } } as const;
    const contribution = (id: number) => ({ id: String(id), name: `plugin-${id}`, owner: `local:plugin-${id}`, mount() {} });
    const snapshot: ExtensionSnapshot = {
      preferences: prefs, catalog: [], updates: {}, status: {}, safeMode: false, busy: false, error: "", settingsPages: [],
      views: [
        { ...contribution(1), planningView: true, nativeMode: "tree" },
        { ...contribution(2), planningView: true, nativeMode: "kanban" },
        { ...contribution(3), planningView: true, nativeMode: "metrics" },
        { ...contribution(4), planningView: true },
      ],
      headerItems: [{ ...contribution(4), placement: "app-header" }],
    };
    const { owners } = getAppHeaderPlugins(snapshot);
    expect(names(getCompactPluginGroups(prefs, owners).dock)).toEqual(["plugin-3", "plugin-4", "plugin-5", "plugin-6", "plugin-7"]);
    expect(getCompactPluginGroups(prefs, owners).more).toEqual([]);
    expect(moveCompactPlugin(prefs, owners, "local:plugin-1", "bottom")).toBeUndefined();
  });

  it("keeps a configured limit through sync with a legacy client and rejects invalid limits", () => {
    const current = { compactDockLimit: 7, compactPlacements: { "local:plugin-1": "auto" }, updatedAt: "2026-11-06T00:00:00Z" };
    expect(normalizeExtensionPreferences(current)).toMatchObject({ compactDockLimit: 7, compactPlacements: current.compactPlacements });
    expect(mergeExtensionPreferences(current, { updatedAt: "2026-11-06T01:00:00Z" }).compactDockLimit).toBe(7);
    expect(normalizeExtensionPreferences({ compactDockLimit: 8 }).compactDockLimit).toBeUndefined();
  });
});
