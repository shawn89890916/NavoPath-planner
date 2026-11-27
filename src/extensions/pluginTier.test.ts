import { describe, expect, it } from "vitest";
import { groupPluginTiers, pluginTier } from "./pluginTier";
const entry = (id: string, sourceId = "official", kind: "plugin" | "theme" = "plugin") => ({ sourceId, manifest: { id, kind, author: "NavoPath" } });
describe("curated plugin classification", () => {
  it("distinguishes the catalog source from curated membership", () => {
    for (const id of ["habits", "metrics", "navo-ai", "desktop-widget"]) expect(pluginTier(entry(id))).toBe("official");
    for (const id of ["kanban", "schedule-templates", "engagement", "super-productivity-sync"]) expect(pluginTier(entry(id))).toBe("community");
    expect(pluginTier(entry("metrics", "imported"))).toBe("community");
    expect(pluginTier(entry("metrics", "third-party"))).toBe("community");
    expect(pluginTier(entry("metrics", "official", "theme"))).toBe("community");
  });
  it("groups official first without mutating source order or showing empty groups", () => {
    const entries = [entry("kanban"), entry("metrics"), entry("schedule-templates")];
    expect(groupPluginTiers(entries)).toEqual([{ tier: "official", items: [entries[1]] }, { tier: "community", items: [entries[0], entries[2]] }]);
    expect(groupPluginTiers([entries[0]])).toEqual([{ tier: "community", items: [entries[0]] }]);
    expect(entries[0].manifest.id).toBe("kanban");
  });
});
