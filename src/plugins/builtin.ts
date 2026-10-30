/**
 * Built-in NavoPath plugins.
 *
 * These ship with the app so the marketplace is never empty, and they exercise
 * every part of the plugin contract (config fields, lifecycle hooks, host API).
 */

import {
  type NavoPlugin,
  type PluginHost,
  activate,
  register,
  resolveConfig,
} from "./registry";

/** Pomodoro Timer — tracks work/break intervals against the focused task. */
const pomodoroPlugin: NavoPlugin = {
  id: "pomodoro",
  name: "Pomodoro Timer",
  nameI18n: { zh: "番茄钟", en: "Pomodoro Timer" },
  description:
    "Run 25/5 focus cycles with desktop notifications. The timer is local-only — no network calls.",
  descriptionI18n: {
    zh: "在本地运行专注与休息计时循环，无需网络连接。帮助聚焦并推进当前时间轴任务。",
    en: "Runs local focus and break intervals without external network calls. Helps you focus on scheduled timeline tasks.",
  },
  enabledSummaryI18n: {
    zh: "启用后，底部工具栏将提供开始、暂停和重置番茄钟的操作面板。",
    en: "Enables a dedicated bottom toolbar panel to start, pause, and reset focus sessions.",
  },
  version: "1.0.0",
  author: "NavoPath Team",
  icon: "P",
  permissions: ["tasks", "ui"],
  configFields: [
    { key: "focusMinutes", label: "Focus Duration (minutes)", labelI18n: { zh: "专注时长（分钟）", en: "Focus Duration (minutes)" }, type: "number", min: 5, max: 90, default: 25 },
    { key: "breakMinutes", label: "Break Duration (minutes)", labelI18n: { zh: "休息时长（分钟）", en: "Break Duration (minutes)" }, type: "number", min: 1, max: 30, default: 5 },
    {
      key: "autoStartBreak",
      label: "Automatically start break when focus ends",
      labelI18n: { zh: "专注结束后自动开始休息", en: "Automatically start break when focus ends" },
      type: "boolean",
      default: true,
    },
  ],
  onActivate: (host: PluginHost, config) => {
    const focus = Number(config.focusMinutes) || 25;
    host.toast(`Pomodoro ready: ${focus} min focus cycle.`);
  },
  onDeactivate: (host) => {
    host.toast("Pomodoro stopped.");
  },
};

/** Habit Tracker — surfaces a simple daily-checkin panel. */
const habitTrackerPlugin: NavoPlugin = {
  id: "habit-tracker",
  name: "Habit Tracker",
  nameI18n: { zh: "习惯追踪", en: "Habit Tracker" },
  description:
    "Mark daily habits done and keep a local streak counter. Habits are stored in plugin config.",
  descriptionI18n: {
    zh: "在 NavoPath 内记录每日习惯打卡情况，打卡记录与习惯清单均安全保存在本地。",
    en: "Track daily habits inside NavoPath, storing your checklist and completions locally.",
  },
  enabledSummaryI18n: {
    zh: "启用后显示今日习惯列表；可在设置中按行配置习惯项。",
    en: "Displays a daily habit checklist; configure items one per line in settings.",
  },
  version: "1.2.0",
  author: "Community",
  icon: "H",
  permissions: ["tasks", "settings"],
  configFields: [
    { key: "habits", label: "Habit List (one item per line)", labelI18n: { zh: "习惯清单（每行一项）", en: "Habit List (one item per line)" }, type: "string", default: "" },
    {
      key: "reminderHour",
      label: "Daily Reminder Hour",
      labelI18n: { zh: "每日提醒时间（小时）", en: "Daily Reminder Hour" },
      type: "number",
      min: 0,
      max: 23,
      default: 9,
    },
  ],
  onActivate: (host) => {
    host.toast("Habit Tracker active.");
  },
};

