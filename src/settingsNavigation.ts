import type { Language } from "./types";
import { settingsCategoryLabel, settingsDetailLabel, type SettingsTarget } from "./settingsNavigationCore";
export * from "./settingsNavigationCore";

export interface SettingsSearchEntry {
  id: string;
  target: SettingsTarget;
  labelZh: string;
  labelEn: string;
  descriptionZh?: string;
  descriptionEn?: string;
  keywords?: string;
}

const entry = (
  id: string,
  target: SettingsTarget,
  labelZh: string,
  labelEn: string,
  keywords = "",
  descriptionZh = "",
  descriptionEn = "",
): SettingsSearchEntry => ({ id, target: { ...target, anchor: target.anchor ?? id }, labelZh, labelEn, keywords, descriptionZh, descriptionEn });

export const SETTINGS_SEARCH_ENTRIES: readonly SettingsSearchEntry[] = [
  entry("connections", { category: "integrations" }, "连接应用", "Connect apps", "provider 供应商 连接 integration"),
  entry("connection-super-productivity", { category: "integrations" }, "Super Productivity", "Super Productivity", "SP sync 配对 同步 历史 时间轴"),
  entry("connection-apple-calendar", { category: "integrations" }, "Apple 日历", "Apple Calendar", "CalDAV iPhone 苹果 双向"),
  entry("connection-notion-calendar", { category: "integrations" }, "Notion Calendar", "Notion Calendar", "Notion 日历 订阅"),
  entry("connection-other-calendar", { category: "integrations" }, "其他日历", "Other calendars", "calendar ics"),
  entry("connection-add", { category: "integrations" }, "添加连接", "Add connection"),
  entry("connection-advanced", { category: "integrations" }, "高级连接", "Advanced connections"),
  entry("calendar-feed", { category: "integrations" }, "共享日历订阅", "Shared calendar subscription", "webcal ics CalDAV iPhone Notion Calendar 日历 同步 订阅 双向 苹果"),
  entry("external-calendar", { category: "integrations" }, "外部日历", "External calendars", "read only ICS busy time 只读 忙碌 冲突"),
  entry("modified-settings", { category: "general" }, "已修改的设置", "Modified settings", "changed preferences reset default 恢复 默认 自定义"),
  entry("language", { category: "general" }, "语言", "Language", "中文 English locale"),
  entry("notification-badge", { category: "general" }, "应用内通知角标", "In-app notification badge", "unread count notifications badge 通知 未读 提醒 角标"),
  entry("day-start", { category: "workflow" }, "一天开始时间", "Day start time", "timeline boundary 跨天"),
  entry("default-timeline", { category: "workflow" }, "默认时间轴视图", "Default timeline view", "day 3-day week month 日 周 月"),
  entry("continuous-scroll", { category: "workflow" }, "开启无限跨天滚动", "Continuous cross-day scroll", "timeline"),
  entry("hide-completed", { category: "workflow" }, "隐藏已完成任务", "Hide completed tasks", "timeline 时间轴"),
  entry("shortcuts", { category: "general" }, "快捷键", "Shortcuts", "keyboard hotkeys help 帮助"),
  entry("restart-onboarding", { category: "general" }, "重新开始新手指南", "Restart onboarding guide", "tutorial 引导"),

  entry("theme", { category: "appearance" }, "界面模式", "Interface mode", "light dark 浅色 深色 主题"),
  entry("themes", { category: "appearance" }, "社区主题", "Community themes", "theme market import options 主题 市场 导入 选项"),
  entry("typography", { category: "appearance" }, "字体风格", "Typography", "serif sans 衬线 无衬线"),
  entry("corner-radius", { category: "appearance" }, "界面圆角", "Corner radius", "边框 弧度 round corners"),
  entry("motion-preference", { category: "appearance" }, "动效强度", "Motion intensity", "动画 减少动态 效果 animation reduce motion"),
  entry("timeline-font", { category: "appearance" }, "时间轴字体大小", "Timeline font size", "scale 字号"),
  entry("accent-colors", { category: "appearance" }, "自定义点缀色", "Customize accent colors", "execute planning color 强调色"),

  entry("planning-views", { category: "workflow" }, "规划视图", "Planning views", "kanban matrix list 看板 四象限 列表"),
  entry("schedule-start", { category: "workflow" }, "规划开始", "Planning starts", "AI schedule 排程"),
  entry("schedule-end", { category: "workflow" }, "规划结束", "Planning ends", "AI schedule 排程"),
  entry("schedule-buffer", { category: "workflow" }, "排程任务间隔", "Gap between scheduled tasks", "任务缓冲 Task buffer minutes AI schedule 间隔 排程"),
  entry("templates", { category: "workflow" }, "模板", "Templates", "schedule template 时间段"),
  entry("habits", { category: "plugins", pluginOwner: "official:habits" }, "习惯", "Habits", "candidate metrics 每日 每周"),
  entry("metrics", { category: "plugins" }, "指标", "Metrics", "range grouping completion 统计 范围 分组 完成"),
  entry("metrics-range", { category: "plugins" }, "指标时间范围", "Metrics time range", "statistics period 时间 统计"),
  entry("metrics-group", { category: "plugins" }, "指标分组", "Metrics grouping", "statistics group 统计"),
  entry("metrics-display", { category: "plugins" }, "显示指标", "Metrics display", "statistics metric duration 统计"),
  entry("metrics-habits", { category: "plugins" }, "习惯是否计入统计", "Include habits in metrics", "statistics habits 统计"),
  entry("metrics-completion", { category: "plugins" }, "指标完成状态筛选", "Metrics completion filter", "statistics filter 统计"),
  entry("habit-candidates", { category: "plugins", pluginOwner: "official:habits" }, "候选中的习惯区", "Habits in candidates", "习惯"),
  entry("engagement", { category: "plugins", anchor: "plugin-market" }, "投入度评分", "Engagement rating", "engagement effort focus density weighted 80% 投入 专注 评分 颜色 密度 时长 加权"),

  entry("account", { category: "account-data" }, "个人资料与账户", "Profile & account", "avatar name plan subscription 头像 用户名 方案"),
  entry("sync", { category: "account-data" }, "同步", "Sync", "cloud interval push pull 云端"),
  entry("updates", { category: "general" }, "应用更新", "App updates", "desktop version 桌面 版本"),
  entry("beta-updates", { category: "general" }, "接受 Beta 更新", "Accept Beta updates", "beta prerelease preview 测试 预览 更新"),
  entry("auto-launch", { category: "general" }, "开机启动", "Launch at startup", "desktop login 开机自启"),
  entry("data-backup", { category: "account-data" }, "数据与备份", "Data & Backup", "import export json csv 导入 导出"),
  entry("clear-local-data", { category: "account-data" }, "清空本地数据", "Clear local data", "delete danger 删除 危险"),
  entry("delete-account", { category: "account-data" }, "删除账户", "Delete account", "danger sign out logout 危险 退出"),

  entry("ai-provider", { category: "ai" }, "AI 提供商与密钥", "AI provider and key", "API key provider model 服务商 密钥"),
  entry("ai-model", { category: "ai", anchor: "ai-provider" }, "高级模型偏好", "Advanced model preference", "model routing 模型"),
  entry("ai-reasoning", { category: "ai" }, "思考模式", "Reasoning mode", "instant high xhigh"),
  entry("ai-estimate", { category: "ai" }, "自动估算任务用时", "Estimate task duration", "AI duration"),
  entry("ai-project", { category: "ai" }, "自动归入项目", "Auto-assign project", "AI confidence"),
  entry("ai-briefs", { category: "ai" }, "每日开工与收工简报", "Daily start and end briefs", "08:00 21:30 proactive review 主动 开工 收工 复盘"),
  entry("ai-memory", { category: "ai" }, "AI 记忆", "AI memory", "context personalization 上下文 个性化"),
  entry("hide-ai", { category: "ai" }, "隐藏所有 AI", "Hide all AI", "disable"),
  entry("ai-reset", { category: "ai" }, "重置 AI 个性化", "Reset AI personalization", "clear history 清空历史"),

  entry("portrait-window", { category: "widget" }, "竖屏小窗", "Portrait window", "desktop compact 置顶"),
  entry("desktop-widget", { category: "widget" }, "桌面小组件", "Desktop widget", "launch always on top opacity 启动 置顶 透明度"),
  entry("widget-font", { category: "widget" }, "小组件字体", "Widget font", "family scale 字号"),
  entry("widget-light", { category: "widget" }, "小组件浅色外观", "Widget light appearance", "background text timer overrun color 背景 文字 计时 超时"),
  entry("widget-light-background", { category: "widget" }, "浅色背景", "Light background", "widget color 小组件 背景颜色"),
  entry("widget-light-text", { category: "widget" }, "浅色文字", "Light text", "widget font color 小组件 文字颜色"),
  entry("widget-light-timer", { category: "widget" }, "浅色计时", "Light timer", "widget timer color 小组件 计时颜色"),
  entry("widget-light-overrun", { category: "widget" }, "浅色超时", "Light overrun", "widget overtime color 小组件 超时颜色"),
  entry("widget-dark", { category: "widget" }, "小组件深色外观", "Widget dark appearance", "background text timer overrun color 背景 文字 计时 超时"),
  entry("widget-dark-background", { category: "widget" }, "深色背景", "Dark background", "widget color 小组件 背景颜色"),
  entry("widget-dark-text", { category: "widget" }, "深色文字", "Dark text", "widget font color 小组件 文字颜色"),
  entry("widget-dark-timer", { category: "widget" }, "深色计时", "Dark timer", "widget timer color 小组件 计时颜色"),
  entry("widget-dark-overrun", { category: "widget" }, "深色超时", "Dark overrun", "widget overtime color 小组件 超时颜色"),
  entry("widget-timer", { category: "widget" }, "小组件计时模式", "Widget timer mode", "stopwatch countdown plugin 正计时 倒计时 插件"),
  entry("widget-reset", { category: "widget" }, "重置小组件", "Reset widget", "appearance position size 外观 位置 尺寸"),

  entry("plugins", { category: "plugins" }, "插件", "Plugins", "extension market import sources update restricted 扩展 市场 导入 来源 更新 受限"),
  entry("mcp", { category: "integrations" }, "MCP", "MCP", "token server integration 令牌 服务"),
  entry("sync-bridge", { category: "integrations" }, "同步", "Sync", "iCloud Drive OneDrive Dropbox 云盘 文件夹 桥接 备份"),
  entry("reset-settings", { category: "account-data" }, "重置所有设置", "Reset all settings", "restore defaults danger 恢复默认 危险"),
];

