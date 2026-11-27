import type { Language } from "./types";

export type SettingsCategory = "general" | "appearance" | "workflow" | "account-data" | "ai" | "widget" | "integrations" | "plugins" | "advanced";
export type SettingsDetail = "ai" | "widget" | "integrations" | "recovery";

export type LegacySettingsSection =
  | "general"
  | "appearance"
  | "execution"
  | "planning"
  | "templates"
  | "habits"
  | "metrics"
  | "widget"
  | "data"
  | "shortcuts"
  | "ai"
  | "mcp"
  | "calendar"
  | "plugins"
  | "account"
  | "advanced"
  | "page"
  | "features";

export interface SettingsTarget {
  category: SettingsCategory;
  detail?: SettingsDetail;
  anchor?: string;
  pluginPage?: string;
  pluginOwner?: string;
}

export type SettingsTargetInput = SettingsTarget | LegacySettingsSection | undefined;

export interface SettingsCategoryDefinition {
  id: SettingsCategory;
  labelZh: string;
  labelEn: string;
}

export const SETTINGS_CATEGORIES: readonly SettingsCategoryDefinition[] = [
  { id: "general", labelZh: "通用", labelEn: "General" },
  { id: "appearance", labelZh: "外观", labelEn: "Appearance" },
  { id: "workflow", labelZh: "工作流", labelEn: "Workflow" },
  { id: "ai", labelZh: "Navo AI", labelEn: "Navo AI" },
  { id: "widget", labelZh: "桌面窗口", labelEn: "Desktop Windows" },
  { id: "plugins", labelZh: "插件", labelEn: "Plugins" },
  { id: "integrations", labelZh: "连接", labelEn: "Connections" },
  { id: "account-data", labelZh: "账户与数据", labelEn: "Account & Data" },
];

/** Retain stable category IDs; desktop-only destinations are filtered by capability. */
export const SETTINGS_PRIMARY_CATEGORIES = SETTINGS_CATEGORIES.filter(category => category.id !== "ai" && category.id !== "widget");
export function settingsPrimaryCategory(category: SettingsCategory): SettingsCategory { return category; }
export function visibleSettingsCategories(desktopAvailable: boolean): readonly SettingsCategoryDefinition[] {
  return SETTINGS_PRIMARY_CATEGORIES.filter(category => desktopAvailable || category.id !== "widget");
}

const legacyTargets: Record<LegacySettingsSection, SettingsTarget> = {
  general: { category: "general" },
  appearance: { category: "appearance" },
  execution: { category: "workflow", anchor: "execution-defaults" },
  planning: { category: "workflow", anchor: "planning-views" },
  templates: { category: "workflow", anchor: "templates" },
  habits: { category: "plugins", anchor: "habits", pluginOwner: "official:habits" },
  metrics: { category: "plugins", anchor: "metrics" },
  widget: { category: "general", anchor: "portrait-window" },
  data: { category: "account-data", anchor: "data-backup" },
  shortcuts: { category: "general", anchor: "shortcuts" },
  ai: { category: "plugins", pluginOwner: "official:navo-ai" },
  mcp: { category: "integrations", anchor: "mcp" },
  calendar: { category: "integrations", anchor: "calendar-feed" },
  plugins: { category: "plugins", anchor: "plugins" },
  account: { category: "account-data", anchor: "account" },
  advanced: { category: "account-data", anchor: "reset-settings" },
  page: { category: "general" },
  features: { category: "workflow", anchor: "planning-views" },
};

export function normalizeSettingsTarget(input?: SettingsTargetInput): SettingsTarget {
  if (!input) return { category: "general" };
  if (typeof input === "string") return legacyTargets[input] ?? { category: "general" };
  if ((input.category as string) === "advanced") {
    if (input.detail === "ai") return normalizeSettingsTarget({ category: "ai", anchor: input.anchor });
    if (input.detail === "widget") return normalizeSettingsTarget({ category: "widget", anchor: input.anchor });
    if (input.detail === "integrations") return { category: "integrations", anchor: input.anchor };
    return { category: "account-data", anchor: input.anchor || "reset-settings" };
  }
  if (input.anchor && ["execution-defaults", "day-start", "default-timeline", "continuous-scroll", "hide-completed"].includes(input.anchor)) return { category: "workflow", anchor: input.anchor };
  if (input.anchor === "auto-launch") return { category: "general", anchor: input.anchor };
  if (input.category === "ai" || input.anchor?.startsWith("ai-") || input.anchor === "hide-ai") return { category: "plugins", pluginOwner: "official:navo-ai", ...(input.anchor && input.anchor !== "hide-ai" ? { anchor: input.anchor } : {}) };
  if (input.anchor === "desktop-widget" || input.anchor?.startsWith("widget-")) return { category: "plugins", pluginOwner: "official:desktop-widget", anchor: input.anchor };
  if (input.category === "widget" || input.anchor === "portrait-window" || input.anchor === "desktop-window-settings") return { category: "general", anchor: input.anchor || "portrait-window" };
  if (input.anchor === "habits" || input.anchor === "habits-enabled" || input.anchor === "habit-candidates") return { category: "plugins", anchor: input.anchor === "habit-candidates" ? "habit-candidates" : "habits", pluginOwner: "official:habits" };
  if (input.anchor === "engagement") return { category: "plugins", anchor: "plugin-market" };
  if (input.anchor === "metrics" || input.anchor?.startsWith("metrics-")) return { category: "plugins", anchor: input.anchor };
  if (input.anchor === "updates" || input.anchor === "beta-updates") return { category: "general", anchor: input.anchor };
  if (input.category === "integrations" && input.anchor === "plugins") return { category: "plugins", anchor: "plugins" };
  if (!SETTINGS_CATEGORIES.some((category) => category.id === input.category)) return { category: "general" };
  if (input.detail && !["ai", "widget", "integrations", "recovery"].includes(input.detail)) {
    return { category: input.category, anchor: input.anchor };
  }
  return { category: input.category, detail: input.detail, anchor: input.anchor, ...(input.category === "plugins" && input.pluginPage ? { pluginPage: input.pluginPage } : {}), ...(input.category === "plugins" && input.pluginOwner ? { pluginOwner: input.pluginOwner } : {}) };
}

export function settingsCategoryLabel(category: SettingsCategory, lang: Language): string {
  const definition = SETTINGS_PRIMARY_CATEGORIES.find(item => item.id === category) ?? SETTINGS_CATEGORIES.find(item => item.id === category) ?? SETTINGS_CATEGORIES[0];
  return lang === "zh" ? definition.labelZh : definition.labelEn;
}

export function settingsDetailLabel(detail: SettingsDetail, lang: Language): string {
  if (detail === "integrations") return lang === "zh" ? "日历与集成" : "Calendar & Integrations";
  const labels: Record<SettingsDetail, [string, string]> = {
    ai: ["Navo AI", "Navo AI"],
    widget: ["桌面窗口", "Desktop Windows"],
    integrations: ["插件与 MCP", "Plugins & MCP"],
    recovery: ["恢复与重置", "Recovery & Reset"],
  };
  return labels[detail][lang === "zh" ? 0 : 1];
}
