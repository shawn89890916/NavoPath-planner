import { describe, expect, it } from "vitest";
import {
  SETTINGS_CATEGORIES,
  SETTINGS_SEARCH_ENTRIES,
  normalizeSettingsTarget,
  searchSettings,
  settingsSearchPath,
} from "./settingsNavigation";

describe("settings navigation", () => {
  it("exposes the requested top-level categories", () => {
    expect(SETTINGS_CATEGORIES.map((category) => category.id)).toEqual([
      "general",
      "appearance",
      "workflow",
      "account-data",
      "ai",
      "widget",
      "integrations",
    ]);
  });

  it("maps every legacy destination to a reachable target", () => {
    expect(normalizeSettingsTarget("execution")).toEqual({ category: "general", anchor: "execution-defaults" });
    expect(normalizeSettingsTarget("templates")).toEqual({ category: "workflow", anchor: "templates" });
    expect(normalizeSettingsTarget("account")).toEqual({ category: "account-data", anchor: "account" });
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
    expect(result.target).toEqual({ category: "widget", anchor: "widget-dark" });
    expect(settingsSearchPath(result, "en")).toBe("Desktop Windows › Widget dark appearance");
  });

  it("keeps desktop settings out of web search results", () => {
    expect(searchSettings("desktop opacity", "en", false)).toEqual([]);
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