/** Weather Info — placeholder that demonstrates config + events. */
const weatherPlugin: NavoPlugin = {
  id: "weather",
  name: "Weather Preview",
  nameI18n: { zh: "天气预览", en: "Weather Preview" },
  description:
    "Display a small weather badge. The default city can be customised; no API key is required for the placeholder badge.",
  descriptionI18n: {
    zh: "在界面角标展示本地天气信息。城市与温度单位支持自定义，无需配置第三方 API 密钥。",
    en: "Displays a local weather badge. City and units are customizable without external API keys.",
  },
  enabledSummaryI18n: {
    zh: "启用后展示包含城市、气温与天气状态的本地预览角标。",
    en: "Shows a subtle status badge with city name, temperature, and weather conditions.",
  },
  version: "0.9.0",
  author: "NavoPath Team",
  icon: "W",
  permissions: ["ui"],
  configFields: [
    { key: "city", label: "City", labelI18n: { zh: "所在城市", en: "City" }, type: "string", default: "Shanghai" },
    {
      key: "units",
      label: "Temperature Unit",
      labelI18n: { zh: "温度单位", en: "Temperature Unit" },
      type: "select",
      options: [
        { value: "c", label: "Celsius (°C)", labelI18n: { zh: "摄氏度 (°C)", en: "Celsius (°C)" } },
        { value: "f", label: "Fahrenheit (°F)", labelI18n: { zh: "华氏度 (°F)", en: "Fahrenheit (°F)" } },
      ],
      default: "c",
    },
  ],
  onActivate: (host, config) => {
    host.toast(`Weather badge: ${config.city}`);
  },
};

/** Notes Enhanced — enables a richer notes editor for tasks. */
const notesPlugin: NavoPlugin = {
  id: "notes",
  name: "Task Notes Enhanced",
  nameI18n: { zh: "任务增强笔记", en: "Task Notes Enhanced" },
  description:
    "Attach a markdown-capable note panel to each task. Notes are stored with the task's own `notes` field.",
  descriptionI18n: {
    zh: "为任务提供快速笔记编辑面板，文字内容直接关联并写入任务本身的 notes 字段。",
    en: "Provides an inline note-taking panel that writes directly into each task's notes field.",
  },
  enabledSummaryI18n: {
    zh: "启用后可在工具区快捷选择任务并实时查看与编辑其笔记。",
    en: "Enables quick task selection to review and edit associated notes directly.",
  },
  version: "2.1.0",
  author: "Community",
  icon: "N",
  permissions: ["tasks", "ui"],
  configFields: [
    {
      key: "enableMarkdown",
      label: "Enable Markdown preview",
      labelI18n: { zh: "启用 Markdown 格式预览", en: "Enable Markdown preview" },
      type: "boolean",
      default: true,
    },
    {
      key: "autoSave",
      label: "Auto-save Interval (ms)",
      labelI18n: { zh: "自动保存延迟（毫秒）", en: "Auto-save Interval (ms)" },
      type: "number",
      min: 200,
      max: 5000,
      default: 800,
    },
  ],
  onActivate: (host) => {
    host.toast("Notes Enhanced loaded.");
  },
};

const BUILTIN_PLUGINS: NavoPlugin[] = [
  pomodoroPlugin,
  habitTrackerPlugin,
  weatherPlugin,
  notesPlugin,
];

let registered = false;

/** Register every built-in plugin with the global registry. Idempotent. */
export function registerBuiltinPlugins(): void {
  if (registered) return;
  registered = true;
  for (const plugin of BUILTIN_PLUGINS) {
    register(plugin);
  }
}

export { BUILTIN_PLUGINS };

/** Convenience helper used by tests and the host bootstrap. */
export function bootstrapPlugins(
  enabledIds: string[] | undefined,
  host: PluginHost,
  configs: Record<string, Record<string, unknown>> | undefined,
): { activated: string[]; failed: string[] } {
  registerBuiltinPlugins();
  const activated: string[] = [];
  const failed: string[] = [];
  for (const id of enabledIds ?? []) {
    const plugin = BUILTIN_PLUGINS.find((p) => p.id === id);
    if (!plugin) {
      failed.push(id);
      continue;
    }
    const ok = activate(id, host, resolveConfig(plugin, configs?.[id]));
    if (ok) activated.push(id);
    else failed.push(id);
  }
  return { activated, failed };
}
