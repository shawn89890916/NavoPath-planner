import type { CompactPluginPlacement, ExtensionPreferences } from "./model";

export const COMPACT_DOCK_LIMITS = [4, 5, 6, 7];
export const DEFAULT_COMPACT_DOCK_LIMIT = 5;

export function getCompactPluginGroups(preferences: ExtensionPreferences) {
  const placements = preferences.compactPlacements ?? {};
  const installed = Object.values(preferences.installed)
    .filter((item) => item.manifest.kind === "plugin" && item.enabled)
    .sort((a, b) => (Date.parse(a.installedAt) || 0) - (Date.parse(b.installedAt) || 0));
  const pinned = installed.filter((item) => placements[item.key] === "bottom");
  const automatic = installed.filter((item) => !placements[item.key] || placements[item.key] === "auto");
  const limit = preferences.compactDockLimit ?? DEFAULT_COMPACT_DOCK_LIMIT;
  const dockKeys = new Set([...pinned, ...automatic].slice(0, limit).map((item) => item.key));
  return {
    dock: installed.filter((item) => dockKeys.has(item.key)),
    more: installed.filter((item) => !dockKeys.has(item.key) && placements[item.key] !== "settings"),
  };
}

export function moveCompactPlugin(preferences: ExtensionPreferences, key: string, placement: CompactPluginPlacement, replaceKey?: string) {
  const plugin = preferences.installed[key];
  if (!plugin?.enabled || plugin.manifest.kind !== "plugin") return;
  const placements = { ...preferences.compactPlacements };
  if (placement === "bottom") {
    const { dock, more } = getCompactPluginGroups(preferences);
    const limit = preferences.compactDockLimit ?? DEFAULT_COMPACT_DOCK_LIMIT;
    if (!dock.some((item) => item.key === key) && dock.length === limit) {
      const replaced = dock.find((item) => item.key === replaceKey) ?? dock.at(-1);
      // Keep the other visible shortcuts when replacing a slot, including ones filled automatically.
      for (const item of dock) placements[item.key] = item === replaced ? "more" : "bottom";
      for (const item of more) if (placements[item.key] === "bottom") placements[item.key] = "more";
    }
  }
  return { ...placements, [key]: placement };
}
