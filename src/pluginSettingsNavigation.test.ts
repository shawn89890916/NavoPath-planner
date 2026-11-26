import { describe, expect, it } from "vitest";
import { pluginSettingsDestinations, pluginSettingsOwner, searchPluginSettings } from "./pluginSettingsNavigation";
import { normalizeSettingsTarget } from "./settingsNavigation";
import type { ExtensionSnapshot, InstalledExtension } from "./extensions/types";
const item = (id: string, enabled = true, configurable = false): InstalledExtension => ({
  key: "official:" + id, sourceId: "official", enabled, sha256: "a".repeat(64), installedAt: "2026-11-26",
  manifest: { id, name: id, kind: "plugin", version: "1.0.0", description: "", author: "", apiVersion: 1, minAppVersion: "1.0.0", platforms: ["web"], ...(configurable ? { settingsOptions: [{ key: "duration", label: "Duration", type: "number", default: 25 }] } : {}) },
});
function snapshot(): ExtensionSnapshot {
  const items = [item("metrics"), item("timer", true, true), item("disabled", false, true), item("plain"), item("custom")];
  return { preferences: { version: 1, sources: [], installed: Object.fromEntries(items.map(entry => [entry.key, entry])), removed: {}, activeTheme: null, autoCheckUpdates: true, autoUpdate: false }, catalog: [], updates: {}, status: {}, busy: false, error: "", safeMode: false, settingsPages: [{ id: "custom:one", owner: "official:custom", name: "Options", mount: () => {} }, { id: "custom:two", owner: "official:custom", name: "Advanced", mount: () => {} }], views: [], launcherStatus: {} };
}
describe("plugin settings destinations", () => {
  it("includes one destination per enabled configurable owner with stable sorting", () => {
    const state = snapshot();
    const list = pluginSettingsDestinations(state);
    expect(list.map(x => x.owner)).toEqual(["official:custom", "official:metrics", "official:timer"]);
    expect(list[0].pages).toHaveLength(2);
    state.preferences.installed["official:timer"].manifest.name = "Renamed";
    expect(pluginSettingsDestinations(state).map(x => x.owner)).toEqual(list.map(x => x.owner));
  });
  it("retains an updating owner without stale mounts, hides disabled and uninstalled owners", () => {
    const state = snapshot(), prior = pluginSettingsDestinations(state);
    state.settingsPages = []; state.busy = true;
    expect(pluginSettingsDestinations(state, prior).find(x => x.owner === "official:custom")?.pages).toEqual([]);
    state.preferences.installed["official:custom"].enabled = false;
    expect(pluginSettingsDestinations(state, prior).some(x => x.owner === "official:custom")).toBe(false);
    delete state.preferences.installed["official:timer"];
    expect(pluginSettingsDestinations(state, prior).some(x => x.owner === "official:timer")).toBe(false);
  });
  it("resolves existing links and searches individual declared options", () => {
    const state = snapshot();
    expect(pluginSettingsOwner(normalizeSettingsTarget("metrics"), state)).toBe("official:metrics");
    expect(pluginSettingsOwner(normalizeSettingsTarget({category:"plugins",pluginPage:"custom:two"}), state)).toBe("official:custom");
    const result = searchPluginSettings(pluginSettingsDestinations(state), "timer duration")[0];
    expect(normalizeSettingsTarget(result.target)).toMatchObject({ category: "plugins", pluginOwner: "official:timer", anchor: "plugin-option-duration" });
  });
});