function searchableText(item: SettingsSearchEntry): string {
  return [item.labelZh, item.labelEn, item.descriptionZh, item.descriptionEn, item.keywords].filter(Boolean).join(" ").toLocaleLowerCase();
}

export function searchSettings(query: string, lang: Language, desktopAvailable = true, modifiedIds?: ReadonlySet<string>): SettingsSearchEntry[] {
  const tokens = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0 && !modifiedIds) return [];
  return SETTINGS_SEARCH_ENTRIES
    .filter((item) => item.id !== "modified-settings" && (!modifiedIds || modifiedIds.has(item.id)))
    .filter((item) => desktopAvailable || item.target.category !== "widget")
    .filter((item) => desktopAvailable || !["beta-updates", "auto-launch", "updates"].includes(item.id))
    .filter((item) => tokens.every((token) => searchableText(item).includes(token)))
    .sort((a, b) => {
      const aLabel = (lang === "zh" ? a.labelZh : a.labelEn).toLocaleLowerCase();
      const bLabel = (lang === "zh" ? b.labelZh : b.labelEn).toLocaleLowerCase();
      const normalizedQuery = tokens.join(" ");
      return Number(bLabel.startsWith(normalizedQuery)) - Number(aLabel.startsWith(normalizedQuery));
    })
    .slice(0, modifiedIds ? SETTINGS_SEARCH_ENTRIES.length : 24);
}

export function settingsSearchPath(item: SettingsSearchEntry, lang: Language): string {
  const path = [settingsCategoryLabel(item.target.category, lang)];
  if (item.target.detail) path.push(settingsDetailLabel(item.target.detail, lang));
  path.push(lang === "zh" ? item.labelZh : item.labelEn);
  return path.join(" › ");
}

export function settingsTargetForSearchId(id: string): SettingsTarget | undefined {
  return SETTINGS_SEARCH_ENTRIES.find((item) => item.id === id)?.target;
}
