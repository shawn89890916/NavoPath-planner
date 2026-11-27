import type { ExtensionManifest } from "./model";

export type PluginTier = "official" | "community";
type PluginIdentity = { sourceId: string; manifest: Pick<ExtensionManifest, "id" | "kind"> };
// Source identity and curated membership are independent of author metadata.
// Preserve historical official:<id> storage keys, including community packages.
const officialIds = new Set(["habits", "metrics", "navo-ai", "desktop-widget"]);
export function pluginTier(item: PluginIdentity): PluginTier {
  return item.sourceId === "official" && item.manifest.kind === "plugin" && officialIds.has(item.manifest.id) ? "official" : "community";
}
export function groupPluginTiers<T extends PluginIdentity>(items: readonly T[]): { tier: PluginTier; items: T[] }[] {
  return (["official", "community"] as const).map(tier => ({ tier, items: items.filter(item => pluginTier(item) === tier) })).filter(group => group.items.length > 0);
}
