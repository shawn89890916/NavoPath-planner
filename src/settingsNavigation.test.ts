import { describe, expect, it } from "vitest";
import {
  SETTINGS_CATEGORIES,
  SETTINGS_PRIMARY_CATEGORIES,
  settingsPrimaryCategory,
  visibleSettingsCategories,
  SETTINGS_SEARCH_ENTRIES,
  normalizeSettingsTarget,
  searchSettings,
  settingsSearchPath,
} from "./settingsNavigation";

describe("settings navigation", () => {
  it("keeps plugin pages addressable and limits them to the plugin category", () => {
    expect(normalizeSettingsTarget({ category: "plugins", pluginPage: "official:weather:options" }).pluginPage).toBe("official:weather:options");
    expect(normalizeSettingsTarget({ category: "appearance", pluginPage: "official:weather:options" }).pluginPage).toBeUndefined();
    expect(searchSettings("Beta", "en")[0].target.anchor).toBe("beta-updates");
    expect(searchSettings("Beta", "en", false)).toEqual([]);
  });
  it("routes updates and existing update links to General", () => {
    for (const anchor of ["updates", "beta-updates"]) {
      expect(normalizeSettingsTarget({ category: "account-data", anchor })).toEqual({ category: "general", anchor });
      expect(SETTINGS_SEARCH_ENTRIES.find(entry => entry.id === anchor)?.target).toEqual({ category: "general", anchor });
    }
  });
  it("exposes the requested top-level categories", () => {
    expect(SETTINGS_CATEGORIES.map((category) => category.id)).toEqual([
      "general",
      "appearance",
      "workflow",
      "ai",
      "widget",
      "plugins",
      "integrations",
      "account-data",
    ]);
  });

  it("restores clear primary categories while retaining legacy destinations", () => {
    expect(SETTINGS_PRIMARY_CATEGORIES.map(c => c.id)).toEqual(["general", "appearance", "workflow", "plugins", "integrations", "account-data"]);
    expect(settingsPrimaryCategory("widget")).toBe("widget");
    expect(visibleSettingsCategories(false).some(c => c.id === "widget")).toBe(false);
    expect(settingsPrimaryCategory("integrations")).toBe("integrations");
    expect(normalizeSettingsTarget({ category: "general", anchor: "day-start" })).toEqual({ category: "workflow", anchor: "day-start" });
    expect(normalizeSettingsTarget({ category: "account-data", anchor: "auto-launch" })).toEqual({ category: "general", anchor: "auto-launch" });
    expect(normalizeSettingsTarget("metrics")).toEqual({ category: "plugins", anchor: "metrics" });
    expect(normalizeSettingsTarget({ category: "workflow", anchor: "metrics" })).toEqual({ category: "plugins", anchor: "metrics" });
  });

  it("maps every legacy destination to a reachable target", () => {
    expect(normalizeSettingsTarget("ai")).toEqual({ category: "plugins", pluginOwner: "official:navo-ai" });
    expect(normalizeSettingsTarget({ category: "widget", anchor: "widget-dark" })).toEqual({ category: "plugins", pluginOwner: "official:desktop-widget", anchor: "widget-dark" });
    expect(normalizeSettingsTarget("execution")).toEqual({ category: "workflow", anchor: "execution-defaults" });
    expect(normalizeSettingsTarget("templates")).toEqual({ category: "workflow", anchor: "templates" });
    expect(normalizeSettingsTarget("account")).toEqual({ category: "account-data", anchor: "account" });
    expect(normalizeSettingsTarget("plugins")).toEqual({ category: "plugins", anchor: "plugins" });
    expect(normalizeSettingsTarget({ category: "integrations", anchor: "plugins" })).toEqual({ category: "plugins", anchor: "plugins" });
    expect(normalizeSettingsTarget("mcp")).toEqual({ category: "integrations", anchor: "mcp" });
    expect(normalizeSettingsTarget("page")).toEqual({ category: "general" });
    expect(normalizeSettingsTarget("features")).toEqual({ category: "workflow", anchor: "planning-views" });
  });

  it("falls back safely for an invalid object target", () => {
    expect(normalizeSettingsTarget({ category: "missing" } as never)).toEqual({ category: "general" });
  });

  it("searches across Chinese, English, and keywords", () => {
    expect(searchSettings("点缀色", "zh")[0].id).toBe("accent-colors");
    expect(searchSettings("desktop opacity", "en")[0].id).toBe("desktop-widget");
    expect(searchSettings("排程", "zh").map((item) => item.id)).toContain("schedule-buffer");
    expect(searchSettings("深色背景", "zh")[0].id).toBe("widget-dark-background");
  });

  it("returns advanced details with a complete breadcrumb", () => {
    const result = searchSettings("dark appearance", "en")[0];
    expect(result.target).toEqual({ category: "plugins", pluginOwner: "official:desktop-widget", anchor: "widget-dark" });
    expect(settingsSearchPath(result, "en")).toBe("Plugins › Widget dark appearance");
  });

  it("keeps desktop settings out of web search results", () => {
    expect(searchSettings("desktop opacity", "en", false)).toEqual([]);
  });

  it("filters registered modifications before applying search limits", () => {
    const ids = new Set(["corner-radius", "schedule-buffer"]);
    expect(searchSettings("", "en", true, ids).map(x => x.id).sort()).toEqual(["corner-radius", "schedule-buffer"]);
    expect(searchSettings("radius", "en", true, ids).map(x => x.id)).toEqual(["corner-radius"]);
    expect(searchSettings("language", "en", true, ids)).toEqual([]);
  });

  it("keeps search ids unique", () => {
    const ids = SETTINGS_SEARCH_ENTRIES.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("does not expose Focus Mode as a settings destination", () => {
    expect(SETTINGS_SEARCH_ENTRIES.some((entry) => entry.id === "focus-mode")).toBe(false);
    expect(searchSettings("focus mode", "en")).toEqual([]);
  });
});
