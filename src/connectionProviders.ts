import type { ExtensionSnapshot } from "./extensions/types";

export const CONNECTION_PROVIDERS = [
  { id: "super-productivity", anchor: "connection-super-productivity", nameZh: "Super Productivity", nameEn: "Super Productivity", descriptionZh: "任务、项目与当前排程双向同步；历史时间块只读显示。", descriptionEn: "Two-way tasks, projects and active schedules; read-only history blocks." },
  { id: "apple-calendar", anchor: "connection-apple-calendar", nameZh: "Apple 日历", nameEn: "Apple Calendar", descriptionZh: "日历事件双向同步；排程可只读订阅。", descriptionEn: "Two-way calendar events; read-only schedule subscription." },
  { id: "notion-calendar", anchor: "connection-notion-calendar", nameZh: "Notion Calendar", nameEn: "Notion Calendar", descriptionZh: "通过支持订阅的日历账户显示 NavoPath 日程。", descriptionEn: "View NavoPath schedules through a calendar account that supports subscriptions." },
  { id: "other-calendar", anchor: "calendar-feed", nameZh: "其他日历", nameEn: "Other calendars", descriptionZh: "通用只读日历订阅。", descriptionEn: "Standard read-only calendar subscription." },
] as const;

export type ConnectionProvider = typeof CONNECTION_PROVIDERS[number];
export function connectionProvider(anchor?: string): ConnectionProvider | undefined {
  return CONNECTION_PROVIDERS.find(provider => provider.anchor === anchor);
}
export function isConnectionAnchor(anchor?: string) {
  return anchor === "connections" || !!connectionProvider(anchor);
}
export const SP_PLUGIN_KEY = "official:super-productivity-sync";
export function spPluginConnection(snapshot: ExtensionSnapshot) {
  const installed = snapshot.preferences.installed[SP_PLUGIN_KEY];
  // Do not silently install or run a same-named package from an untrusted catalog.
  const catalog = snapshot.catalog.find(item => item.sourceId === "official" && item.manifest.id === "super-productivity-sync" && item.manifest.kind === "plugin");
  const page = installed?.enabled && !snapshot.safeMode
    ? snapshot.settingsPages.find(item => item.owner === SP_PLUGIN_KEY && item.name === "Super Productivity Sync")
      ?? (Object.values(snapshot.preferences.installed).filter(item => item.manifest.id === "super-productivity-sync").length === 1
        ? snapshot.settingsPages.find(item => item.owner === "super-productivity-sync" && item.name === "Super Productivity Sync") : undefined)
    : undefined;
  return { installed, catalog, page };
}
export const SP_COMPANION_URL = "https://github.com/shawn89890916/NavoPath-planner/raw/main/integrations/super-productivity-navopath/navopath-sync-1.0.6.zip";
