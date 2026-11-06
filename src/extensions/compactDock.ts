import type { CompactPluginPlacement, ExtensionPreferences } from "./model";
import type { ExtensionSnapshot } from "./types";

export const COMPACT_DOCK_LIMITS = [4, 5, 6, 7];
export const DEFAULT_COMPACT_DOCK_LIMIT = 5;

export function getAppHeaderPlugins(snapshot: ExtensionSnapshot, includeMetrics = true) {
  const headerItems = snapshot.headerItems.filter((item) => !item.placement || item.placement === "app-header");
  const metrics = includeMetrics ? snapshot.views.find((view) => view.nativeMode === "metrics") : undefined;
  if (metrics) headerItems.push(metrics);
  const owners = new Set(headerItems.map((item) => item.owner));
  const planningOwners = new Set(snapshot.views.filter((view) => view.planningView).map((view) => view.owner));
  const launcherPlugins = Object.values(snapshot.preferences.installed).filter((item) =>
    item.manifest.kind === "plugin" && item.enabled && !snapshot.safeMode && !owners.has(item.key) && !planningOwners.has(item.key),
  );
  const launcherOwners = new Set(launcherPlugins.map((item) => item.key));
  const overflowViews = snapshot.views.filter((view) => !view.planningView && !launcherOwners.has(view.owner));
  for (const owner of launcherOwners) owners.add(owner);
  for (const view of overflowViews) owners.add(view.owner);
  return { headerItems, metrics, launcherPlugins, overflowViews, owners };
}

export function getCompactPluginGroups(preferences: ExtensionPreferences, toolbarOwners: ReadonlySet<string>) {
  const placements = preferences.compactPlacements ?? {};
  const installed = Object.values(preferences.installed)
    .filter((item) => item.manifest.kind === "plugin" && item.enabled && toolbarOwners.has(item.key))
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

export function moveCompactPlugin(preferences: ExtensionPreferences, toolbarOwners: ReadonlySet<string>, key: string, placement: CompactPluginPlacement, replaceKey?: string) {
  const plugin = preferences.installed[key];
  if (!plugin?.enabled || plugin.manifest.kind !== "plugin" || !toolbarOwners.has(key)) return;
  const placements = { ...preferences.compactPlacements };
  if (placement === "bottom") {
    const { dock, more } = getCompactPluginGroups(preferences, toolbarOwners);
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
