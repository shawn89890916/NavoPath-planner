import { describe, expect, it } from "vitest";
import { getDefaultSettings } from "./defaultSettings";
import { getModifiedPreferences, resetRegisteredPreferences, SETTINGS_REGISTRY } from "./settingsRegistry";

describe("settings registry", () => {
  it("does not report canonical defaults as modified", () => {
    expect(getModifiedPreferences(getDefaultSettings())).toEqual([]);
  });
  it("detects modified preferences and resets only the selected keys", () => {
    const settings = { ...getDefaultSettings(), workspaceCornerRadius: 48, scheduleBufferMinutes: 15, apiKeyPreview: "private", displayName: "Test" };
    const modified = getModifiedPreferences(settings);
    expect(modified.map(pref => pref.search.id).sort()).toEqual(["corner-radius", "schedule-buffer"]);
    expect(resetRegisteredPreferences(modified)).toEqual({ workspaceCornerRadius: 32, scheduleBufferMinutes: 5 });
    expect(resetRegisteredPreferences(modified.filter(pref => pref.search.id === "corner-radius"))).toEqual({ workspaceCornerRadius: 32 });
  });
  it("preserves system mode as a deliberate customization and resets both theme fields", () => {
    const modified = getModifiedPreferences({ ...getDefaultSettings(), baseMode: "system", theme: "dark" });
    expect(modified.map(pref => pref.search.id)).toEqual(["theme"]);
    expect(resetRegisteredPreferences(modified)).toEqual({ baseMode: "light", theme: "light" });
  });
  it("excludes device controls, secrets and operational fields", () => {
    const all = resetRegisteredPreferences(SETTINGS_REGISTRY);
    for (const key of ["acceptBetaUpdates", "hasApiKey", "apiKeyPreview", "extensionConfigs", "extensionMcpAccess", "lastSyncedAt", "widgetAlwaysOnTop", "displayName"]) {
      expect(all).not.toHaveProperty(key);
    }
  });
});
