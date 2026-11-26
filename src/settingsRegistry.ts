import type { Language, Settings } from "./types";
import { getDefaultSettings } from "./defaultSettings";
import { SETTINGS_SEARCH_ENTRIES, type SettingsSearchEntry } from "./settingsNavigation";

type PreferenceLevel = "basic" | "advanced";
type PreferenceScope = "account" | "device" | "workspace";
export interface RegisteredPreference {
  search: SettingsSearchEntry;
  level: PreferenceLevel;
  scope: PreferenceScope;
  defaultPatch: Partial<Settings>;
}

// Only directly editable, safely resettable preferences are registered here.
// Native device controls and credential/configuration secrets have separate owners.
const definitions = [
  ["language", "language", "basic"],
  ["notification-badge", "showInAppNotificationBadge", "basic"],
  ["typography", "typographyStyle", "basic"],
  ["corner-radius", "workspaceCornerRadius", "basic"],
  ["timeline-font", "timelineFontScale", "advanced"],
  ["default-timeline", "defaultTimelineView", "basic"],
  ["hide-completed", "hideCompleted", "basic"],
  ["day-start", "dayStartTime", "advanced"],
  ["continuous-scroll", "continuousCrossDayScroll", "advanced"],
  ["schedule-start", "scheduleDayStartTime", "basic"],
  ["schedule-end", "dayEndTime", "basic"],
  ["schedule-buffer", "scheduleBufferMinutes", "advanced"],
  ["habits", "featureHabitsEnabled", "advanced"],
  ["habit-candidates", "featureHabitCandidatesEnabled", "advanced"],
  ["engagement", "featureEngagementEnabled", "advanced"],
  ["metrics-range", "metricsRangePreset", "advanced"],
  ["metrics-group", "metricsGroupBy", "advanced"],
  ["metrics-display", "metricsDisplayMetric", "advanced"],
  ["metrics-habits", "metricsIncludeHabits", "advanced"],
  ["metrics-completion", "metricsCompletionFilter", "advanced"],
  ["ai-estimate", "autoEstimateTaskDuration", "basic"],
  ["ai-project", "autoAssignTaskProject", "basic"],
  ["ai-memory", "aiMemoryEnabled", "basic"],
  ["hide-ai", "hideAi", "basic"],
  ["ai-reasoning", "reasoningMode", "advanced"],
] as const satisfies readonly (readonly [string, keyof Settings, PreferenceLevel])[];

const defaults = getDefaultSettings();
function searchFor(id: string): SettingsSearchEntry {
  const entry = SETTINGS_SEARCH_ENTRIES.find(item => item.id === id);
  if (!entry) throw new Error("Missing settings search entry: " + id);
  return entry;
}

export const SETTINGS_REGISTRY: readonly RegisteredPreference[] = [
  ...definitions.map(([id, key, level]) => ({
    search: searchFor(id),
    level,
    scope: "account" as const,
    defaultPatch: { [key]: key === "timelineFontScale" ? 1 : defaults[key] } as Partial<Settings>,
  })),
  { search: searchFor("theme"), level: "basic", scope: "account", defaultPatch: { baseMode: defaults.theme, theme: defaults.theme } },
  { search: searchFor("accent-colors"), level: "basic", scope: "account", defaultPatch: { executeAccentColor: defaults.executeAccentColor, planningAccentColor: defaults.planningAccentColor } },
];

export function getModifiedPreferences(settings: Settings): RegisteredPreference[] {
  return SETTINGS_REGISTRY.filter(pref => Object.entries(pref.defaultPatch).some(([rawKey, fallback]) => {
    const key = rawKey as keyof Settings;
    const actual = key === "baseMode" ? settings.baseMode || settings.theme : settings[key] ?? fallback;
    // For system mode, baseMode captures the choice; effective theme may change automatically.
    if (key === "theme" && settings.baseMode === "system") return false;
    return !Object.is(actual, fallback);
  }));
}

export function resetRegisteredPreferences(prefs: readonly RegisteredPreference[]): Partial<Settings> {
  // Only registered descriptors may contribute patches, even if called by a future UI.
  const ids = new Set(prefs.map(pref => pref.search.id));
  return Object.assign({}, ...SETTINGS_REGISTRY.filter(pref => ids.has(pref.search.id)).map(pref => pref.defaultPatch));
}

