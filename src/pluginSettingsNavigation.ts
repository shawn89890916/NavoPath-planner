import type { ExtensionSnapshot, ExtensionContribution, PluginSettingOption, InstalledExtension } from "./extensions/types";
import type { SettingsTarget } from "./settingsNavigation";

export const METRICS_SETTINGS_OWNER = "official:metrics";
export interface PluginSettingsDestination {
  owner: string;
  title: string;
  native: boolean;
  options: readonly PluginSettingOption[];
  pages: readonly ExtensionContribution[];
}
export function pluginSettingsPages(snapshot: ExtensionSnapshot, item: InstalledExtension): ExtensionContribution[] {
  const exact = snapshot.settingsPages.filter(page => page.owner === item.key);
  const sameId = Object.values(snapshot.preferences.installed).filter(candidate => candidate.manifest.id === item.manifest.id);
  const pages = exact.length ? exact : sameId.length === 1 ? snapshot.settingsPages.filter(page => page.owner === item.manifest.id) : [];
  return Array.from(new Map(pages.map(page => [page.name.trim().toLocaleLowerCase(), page])).values());
}
export function pluginSettingsDestinations(snapshot: ExtensionSnapshot, previous: readonly PluginSettingsDestination[] = []): PluginSettingsDestination[] {
  return Object.values(snapshot.preferences.installed).filter(item => item.manifest.kind === "plugin" && item.enabled)
    .sort((a,b) => a.key.localeCompare(b.key, "en"))
    .flatMap<PluginSettingsDestination>(item => {
      const native = item.key === METRICS_SETTINGS_OWNER || ["official:habits", "official:navo-ai", "official:desktop-widget"].includes(item.key);
      const options = item.manifest.settingsOptions ?? [];
      const pages = pluginSettingsPages(snapshot, item);
      if (!native && !options.length && !pages.length) {
        const prior = previous.find(entry => entry.owner === item.key);
        // Retain the destination, never a stale mount callback, during a reload.
        return (snapshot.busy || snapshot.updateBatch?.running) && prior ? [{ ...prior, pages: [] }] : [];
      }
      return [{ owner: item.key, title: item.manifest.name, native, options, pages }];
    });
}
export function pluginSettingsOwner(target: SettingsTarget, snapshot: ExtensionSnapshot): string | undefined {
  if (target.category !== "plugins") return undefined;
  if (target.pluginOwner) return target.pluginOwner;
  if (target.anchor === "metrics" || target.anchor?.startsWith("metrics-")) return METRICS_SETTINGS_OWNER;
  if (!target.pluginPage) return undefined;
  return Object.values(snapshot.preferences.installed).find(item => pluginSettingsPages(snapshot, item).some(page => page.id === target.pluginPage))?.key;
}
export function pluginOptionAnchor(key: string): string { return "plugin-option-" + key; }
export function pluginPageAnchor(id: string): string { return "plugin-page-" + id; }
export function searchPluginSettings(destinations: readonly PluginSettingsDestination[], query: string) {
  const tokens = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  const matches = (...words: string[]) => tokens.every(token => words.join(" ").toLocaleLowerCase().includes(token));
  return destinations.flatMap(destination => {
    const base: SettingsTarget = { category: "plugins", pluginOwner: destination.owner };
    return [
      ...(matches(destination.title) ? [{ id: destination.owner, title: destination.title, ownerTitle: destination.title, target: base }] : []),
      ...destination.options.filter(option => matches(destination.title, option.label, option.key, option.description ?? "")).map(option => ({ id: destination.owner + ":" + option.key, title: option.label, ownerTitle: destination.title, target: { ...base, anchor: pluginOptionAnchor(option.key) } })),
      ...destination.pages.filter(page => matches(destination.title, page.name)).map(page => ({ id: page.id, title: page.name, ownerTitle: destination.title, target: { ...base, pluginPage: page.id, anchor: pluginPageAnchor(page.id) } })),
    ];
  }).slice(0, 24);
}
