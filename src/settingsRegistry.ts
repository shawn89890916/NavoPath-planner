import type { Settings } from "./types";
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