/** Read only registered, non-secret preferences for search and session undo. */
export function registeredPreferenceValue(pref: RegisteredPreference, settings: Settings, lang: Language): string {
  const keys = Object.keys(pref.defaultPatch) as (keyof Settings)[];
  const key = keys[0];
  const value = key === "baseMode" ? settings.baseMode || settings.theme : settings[key] ?? pref.defaultPatch[key];
  const zh = lang === "zh";
  if (pref.search.id === "accent-colors") {
    const colors = [settings.executeAccentColor, settings.planningAccentColor].filter(Boolean);
    return [...new Set(colors)].join(" / ") || (zh ? "默认" : "Default");
  }
  if (typeof value === "boolean") return value ? (zh ? "开启" : "On") : (zh ? "关闭" : "Off");
  if (pref.search.id === "corner-radius") return String(value) + " px";
  if (pref.search.id === "timeline-font") return Math.round(Number(value) * 100) + "%";
  if (pref.search.id === "schedule-buffer") return String(value) + (zh ? " 分钟" : " min");
  const names: Record<string, [string, string]> = {
    zh: ["中文", "Chinese"], en: ["英语", "English"],
    light: ["浅色", "Light"], dark: ["深色", "Dark"], system: ["跟随系统", "System"],
    editorial: ["编辑衬线", "Editorial Serif"], balanced: ["平衡混排", "Balanced"], sans: ["现代无衬线", "Modern Sans"],
    daily: ["单日", "Day"], "3day": ["三日", "3 days"], weekly: ["周", "Week"], month: ["月", "Month"],
    today: ["今天", "Today"], thisWeek: ["本周", "This week"], thisMonth: ["本月", "This month"], all: ["全部", "All"],
    project: ["项目", "Project"], customCategory: ["自定义分类", "Custom category"], tag: ["标签", "Tag"], importance: ["重要程度", "Importance"], urgency: ["紧急程度", "Urgency"],
    percentage: ["占比", "Percentage"], duration: ["时长", "Duration"], taskCount: ["任务数", "Task count"], completionRate: ["完成率", "Completion rate"],
    include: ["计入", "Include"], exclude: ["排除", "Exclude"], only: ["仅习惯", "Habits only"],
    completed: ["已完成", "Completed"], incomplete: ["未完成", "Incomplete"], instant: ["即时", "Instant"], high: ["High", "High"], xhigh: ["Xhigh", "Xhigh"],
  };
  return names[String(value)]?.[zh ? 0 : 1] ?? String(value ?? (zh ? "默认" : "Default"));
}

export interface PreferenceUndo { before: Partial<Settings>; after: Partial<Settings>; at: number }
const registeredKeys = new Set(SETTINGS_REGISTRY.flatMap(pref => Object.keys(pref.defaultPatch)));
export function recordPreferenceUndo(history: readonly PreferenceUndo[], settings: Settings, patch: Partial<Settings>, at: number): PreferenceUndo[] {
  const keys = Object.keys(patch) as (keyof Settings)[];
  if (!keys.length || keys.some(key => !registeredKeys.has(key))) return [...history];
  const before = Object.fromEntries(keys.map(key => [key, settings[key] ?? SETTINGS_REGISTRY.find(pref => key in pref.defaultPatch)?.defaultPatch[key]])) as Partial<Settings>;
  if (keys.every(key => Object.is(before[key], patch[key]))) return [...history];
  const last = history.at(-1);
  if (last && at - last.at < 600 && keys.length === Object.keys(last.after).length && keys.every(key => key in last.after)) {
    return [...history.slice(0, -1), { before: last.before, after: patch, at }];
  }
  return [...history.slice(-19), { before, after: patch, at }];
}
export function canUndoPreference(entry: PreferenceUndo | undefined, settings: Settings): boolean {
  return Boolean(entry && (Object.keys(entry.after) as (keyof Settings)[]).every(key => Object.is(settings[key], entry.after[key])));
}
