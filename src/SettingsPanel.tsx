import { localIsoDate } from "./utils/localDate";
import { Suspense, lazy } from "react";
import type { AiMemory, CalendarFeedTokenMetadata, DesktopUpdateState, ExternalCalendarSource, Language, PlannerData, Settings, WidgetAction } from "./types";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { useCallback } from "react";
import { getWorkspaceDemoRuntime, getWorkspaceStorage, workspaceNow } from "./workspaceEnvironment";
import { formatLastSyncedAt, presetForMinutes, SYNC_INTERVAL_PRESETS } from "./sync";
import { t, viewLabel } from "./i18n";
import { DESKTOP_DOWNLOAD_URL, DESKTOP_RELEASES_URL } from "./downloads";
import { readAutoLaunchState, toggleAutoLaunchState } from "./desktopAutoLaunch";
import { AI_PROVIDER_MODELS, aiProviderPreset, readLocalAiProviderConfig, writeLocalAiProviderConfig, clearLocalAiProviderConfig, type LocalAiProviderConfig } from "./aiProviderConfig";
import { MAX_PLUGIN_CONFIG_STRING_LENGTH, listPlugins as listRegisteredPlugins, isActive as isPluginActive, resolveConfig as resolvePluginConfig, pluginText } from "./plugins/registry";
import { SETTINGS_CATEGORIES, normalizeSettingsTarget, settingsCategoryLabel, type SettingsCategory, type SettingsTarget, type SettingsTargetInput } from "./settingsNavigation";
import { UiBellIcon, UiCopyIcon, UiPencilIcon, UiPlusIcon, UiSearchIcon, UiTrashIcon } from "./components/UiIcons";
import { DEFAULT_WIDGET_APPEARANCE, normalizeWidgetAppearance } from "./widget/widgetPreferences";
import { normalizeWidgetTimerPreferences } from "./widget/widgetTimer";
import { SHORTCUTS, groupShortcutsByScope, type ShortcutScope } from "./utils/shortcuts";
import { exportDataAsJson, exportTasksAsCsv, isImportFileSizeAllowed, parsePlannerBackupJson, parseTasksCsv } from "./dataExport";
import { preparePlannerDataRestore } from "./syncMerge";
import { ProjectColorPicker, MobileSheetDismissHandle } from "./WorkspacePresentation";
import { CloseButton } from "./components/UiPrimitives";
import { SettingSection, SettingRow, SettingToggle, SettingSelect, SettingNumberInput, SettingTextInput, SettingColorInput, SettingActionButton, SettingDivider, SettingDescription } from "./components/SettingsControls";
import { reasoningModesForModel } from "./utils/aiModels";
import { createPortal, flushSync } from "react-dom";
import { runMotionTransition } from "./motion";
import { getDefaultSettings } from "./defaultSettings";
import { uid } from "./utils/ids";
const localStorage = getWorkspaceStorage();
const todayIso = () => getWorkspaceDemoRuntime()?.date ?? localIsoDate();

const ProactiveAssistantSettings = lazy(() => import("./components/ProactiveAssistantSettings").then((module) => ({ default: module.ProactiveAssistantSettings })));

const McpTokenManager = lazy(() => import("./components/McpTokenManager"));

const SyncBridgeManager = lazy(() => import("./components/SyncBridgeManager"));

const EXECUTE_THEME_PRESETS_LIGHT = ["#D7816A", "#584D3D", "#7EA172", "#0F0326", "#BE185D", "#D97706", "#2563EB"];

const EXECUTE_THEME_PRESETS_DARK  = ["#D7816A", "#FBF9FF", "#7EA172", "#584D3D", "#EC4899", "#F59E0B", "#3B82F6"];

const ACCENT_COLOR_NAMES: Record<string, [string, string]> = {
  "#D7816A": ["珊瑚", "Coral"],
  "#584D3D": ["棕褐", "Brown"],
  "#7EA172": ["鼠尾草", "Green"],
  "#0F0326": ["紫色", "Purple"],
  "#BE185D": ["粉色", "Pink"],
  "#EC4899": ["粉色", "Pink"],
  "#D97706": ["橙色", "Orange"],
  "#F59E0B": ["黄色", "Yellow"],
  "#2563EB": ["蓝色", "Blue"],
  "#3B82F6": ["蓝色", "Blue"],
  "#27231E": ["黑色", "Black"],
  "#FBF9FF": ["柔白", "Soft white"],
  "#EEE9DF": ["白色", "White"],
};

const MCP_ENDPOINT = import.meta.env.VITE_MCP_ENDPOINT || "https://navopath-mcp.shawn89890916.workers.dev/mcp";

function calendarFeedUrl(token: string) {
  const endpoint = new URL(MCP_ENDPOINT);
  endpoint.pathname = `${endpoint.pathname.replace(/\/mcp\/?$/, "").replace(/\/$/, "")}/calendar/${token}.ics`;
  endpoint.search = "";
  endpoint.hash = "";
  return endpoint.toString();
}

const DONATION_URL = "https://afdian.com/a/233cxy/plan";

function calendarFeedErrorMessage(caught: unknown, lang: Language) {
  const message = caught instanceof Error ? caught.message : String(caught);
  if (/schema cache|connection pool|time(?:d )?out|failed to fetch|503/i.test(message)) {
    return lang === "zh"
      ? "云服务暂时不可用，本地数据不会丢失。请稍后重试。"
      : "The cloud service is temporarily unavailable. Your local data is safe; please try again shortly.";
  }
  return message;
}

function CalendarFeedManager({ lang }: { lang: Language }) {
  const [tokens, setTokens] = useState<CalendarFeedTokenMetadata[]>([]);
  const [feedUrl, setFeedUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const api = window.plannerApi;
  const supported = Boolean(api.listCalendarFeedTokens && api.createCalendarFeedToken && api.revokeCalendarFeedToken);
  const refresh = useCallback(async () => {
    if (!api.listCalendarFeedTokens) { setLoading(false); return; }
    try {
      setError("");
      setTokens(await api.listCalendarFeedTokens());
    } catch (caught) {
      setError(calendarFeedErrorMessage(caught, lang));
    } finally {
      setLoading(false);
    }
  }, [api]);
  useEffect(() => { if (supported) void refresh(); else setLoading(false); }, [refresh, supported]);
  const copyFeedUrl = async () => {
    try {
      await navigator.clipboard.writeText(feedUrl);
      setNotice(lang === "zh" ? "订阅链接已复制" : "Subscription link copied");
      window.setTimeout(() => setNotice(""), 1800);
    } catch {
      setError(lang === "zh" ? "复制失败，请手动选择链接。" : "Copy failed. Select the link manually.");
    }
  };
  const createFeed = async () => {
    if (!api.createCalendarFeedToken) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const created = await api.createCalendarFeedToken();
      setFeedUrl(calendarFeedUrl(created.token));
      await refresh();
    } catch (caught) {
      setError(calendarFeedErrorMessage(caught, lang));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="df-mcp-settings df-calendar-settings">
      <strong>{lang === "zh" ? "只读日历订阅" : "Read-only calendar subscription"}</strong>
      <p>{supported
        ? (lang === "zh" ? "将时间轴排程、日历事件和未排程任务的截止日订阅到 iPhone、Notion Calendar 或其他日历。链接包含私密令牌，请勿公开分享。" : "Subscribe to timeline blocks, calendar events, and unscheduled task deadlines from iPhone, Notion Calendar, or another calendar. The link contains a private token; do not share it publicly.")
        : (lang === "zh" ? "登录云端账户后可生成日历订阅链接。" : "Sign in to a cloud account to create a calendar subscription link.")}</p>
      {supported && <button className="df-calendar-generate" type="button" disabled={busy} onClick={() => void createFeed()}>{busy
        ? (lang === "zh" ? "正在生成…" : "Generating…")
        : tokens.length > 0
          ? (lang === "zh" ? "更换订阅链接" : "Replace subscription link")
          : (lang === "zh" ? "生成订阅链接" : "Create subscription link")}</button>}
      {feedUrl && <div className="df-mcp-token">
        <small>{lang === "zh" ? "此完整链接只显示一次；更换链接会让旧订阅失效。" : "This complete link is shown once. Replacing it invalidates the old subscription."}</small>
        <code>{feedUrl}</code>
        <div className="df-calendar-actions">
          <button type="button" onClick={() => void copyFeedUrl()}>{lang === "zh" ? "复制链接" : "Copy link"}</button>
          <button type="button" onClick={() => { window.location.href = feedUrl.replace(/^https?:/, "webcal:"); }}>{lang === "zh" ? "在日历中订阅" : "Subscribe in Calendar"}</button>
        </div>
      </div>}
      {error && <p className="df-mcp-status error" role="alert">{error}</p>}
      {notice && <p className="df-mcp-status" role="status">{notice}</p>}
      {loading && <p className="df-mcp-status">{lang === "zh" ? "正在读取订阅状态…" : "Loading subscription status…"}</p>}
      {!loading && supported && tokens.length === 0 && !error && <p className="df-mcp-status muted">{lang === "zh" ? "还没有有效订阅。" : "No active subscription yet."}</p>}
      {tokens.map((token) => <div className="df-mcp-token-row" key={token.id}><span><strong>{lang === "zh" ? "NavoPath 日历" : "NavoPath Calendar"}</strong><small>{token.tokenPrefix}… · {new Date(token.createdAt).toLocaleDateString()}</small></span><button type="button" disabled={busy} onClick={async () => {
        if (!api.revokeCalendarFeedToken) return;
        setBusy(true);
        setError("");
        try {
          await api.revokeCalendarFeedToken(token.id);
          setFeedUrl("");
          await refresh();
        } catch (caught) {
          setError(calendarFeedErrorMessage(caught, lang));
        } finally {
          setBusy(false);
        }
      }}>{lang === "zh" ? "撤销" : "Revoke"}</button></div>)}
    </section>
  );
}

function ExternalCalendarManager({ lang }: { lang: Language }) {
  const api = window.plannerApi;
  const supported = Boolean(api.listExternalCalendars && api.connectExternalCalendar && api.refreshExternalCalendar && api.removeExternalCalendar);
  const [sources, setSources] = useState<ExternalCalendarSource[]>([]);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [busyId, setBusyId] = useState("");
  const [confirmRemoveId, setConfirmRemoveId] = useState("");
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    if (!api.listExternalCalendars) return;
    try {
      const result = await api.listExternalCalendars();
      setSources(result.sources);
      setError("");
    } catch (caught) {
      setError(calendarFeedErrorMessage(caught, lang));
    }
  }, [api, lang]);
  useEffect(() => { if (supported) void load(); }, [load, supported]);
  const changed = () => window.dispatchEvent(new CustomEvent("navopath:external-calendar-changed"));
  return <section className="df-external-calendar-settings">
    <strong>{lang === "zh" ? "外部 ICS 日历（只读）" : "External ICS calendars (read-only)"}</strong>
    <p>{supported
      ? (lang === "zh" ? "最多连接 10 个 HTTPS ICS 地址。事项只作为忙碌时间参与冲突检测和 AI 规划，不会导入任务，也不会写回来源日历。" : "Connect up to 10 HTTPS ICS URLs. Events are used only as read-only busy time for conflicts and AI planning; they are never imported as tasks or written back.")
      : (lang === "zh" ? "登录云端账号并部署外部日历服务后可用。" : "Available after signing in and deploying the external-calendar service.")}</p>
    {supported && <div className="df-external-calendar-connect">
      <input value={name} maxLength={120} onChange={(event) => setName(event.target.value)} placeholder={lang === "zh" ? "日历名称" : "Calendar name"} />
      <input value={url} type="url" inputMode="url" onChange={(event) => setUrl(event.target.value)} placeholder="https://…/calendar.ics" />
      <button type="button" disabled={Boolean(busyId) || sources.length >= 10 || !name.trim() || !url.trim()} onClick={async () => {
        if (!api.connectExternalCalendar) return;
        setBusyId("connect"); setError("");
        try {
          await api.connectExternalCalendar({ name: name.trim(), url: url.trim() });
          setName(""); setUrl(""); await load(); changed();
        } catch (caught) { setError(calendarFeedErrorMessage(caught, lang)); }
        finally { setBusyId(""); }
      }}>{busyId === "connect" ? (lang === "zh" ? "连接中…" : "Connecting…") : (lang === "zh" ? "连接" : "Connect")}</button>
    </div>}
    {error && <p className="df-mcp-status error" role="alert">{error}</p>}
    {!supported && <p className="df-mcp-status muted">{lang === "zh" ? "当前环境不可用" : "Unavailable in this environment"}</p>}
    {supported && sources.length === 0 && !error && <p className="df-mcp-status muted">{lang === "zh" ? "尚未连接外部日历。" : "No external calendars connected."}</p>}
    <div className="df-external-calendar-list">{sources.map((source) => <article key={source.id} className={`df-external-calendar-source ${source.syncStatus}`}>
      <div><strong>{source.name}</strong><code>{source.displayUrl}</code><small>{source.syncStatus === "error" ? source.syncError : source.lastSyncedAt ? `${lang === "zh" ? "上次同步" : "Last synced"} ${new Date(source.lastSyncedAt).toLocaleString()}` : (lang === "zh" ? "等待首次同步" : "Waiting for first sync")}</small></div>
      <div>
        <button type="button" disabled={Boolean(busyId)} onClick={async () => { if (!api.refreshExternalCalendar) return; setBusyId(source.id); setError(""); try { await api.refreshExternalCalendar(source.id, true); await load(); changed(); } catch (caught) { setError(calendarFeedErrorMessage(caught, lang)); } finally { setBusyId(""); } }}>{busyId === source.id ? "…" : (lang === "zh" ? "同步" : "Sync")}</button>
        {confirmRemoveId === source.id ? <><button type="button" onClick={() => setConfirmRemoveId("")}>{lang === "zh" ? "取消" : "Cancel"}</button><button type="button" className="danger-lite" disabled={Boolean(busyId)} onClick={async () => { if (!api.removeExternalCalendar) return; setBusyId(source.id); try { await api.removeExternalCalendar(source.id); setConfirmRemoveId(""); await load(); changed(); } catch (caught) { setError(calendarFeedErrorMessage(caught, lang)); } finally { setBusyId(""); } }}>{lang === "zh" ? "确认移除" : "Confirm removal"}</button></> : <button type="button" onClick={() => setConfirmRemoveId(source.id)}>{lang === "zh" ? "移除" : "Remove"}</button>}
      </div>
    </article>)}</div>
  </section>;
}

function SyncSettingsControl({
  settings,
  lang,
  cloudReady,
  isManualSyncing,
  onChange,
  onSyncNow,
}: {
  settings: Settings;
  lang: Language;
  cloudReady: boolean;
  isManualSyncing: boolean;
  onChange: (patch: Partial<Settings>) => void;
  onSyncNow?: (direction?: "push" | "pull" | "both") => Promise<boolean> | void;
}) {
  const [now, setNow] = useState(() => workspaceNow());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(workspaceNow()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const presetKey = presetForMinutes(settings.syncIntervalMinutes);
  const lastSyncedLabel = formatLastSyncedAt(settings.lastSyncedAt, lang, now);
  const lastSyncedAbsolute = settings.lastSyncedAt
    ? new Date(settings.lastSyncedAt).toLocaleString(lang === "zh" ? "zh-CN" : "en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;
  return (
    <section className="df-settings-sync">
      {!cloudReady && <p className="df-settings-sync-note">{t(lang, "sync.requiresAccount")}</p>}
      <label className="df-utility-select" data-disabled={!cloudReady}>
        {t(lang, "sync.frequency")}
        <select
          value={presetKey}
          disabled={!cloudReady}
          onChange={(event) => {
            const next = SYNC_INTERVAL_PRESETS.find((preset) => preset.key === event.target.value);
            if (!next) return;
            onChange({ syncIntervalMinutes: next.minutes });
          }}
        >
          {SYNC_INTERVAL_PRESETS.map((preset) => (
            <option key={preset.key} value={preset.key}>
              {preset.minutes === 0
                ? t(lang, "sync.manual")
                : preset.minutes === 15
                  ? t(lang, "sync.every15m")
                  : preset.minutes === 60
                    ? t(lang, "sync.every1h")
                    : preset.minutes === 360
                      ? t(lang, "sync.every6h")
                      : t(lang, "sync.every24h")}
            </option>
          ))}
        </select>
      </label>
      <div className="df-settings-sync-row">
        <span>
          <strong>{t(lang, "sync.lastSynced")}</strong>
          <small>{lastSyncedLabel}</small>
          {lastSyncedAbsolute !== lastSyncedLabel && <small className="df-settings-sync-absolute">{lastSyncedAbsolute}</small>}
        </span>
        <button
          type="button"
          className={`df-settings-sync-now${isManualSyncing ? " is-syncing" : ""}`}
          disabled={!cloudReady || isManualSyncing}
          onClick={() => {
            void onSyncNow?.("both");
          }}
        >
          {isManualSyncing ? t(lang, "sync.syncing") : t(lang, "sync.syncNow")}
        </button>
      </div>
      <div className="df-settings-sync-directions">
        <button
          type="button"
          className="df-settings-sync-direction"
          disabled={!cloudReady || isManualSyncing}
          onClick={() => { void onSyncNow?.("push"); }}
          title={t(lang, "sync.pushHint")}
        >
          ↑ {t(lang, "sync.push")}
        </button>
        <button
          type="button"
          className="df-settings-sync-direction"
          disabled={!cloudReady || isManualSyncing}
          onClick={() => { void onSyncNow?.("pull"); }}
          title={t(lang, "sync.pullHint")}
        >
          ↓ {t(lang, "sync.pull")}
        </button>
      </div>
    </section>
  );
}

function DesktopUpdateControl({ lang }: { lang: Language }) {
  const api = window.desktopApi;
  const [state, setState] = useState<DesktopUpdateState | null>(null);
  const updaterAvailable = Boolean(api);

  useEffect(() => {
    if (!updaterAvailable || !api) return;
    void api.getUpdateState().then(setState);
    return api.onUpdateState(setState);
  }, [api, updaterAvailable]);

  if (!updaterAvailable) {
    return <a className="df-download-link" href={DESKTOP_DOWNLOAD_URL} target="_blank" rel="noreferrer">{lang === "zh" ? "一键下载最新版 Windows 应用" : "Download the latest Windows app"}<span aria-hidden="true">↓</span></a>;
  }

  const statusText = (() => {
    if (!state) return lang === "zh" ? "正在读取版本…" : "Reading version…";
    if (state.status === "checking") return lang === "zh" ? "正在检查更新…" : "Checking for updates…";
    if (state.status === "available") return lang === "zh" ? `发现 ${state.availableVersion}，确认后自动更新并重启` : `${state.availableVersion} available. Confirm to update and restart.`;
    if (state.status === "downloading") return lang === "zh" ? `正在下载 ${state.progress}%` : `Downloading ${state.progress}%`;
    if (state.status === "downloaded") return lang === "zh" ? `${state.availableVersion} 已准备好安装` : `${state.availableVersion} is ready to install`;
    if (state.status === "current") return lang === "zh" ? "当前已是最新版" : "You're up to date";
    if (state.status === "error") return lang === "zh" ? `更新失败：${state.message}` : `Update failed: ${state.message}`;
    return lang === "zh" ? "启动后及每天自动检查，确认即可更新" : "Checked at startup and daily. Confirm to update.";
  })();
  const busy = !state || state.status === "checking" || state.status === "downloading";
  const actionLabel = state?.status === "downloaded"
    ? (lang === "zh" ? "重启并安装" : "Restart and install")
    : state?.status === "available"
      ? (lang === "zh" ? "立即更新" : "Update now")
      : (lang === "zh" ? "立即检查更新" : "Check for updates");

  return <section className="df-update-card">
    <div><strong>{lang === "zh" ? "桌面应用更新" : "Desktop app updates"}</strong><small>{statusText}</small>{state?.currentVersion && <small>{lang === "zh" ? "当前版本" : "Current version"} {state.currentVersion}</small>}</div>
    {state?.status === "downloading" && <progress max="100" value={state.progress} />}
    <button type="button" disabled={busy} onClick={() => state?.status === "downloaded" ? void api?.installUpdate() : void api?.checkForUpdates().then(setState)}>{actionLabel}</button>
    <a href={DESKTOP_RELEASES_URL}>{lang === "zh" ? "查看发布说明" : "View release notes"}</a>
  </section>;
}

function AutoLaunchToggle({ lang }: { lang: Language }) {
  const api = window.desktopApi;
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!api) { setLoading(false); return; }
    let active = true;
    void readAutoLaunchState(api, false).then((next) => {
      if (!active) return;
      setEnabled(next);
      setLoading(false);
    });
    return () => { active = false; };
  }, [api]);

  if (!api) return null;

  const toggleAutoLaunch = async () => {
    setLoading(true);
    const next = await toggleAutoLaunchState(api, enabled);
    setEnabled(next);
    setLoading(false);
  };

  return <section className="df-update-card">
    <div>
      <strong>{lang === "zh" ? "开机自启动" : "Launch at startup"}</strong>
      <small>{lang === "zh" ? "登录系统时自动打开 NavoPath" : "Automatically open NavoPath when you sign in"}</small>
    </div>
    <button
      type="button"
      disabled={loading}
      onClick={() => { void toggleAutoLaunch(); }}
      aria-pressed={enabled}
    >
      {loading ? "…" : enabled ? (lang === "zh" ? "已开启" : "On") : (lang === "zh" ? "已关闭" : "Off")}
    </button>
  </section>;
}

function patchPluginConfig(settings: Settings, onSave: (patch: Partial<Settings>) => void, pluginId: string, patch: Record<string, unknown>) {
  const existing = settings.pluginConfigs?.[pluginId] ?? {};
  onSave({ pluginConfigs: { ...(settings.pluginConfigs ?? {}), [pluginId]: { ...existing, ...patch } } });
}

function AiProviderSettings({ lang, onSave }: { lang: Language; onSave: (patch: Partial<Settings>) => void }) {
  const [config, setConfig] = useState<LocalAiProviderConfig>(() => readLocalAiProviderConfig());
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [jsonText, setJsonText] = useState(() => JSON.stringify(readLocalAiProviderConfig(), null, 2));
  const save = (patch: Partial<LocalAiProviderConfig>) => {
    const next = writeLocalAiProviderConfig(patch);
    setConfig(next);
    setJsonText(JSON.stringify(next, null, 2));
    onSave({ model: next.model, baseUrl: next.baseUrl });
  };
  const modelOptions = AI_PROVIDER_MODELS[config.provider];
  const providerLabels: Record<LocalAiProviderConfig["provider"], string> = {
    deepseek: lang === "zh" ? "DeepSeek 官方" : "DeepSeek official",
    siliconflow: "SiliconFlow",
    openai: "OpenAI",
    anthropic: "Anthropic",
    zhipu: "GLM",
    qwen: lang === "zh" ? "通义千问" : "Qwen",
    "openai-compatible": lang === "zh" ? "其他 OpenAI 兼容服务" : "Other OpenAI-compatible",
  };
  return <div className="df-ai-provider-settings">
    <div className="df-ai-provider-grid">
      <label><span>{lang === "zh" ? "提供商" : "Provider"}</span><select value={config.provider} onChange={(event) => save(aiProviderPreset(event.target.value as LocalAiProviderConfig["provider"]))}>{Object.entries(providerLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label><span>{lang === "zh" ? "API Key" : "API key"}</span><input type="password" value={config.apiKey} placeholder="sk-..." autoComplete="off" onChange={(event) => save({ apiKey: event.target.value })} /></label>
      <label><span>{lang === "zh" ? "API 地址" : "Base URL"}</span><input value={config.baseUrl} placeholder="https://provider.example/v1" inputMode="url" onChange={(event) => save({ baseUrl: event.target.value })} /></label>
      <label><span>{lang === "zh" ? "模型列表" : "Model list"}</span><select value={modelOptions.some((option) => option.id === config.model) ? config.model : "__custom__"} onChange={(event) => { if (event.target.value !== "__custom__") save({ model: event.target.value }); }}><option value="__custom__">{lang === "zh" ? "自定义模型 ID" : "Custom model ID"}</option>{modelOptions.map((option) => <option key={option.id} value={option.id}>{lang === "zh" ? option.zh : option.en}</option>)}</select></label>
      <label><span>{lang === "zh" ? "模型 ID" : "Model ID"}</span><input value={config.model} placeholder={lang === "zh" ? "输入供应商模型 ID" : "Enter the provider model ID"} onChange={(event) => save({ model: event.target.value })} /></label>
    </div>
    <small>{config.apiKey ? (lang === "zh" ? "Key 仅保存在本机浏览器/桌面应用中。" : "The key is stored only on this device.") : (lang === "zh" ? "请填写 API Key。" : "Enter an API key.")}</small>
    <button type="button" className="df-settings-disclosure" onClick={() => setAdvancedOpen((open) => !open)}>{advancedOpen ? "−" : "+"} {lang === "zh" ? "高级配置" : "Advanced configuration"}</button>
    {advancedOpen && <div className="df-ai-provider-advanced"><label><span>JSON</span><textarea value={jsonText} spellCheck={false} onChange={(event) => setJsonText(event.target.value)} onBlur={() => { try { save(JSON.parse(jsonText) as Partial<LocalAiProviderConfig>); } catch { /* Keep the draft visible until valid JSON is entered. */ } }} /></label><button type="button" onClick={() => { clearLocalAiProviderConfig(); const next = readLocalAiProviderConfig(); setConfig(next); setJsonText(JSON.stringify(next, null, 2)); onSave({ model: next.model, baseUrl: next.baseUrl }); }}>{lang === "zh" ? "清除本机 Key" : "Clear local key"}</button></div>}
  </div>;
}

function localizedPluginName(plugin: ReturnType<typeof listRegisteredPlugins>[number], lang: Language) {
  return pluginText(plugin.name, plugin.nameI18n, lang);
}

function localizedPluginDescription(plugin: ReturnType<typeof listRegisteredPlugins>[number], lang: Language) {
  return pluginText(plugin.description, plugin.descriptionI18n, lang);
}

function localizedPluginEnabledSummary(plugin: ReturnType<typeof listRegisteredPlugins>[number], lang: Language) {
  return pluginText(
    lang === "zh" ? "启用后会在下方工具区显示可直接使用的官方工具。" : "After enabling, its official tool appears below.",
    plugin.enabledSummaryI18n,
    lang,
  );
}

function SubscriptionPanel({ lang }: { lang: Language }) {
  const tiers = lang === "zh"
    ? [
      { name: "Free", price: "¥0", note: "当前启用", items: ["本地任务与项目规划", "核心时间轴与日/周/月视图", "基础导入导出", "官方内置插件预览"] },
      { name: "Supporter", price: "爱发电支持", note: "适合支持持续开发", items: ["支持者身份入口", "优先体验实验性插件", "更多 AI / 同步额度预留", "公开路线图优先反馈"] },
      { name: "Pro", price: "即将推出", note: "开发测试期暂时开放核心权益", items: ["多设备云端同步", "Navo AI 对话与记忆", "MCP 远程访问", "高级导入导出与备份"] },
    ]
    : [
      { name: "Free", price: "$0", note: "Active now", items: ["Local tasks and projects", "Core timeline and calendar views", "Basic import and export", "Official built-in plugin preview"] },
      { name: "Supporter", price: "Donation", note: "For supporting ongoing work", items: ["Supporter entry point", "Early experimental plugin access", "Reserved AI / sync quota framing", "Priority feedback on the roadmap"] },
      { name: "Pro", price: "Coming soon", note: "Core benefits are open during dev preview", items: ["Multi-device cloud sync", "Navo AI chat and memory", "Remote MCP access", "Advanced import/export and backups"] },
    ];
  return (
    <section className="df-subscription-panel">
      <div className="df-subscription-head">
        <span>{lang === "zh" ? "方案权限" : "Plan access"}</span>
        <strong>{lang === "zh" ? "Dev Preview" : "Dev Preview"}</strong>
        <small>{lang === "zh" ? "开发测试期会暂时开放部分 Pro 权益；正式权限以后端开通为准。" : "Some Pro-like benefits are open during the dev preview; final access will follow backend entitlement."}</small>
      </div>
      <div className="df-plan-choice-grid detailed" role="list">
        {tiers.map((tier, index) => (
          <article className={`df-plan-choice ${index === 0 ? "active" : ""}`} role="listitem" key={tier.name}>
            <span>{tier.name}</span>
            <strong>{tier.price}</strong>
            <small>{tier.note}</small>
            <ul>
              {tier.items.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </article>
        ))}
      </div>
      <a className="df-donation-link" href={DONATION_URL} target="_blank" rel="noreferrer">
        <span>{lang === "zh" ? "通过爱发电支持 NavoPath" : "Support NavoPath on Afdian"}</span>
        <small>{lang === "zh" ? "捐赠不会立即改变当前账户权限，但会支持后续服务和插件维护。" : "Donation does not immediately change account access, but supports ongoing service and plugin maintenance."}</small>
      </a>
    </section>
  );
}

function AccountMoreSection({ lang, onShowAbout, onDeleteAccount }: { lang: Language; onShowAbout: () => void; onDeleteAccount?: () => void }) {
  return (
    <section className="df-account-more" aria-label={lang === "zh" ? "账户操作" : "Account actions"}>
      <div className="df-account-more-body">
        <button className="df-settings-about" onClick={onShowAbout}>
          <span className="df-settings-about-icon">i</span>
          <span>{t(lang, "settings.about")}</span>
          <small>{lang === "zh" ? "将打开外部链接" : "Opens external link"}</small>
          <i aria-hidden="true">↗</i>
        </button>
        <a href={`https://navopath.com/privacy?lang=${lang}`} target="_blank" rel="noopener noreferrer">{lang === "zh" ? "隐私政策" : "Privacy Policy"}</a>
        {onDeleteAccount && <button className="df-settings-delete-account" onClick={onDeleteAccount}>{lang === "zh" ? "删除账号和全部数据" : "Delete account and all data"}</button>}
      </div>
    </section>
  );
}

function PomodoroPluginTool({ settings, onSave, lang }: { settings: Settings; onSave: (patch: Partial<Settings>) => void; lang: Language }) {
  const plugin = listRegisteredPlugins().find((p) => p.id === "pomodoro");
  const config = plugin ? resolvePluginConfig(plugin, settings.pluginConfigs?.pomodoro) : {};
  const focusMinutes = Number(config.focusMinutes) || 25;
  const breakMinutes = Number(config.breakMinutes) || 5;
  const [phase, setPhase] = useState<"focus" | "break">("focus");
  const [seconds, setSeconds] = useState(focusMinutes * 60);
  const [running, setRunning] = useState(false);
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      setSeconds((value) => {
        if (value > 1) return value - 1;
        const nextPhase = phase === "focus" ? "break" : "focus";
        setPhase(nextPhase);
        return (nextPhase === "focus" ? focusMinutes : breakMinutes) * 60;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [running, phase, focusMinutes, breakMinutes]);
  useEffect(() => { if (!running) setSeconds((phase === "focus" ? focusMinutes : breakMinutes) * 60); }, [focusMinutes, breakMinutes, phase, running]);
  const mm = Math.floor(seconds / 60).toString().padStart(2, "0");
  const ss = (seconds % 60).toString().padStart(2, "0");
  return (
    <article className="df-plugin-tool">
      <header><strong>Pomodoro</strong><small>{phase === "focus" ? (lang === "zh" ? "专注" : "Focus") : (lang === "zh" ? "休息" : "Break")}</small></header>
      <div className="df-plugin-timer">{mm}:{ss}</div>
      <div className="df-plugin-tool-actions">
        <button type="button" onClick={() => setRunning((value) => !value)}>{running ? (lang === "zh" ? "暂停" : "Pause") : (lang === "zh" ? "开始" : "Start")}</button>
        <button type="button" onClick={() => { setRunning(false); setPhase("focus"); setSeconds(focusMinutes * 60); }}>{lang === "zh" ? "重置" : "Reset"}</button>
      </div>
      <small>{lang === "zh" ? "时长可在插件配置中调整。" : "Adjust durations in plugin configuration."}</small>
    </article>
  );
}

function HabitPluginTool({ settings, onSave, lang }: { settings: Settings; onSave: (patch: Partial<Settings>) => void; lang: Language }) {
  const plugin = listRegisteredPlugins().find((p) => p.id === "habit-tracker");
  const config = plugin ? resolvePluginConfig(plugin, settings.pluginConfigs?.["habit-tracker"]) : {};
  const today = todayIso();
  const habits = String(config.habits || "").split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  const displayHabits = habits.length > 0 ? habits : (lang === "zh" ? ["复盘今天", "整理任务", "查看明日计划"] : ["Review today", "Tidy tasks", "Check tomorrow"]);
  const doneByDate = (config.doneByDate && typeof config.doneByDate === "object" ? config.doneByDate : {}) as Record<string, string[]>;
  const done = new Set(doneByDate[today] || []);
  const toggle = (habit: string) => {
    const next = new Set(done);
    if (next.has(habit)) next.delete(habit);
    else next.add(habit);
    patchPluginConfig(settings, onSave, "habit-tracker", { doneByDate: { ...doneByDate, [today]: Array.from(next) } });
  };
  return (
    <article className="df-plugin-tool">
      <header><strong>{lang === "zh" ? "习惯" : "Habits"}</strong><small>{done.size}/{displayHabits.length}</small></header>
      <div className="df-plugin-habits">
        {displayHabits.map((habit) => <label key={habit}><input type="checkbox" checked={done.has(habit)} onChange={() => toggle(habit)} />{habit}</label>)}
      </div>
    </article>
  );
}

function WeatherPluginTool({ settings, lang }: { settings: Settings; lang: Language }) {
  const plugin = listRegisteredPlugins().find((p) => p.id === "weather");
  const config = plugin ? resolvePluginConfig(plugin, settings.pluginConfigs?.weather) : {};
  const city = String(config.city || "Shanghai");
  const units = config.units === "f" ? "f" : "c";
  const seed = Array.from(city).reduce((sum, char) => sum + char.charCodeAt(0), workspaceNow().getDate());
  const celsius = 16 + (seed % 15);
  const value = units === "f" ? Math.round(celsius * 9 / 5 + 32) : celsius;
  const condition = [lang === "zh" ? "晴朗" : "Clear", lang === "zh" ? "多云" : "Cloudy", lang === "zh" ? "有风" : "Breezy"][seed % 3];
  return (
    <article className="df-plugin-tool">
      <header><strong>{lang === "zh" ? "天气" : "Weather"}</strong><small>{city}</small></header>
      <div className="df-plugin-weather"><strong>{value}°{units.toUpperCase()}</strong><span>{condition}</span></div>
      <small>{lang === "zh" ? "本地预览徽章，不请求外部天气 API。" : "Local preview badge. No external weather API call."}</small>
    </article>
  );
}

function NotesPluginTool({ data, onSaveData, lang }: { data: PlannerData; onSaveData: (next: PlannerData) => void; lang: Language }) {
  const task = data.tasks[0];
  const [taskId, setTaskId] = useState(task?.id || "");
  const selected = data.tasks.find((item) => item.id === taskId) || task;
  if (!selected) {
    return <article className="df-plugin-tool"><header><strong>{lang === "zh" ? "笔记" : "Notes"}</strong></header><small>{lang === "zh" ? "先创建一个任务后即可写笔记。" : "Create a task first to attach notes."}</small></article>;
  }
  const saveNotes = (notes: string) => {
    onSaveData({ ...data, tasks: data.tasks.map((item) => item.id === selected.id ? { ...item, notes, updatedAt: workspaceNow().toISOString() } : item) });
  };
  return (
    <article className="df-plugin-tool wide">
      <header><strong>{lang === "zh" ? "任务笔记" : "Task notes"}</strong><small>{lang === "zh" ? "保存到任务 notes 字段" : "Saved to the task notes field"}</small></header>
      <select value={selected.id} onChange={(event) => setTaskId(event.target.value)}>
        {data.tasks.slice(0, 80).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
      </select>
      <textarea rows={4} value={selected.notes || ""} onChange={(event) => saveNotes(event.target.value)} placeholder={lang === "zh" ? "写下任务背景、材料或下一步..." : "Add context, materials, or next steps..."} />
    </article>
  );
}

function PluginRuntimePanel({ settings, data, onSave, onSaveData, lang }: { settings: Settings; data: PlannerData; onSave: (patch: Partial<Settings>) => void; onSaveData: (next: PlannerData) => void; lang: Language }) {
  const enabled = new Set(settings.enabledPlugins ?? []);
  if (enabled.size === 0) {
    return <p className="df-plugin-empty">{lang === "zh" ? "启用上方插件后，这里会出现可直接使用的工具。" : "Enable plugins above and their tools will appear here."}</p>;
  }
  return (
    <section className="df-plugin-runtime" aria-label={lang === "zh" ? "已启用插件工具" : "Enabled plugin tools"}>
      {enabled.has("pomodoro") && <PomodoroPluginTool settings={settings} onSave={onSave} lang={lang} />}
      {enabled.has("habit-tracker") && <HabitPluginTool settings={settings} onSave={onSave} lang={lang} />}
      {enabled.has("weather") && <WeatherPluginTool settings={settings} lang={lang} />}
      {enabled.has("notes") && <NotesPluginTool data={data} onSaveData={onSaveData} lang={lang} />}
    </section>
  );
}

function settingsCategoryDescription(category: SettingsCategory, lang: Language, isDark: boolean): string {
  const descriptions: Record<SettingsCategory, [string, string]> = {
    general: ["语言、时间边界与快捷键。", "Language, time boundaries, and shortcuts."],
    appearance: isDark
      ? ["深色交互高亮使用柔和白色；浅色模式可继续使用已保存的强调色。", "Dark mode uses a softened white interaction accent; saved accents remain available in light mode."]
      : ["界面模式、字体与强调色。", "Interface mode, typography, and accent color."],
    workflow: ["规划视图、智能排程与工作习惯。", "Planning views, smart scheduling, and work habits."],
    "account-data": ["账户、同步、导入导出与数据控制。", "Account, sync, imports, exports, and data controls."],
    ai: ["Navo AI 的模型、记忆与主动助理。", "Navo AI models, memory, and proactive assistant."],
    widget: ["桌面窗口的外观与计时器。", "Desktop window appearance and timer."],
    integrations: ["日历订阅、外部日历、插件、MCP 与云盘同步。", "Calendar subscriptions, external calendars, plugins, MCP, and cloud-folder sync."],
    advanced: ["高级设置与恢复选项。", "Advanced and recovery options."],
  };
  return descriptions[category][lang === "zh" ? 0 : 1];
}

function SettingsCategoryIcon({ category }: { category: SettingsCategory }) {
  const props = { size: 19, strokeWidth: 1.8 };
  switch (category) {
    case "appearance": return <UiPencilIcon {...props} />;
    case "workflow": return <UiSearchIcon {...props} />;
    case "account-data": return <UiBellIcon {...props} />;
    case "ai": return <UiPlusIcon {...props} />;
    case "widget": return <UiTrashIcon {...props} />;
    default: return <UiCopyIcon {...props} />;
  }
}

export function UtilityPanel({ kind, settings, initialSection, compactLayout, data, authEmail, onClose, onSave, onSaveProfile, onWidgetAction, onSaveData, onClearChatHistory, onShowAbout, onOpenNotifications, onSignOut, onDeleteAccount, onSyncNow, isManualSyncing, cloudReady, lang, onOpenScheduleTemplates }: { kind: "settings" | "about"; settings: Settings; initialSection?: SettingsTargetInput; compactLayout: boolean; data: PlannerData; authEmail: string; onClose: () => void; onSave: (patch: Partial<Settings>) => void; onSaveProfile: (patch: Partial<Pick<Settings, "displayName" | "avatarDataUrl">>) => Promise<void>; onWidgetAction: (action: WidgetAction) => void; onSaveData: (next: PlannerData) => void; onClearChatHistory: () => void; onShowAbout: () => void; onOpenNotifications?: () => void; onSignOut?: () => void; onDeleteAccount?: () => void; onSyncNow?: (direction?: "push" | "pull" | "both") => Promise<boolean> | void; isManualSyncing?: boolean; cloudReady?: boolean; lang: Language; onOpenScheduleTemplates?: () => void }) {
  const resolvedInitial = normalizeSettingsTarget(initialSection);
  const isDesktopRuntime = Boolean(window.desktopApi);
  const resolveRuntimeTarget = (target: SettingsTarget): SettingsTarget => target.category === "widget" && !isDesktopRuntime ? { category: "general" } : target;
  const [settingsTarget, setSettingsTarget] = useState<SettingsTarget>(resolveRuntimeTarget(resolvedInitial));
  const [settingsHome, setSettingsHome] = useState(!initialSection && compactLayout);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [widgetThemeOpen, setWidgetThemeOpen] = useState<"light" | "dark">("light");
  const [integrationTab, setIntegrationTab] = useState<"calendar" | "external-calendar" | "plugins" | "mcp" | "sync">("calendar");
  const settingsContentRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const [profileNameEditing, setProfileNameEditing] = useState(false);
  const [profileNameDraft, setProfileNameDraft] = useState(settings.displayName || "");
  const [profileNameError, setProfileNameError] = useState("");
  const [profileNameSaving, setProfileNameSaving] = useState(false);
  const profileNameSaveInFlightRef = useRef(false);
  useEffect(() => {
    setSettingsTarget(resolveRuntimeTarget(normalizeSettingsTarget(initialSection)));
    setSettingsHome(!initialSection && compactLayout);
    setProfileNameEditing(false);
  }, [initialSection, compactLayout]);
  useEffect(() => {
    if (!profileNameEditing) setProfileNameDraft(settings.displayName || "");
  }, [settings.displayName, profileNameEditing]);
  useEffect(() => {
    if (kind !== "settings") return;
    closeButtonRef.current?.focus();
  }, [kind]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);
  useEffect(() => {
    if (settingsTarget.anchor === "shortcuts") setShortcutsOpen(true);
    if (settingsTarget.anchor?.startsWith("widget-light")) setWidgetThemeOpen("light");
    if (settingsTarget.anchor?.startsWith("widget-dark")) setWidgetThemeOpen("dark");
    if (settingsTarget.anchor === "mcp") setIntegrationTab("mcp");
    if (settingsTarget.anchor === "sync-bridge") setIntegrationTab("sync");
    if (settingsTarget.anchor === "plugins") setIntegrationTab("plugins");
    if (settingsTarget.anchor === "external-calendar") setIntegrationTab("external-calendar");
  }, [settingsTarget.anchor]);
  useEffect(() => {
    const content = settingsContentRef.current;
    if (!content) return;
    const handle = window.requestAnimationFrame(() => {
      const anchor = settingsTarget.anchor
        ? content.querySelector<HTMLElement>(`[data-settings-anchor="${settingsTarget.anchor}"]`)
        : null;
      if (!anchor) {
        content.scrollTop = 0;
        return;
      }
      content.scrollTop = Math.max(0, anchor.offsetTop - 12);
      anchor.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(handle);
  }, [settingsTarget]);

  function navigateSettings(target: SettingsTarget) {
    if (target.anchor === "shortcuts") setShortcutsOpen(true);
    if (target.anchor?.startsWith("widget-light")) setWidgetThemeOpen("light");
    if (target.anchor?.startsWith("widget-dark")) setWidgetThemeOpen("dark");
    if (target.anchor === "mcp") setIntegrationTab("mcp");
    if (target.anchor === "sync-bridge") setIntegrationTab("sync");
    if (target.anchor === "plugins") setIntegrationTab("plugins");
    if (target.anchor === "calendar-feed") setIntegrationTab("calendar");
    if (target.anchor === "external-calendar") setIntegrationTab("external-calendar");
    void runMotionTransition(() => flushSync(() => {
      setSettingsTarget(resolveRuntimeTarget(target));
      setSettingsHome(false);
    }), { scope: "settings", direction: "forward" });
  }
  function backToSettingsHome() {
    void runMotionTransition(() => flushSync(() => {
      setSettingsTarget(resolveRuntimeTarget({ category: "general" }));
      setSettingsHome(true);
      if (settingsContentRef.current) settingsContentRef.current.scrollTop = 0;
    }), { scope: "settings", direction: "backward" });
  }
  async function commitProfileName() {
    if (profileNameSaveInFlightRef.current) return;
    const nextName = profileNameDraft.trim();
    if (!nextName || nextName === settings.displayName) {
      setProfileNameEditing(false);
      setProfileNameError("");
      return;
    }
    profileNameSaveInFlightRef.current = true;
    setProfileNameSaving(true);
    setProfileNameError("");
    try {
      await onSaveProfile({ displayName: nextName });
      setProfileNameEditing(false);
    } catch {
      setProfileNameError(lang === "zh" ? "保存失败，请重试。" : "Could not save. Please try again.");
    } finally {
      profileNameSaveInFlightRef.current = false;
      setProfileNameSaving(false);
    }
  }
  function openNotifications() {
    onClose();
    window.setTimeout(() => onOpenNotifications?.(), 220);
  }
  const [confirmResetSettings, setConfirmResetSettings] = useState(false);
  const [confirmClearLocalData, setConfirmClearLocalData] = useState(false);
  const [clearLocalDataPhrase, setClearLocalDataPhrase] = useState("");
  const [pluginConfigDialogId, setPluginConfigDialogId] = useState<string | null>(null);
  const [pluginConfigDraft, setPluginConfigDraft] = useState<Record<string, unknown>>({});
  const widgetAppearance = normalizeWidgetAppearance(settings.widgetAppearance);
  const widgetTimerSettings = normalizeWidgetTimerPreferences(settings.widgetTimerPreferences);
  const [widgetTimerDraft, setWidgetTimerDraft] = useState(widgetTimerSettings);
  useEffect(() => {
    setWidgetTimerDraft(widgetTimerSettings);
  }, [settings.widgetTimerPreferences]);
  const saveWidgetAppearance = (patch: Parameters<typeof normalizeWidgetAppearance>[0]) => onSave({
    widgetAppearance: normalizeWidgetAppearance({ ...widgetAppearance, ...patch }),
    widgetAppearanceMigrated: true,
  });
  const saveWidgetThemeColor = (theme: "light" | "dark", patch: Partial<typeof widgetAppearance.light>) => saveWidgetAppearance({
    [theme]: { ...widgetAppearance[theme], ...patch },
  });
  const updateWidgetTimerDraft = (patch: Partial<typeof widgetTimerDraft>) => setWidgetTimerDraft(normalizeWidgetTimerPreferences({ ...widgetTimerDraft, ...patch }));
  // Force a re-render of the plugin list when activation state changes (the
  // registry holds state outside React).
  const [, setPluginRefreshTick] = useState(0);

  function togglePlugin(pluginId: string) {
    const list = settings.enabledPlugins ?? [];
    const enabled = list.includes(pluginId);
    const next = enabled ? list.filter((id) => id !== pluginId) : [...list, pluginId];
    onSave({ enabledPlugins: next });
  }

  function openPluginConfig(pluginId: string) {
    const plugin = listRegisteredPlugins().find((p) => p.id === pluginId);
    if (!plugin) return;
    const resolved = resolvePluginConfig(plugin, settings.pluginConfigs?.[pluginId]);
    setPluginConfigDraft(resolved);
    setPluginConfigDialogId(pluginId);
  }

  function savePluginConfigField(key: string, value: unknown) {
    setPluginConfigDraft((prev) => ({ ...prev, [key]: value }));
  }

  function commitPluginConfig() {
    if (!pluginConfigDialogId) return;
    const plugin = listRegisteredPlugins().find((item) => item.id === pluginConfigDialogId);
    if (!plugin) return;
    const existing = settings.pluginConfigs?.[pluginConfigDialogId] ?? {};
    const normalized = resolvePluginConfig(plugin, pluginConfigDraft);
    const merged = plugin.source === "external" ? normalized : { ...existing, ...normalized };
    const nextConfigs = { ...(settings.pluginConfigs ?? {}), [pluginConfigDialogId]: merged };
    onSave({ pluginConfigs: nextConfigs });
    setPluginConfigDialogId(null);
    setPluginConfigDraft({});
    setPluginRefreshTick((n) => n + 1);
  }

  const defaultAccent = settings.theme === "dark" ? "#EEE9DF" : "#27231E";
  const selectedAccent = settings.executeAccentColor || settings.planningAccentColor || defaultAccent;
  const accentPresets = [...(settings.theme === "dark" ? EXECUTE_THEME_PRESETS_DARK : EXECUTE_THEME_PRESETS_LIGHT), defaultAccent];
  const accentOptions = [selectedAccent, ...accentPresets.filter((color) => color.toUpperCase() !== selectedAccent.toUpperCase())];
  const shortcutGroups = groupShortcutsByScope(SHORTCUTS);
  const shortcutScopeLabel = (scope: ShortcutScope) => {
    if (lang === "zh") {
      if (scope === "global") return "全局";
      if (scope === "timeline") return "时间轴";
      if (scope === "mode") return "模式";
      return "计时";
    }
    if (scope === "global") return "Global";
    if (scope === "timeline") return "Timeline";
    if (scope === "mode") return "Mode";
    return "Timer";
  };
  const visibleMemories = (data.aiMemories || [])
    .filter((memory) => !memory.archived)
    .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt));
  const saveMemory = (memoryId: string, patch: Partial<AiMemory>) => {
    const now = workspaceNow().toISOString();
    onSaveData({
      ...data,
      aiMemories: (data.aiMemories || []).map((memory) => memory.id === memoryId ? { ...memory, ...patch, updatedAt: now } : memory),
    });
  };
  const addManualMemory = () => {
    const now = workspaceNow().toISOString();
    onSaveData({
      ...data,
      aiMemories: [
        ...(data.aiMemories || []),
        { id: uid("memory"), content: lang === "zh" ? "新的 AI 记忆" : "New AI memory", tags: ["manual"], source: "manual", createdAt: now, updatedAt: now, pinned: false, archived: false },
      ],
    });
  };

  const importDataFromJson = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      if (!isImportFileSizeAllowed(file.size, "backup")) {
        alert(lang === "zh" ? "备份文件超过 20 MB 限制。" : "Backup file exceeds the 20 MB limit.");
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const content = event.target?.result as string;
          const backup = parsePlannerBackupJson(content);
          onSaveData(preparePlannerDataRestore(backup.data, data));
          onSave(backup.settings);
          alert(lang === "zh" ? "数据导入成功！" : "Data imported successfully!");
        } catch {
          alert(lang === "zh" ? "数据导入失败，无法解析文件。" : "Import failed: unable to parse file.");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const importTasksFromCsv = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv,text/csv";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      if (!isImportFileSizeAllowed(file.size, "tasks")) {
        alert(lang === "zh" ? "CSV 文件超过 10 MB 限制。" : "CSV file exceeds the 10 MB limit.");
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const content = event.target?.result as string;
          const tasks = parseTasksCsv(content, data.projects);
          if (tasks.length === 0) {
            alert(lang === "zh" ? "数据导入失败，文件为空或格式不正确。" : "Import failed: file is empty or invalid.");
            return;
          }

          // Merge imported tasks with existing tasks
          const existingIds = new Set(data.tasks.map((t) => t.id));
          const newTasks = tasks.filter((t) => !existingIds.has(t.id));
          onSaveData({
            ...data,
            tasks: [...data.tasks, ...newTasks],
          });
          alert(lang === "zh" ? `成功导入 ${newTasks.length} 个任务！` : `Successfully imported ${newTasks.length} tasks!`);
        } catch {
          alert(lang === "zh" ? "数据导入失败，无法解析文件。" : "Import failed: unable to parse file.");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };
  const uploadAvatar = async (file?: File) => {
    if (!file) return;
    try {
      const {
        ACCEPTED_RASTER_MIME_TYPES,
        MAX_AVATAR_FILE_BYTES,
        assertSafeRasterDimensions,
      } = await import("./imageSafety");
      if (!ACCEPTED_RASTER_MIME_TYPES.has(file.type) || file.size > MAX_AVATAR_FILE_BYTES) {
        alert(lang === "zh" ? "请选择不超过 5 MB 的 PNG、JPEG 或 WebP 图片。" : "Choose a PNG, JPEG, or WebP image up to 5 MB.");
        return;
      }
      assertSafeRasterDimensions(await file.arrayBuffer());
      const image = await createImageBitmap(file);
      try {
        const size = 256;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext("2d");
        if (!context) return;
        const scale = Math.max(size / image.width, size / image.height);
        const width = image.width * scale;
        const height = image.height * scale;
        context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
        try { await onSaveProfile({ avatarDataUrl: canvas.toDataURL("image/jpeg", .82) }); setProfileNameError(""); } catch { setProfileNameError(lang === "zh" ? "头像保存失败，请重试。" : "Could not save your avatar. Please try again."); }
      } finally {
        image.close();
      }
    } catch {
      alert(lang === "zh" ? "图片无效或像素尺寸过大。" : "The image is invalid or its pixel dimensions are too large.");
    }
  };
  const requestProactiveLocation = () => {
    if (!navigator.geolocation) {
      alert(lang === "zh" ? "此设备不支持定位服务。" : "Location is not supported on this device.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => onSave({
        proactiveAssistantLocation: {
          latitude: Math.round(position.coords.latitude * 10_000) / 10_000,
          longitude: Math.round(position.coords.longitude * 10_000) / 10_000,
          capturedAt: workspaceNow().toISOString(),
        },
      }),
      () => alert(lang === "zh" ? "未获得定位权限；晨间简报会跳过天气建议。" : "Location permission was not granted; morning briefs will skip weather."),
      { enableHighAccuracy: false, maximumAge: 24 * 60 * 60_000, timeout: 10_000 },
    );
  };
  const profileHero = (
<section className="df-settings-profile-hero" aria-label={lang === "zh" ? "当前账户" : "Current account"}>
              <label className="df-settings-avatar" title={lang === "zh" ? "点击编辑头像" : "Click to edit avatar"}>
                {settings.avatarDataUrl ? <img src={settings.avatarDataUrl} alt="" /> : <span>{(settings.displayName || "N").slice(0, 1).toUpperCase()}</span>}
                <span className="df-settings-avatar-edit" aria-hidden="true"><UiPencilIcon size={12} strokeWidth={2} /></span>
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { void uploadAvatar(event.target.files?.[0]); event.currentTarget.value = ""; }} />
              </label>
              <div className="df-settings-profile-hero-copy">
                {profileNameEditing ? <input className="df-settings-profile-name-input" value={profileNameDraft} onChange={(event) => setProfileNameDraft(event.target.value)} onBlur={() => { void commitProfileName(); }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void commitProfileName(); } if (event.key === "Escape") { setProfileNameDraft(settings.displayName || ""); setProfileNameError(""); setProfileNameEditing(false); } }} disabled={profileNameSaving} autoFocus maxLength={64} aria-label={lang === "zh" ? "用户名" : "Username"} /> : <button type="button" className="df-settings-profile-name" onClick={() => { setProfileNameError(""); setProfileNameEditing(true); }} aria-label={lang === "zh" ? "编辑用户名" : "Edit username"}>
                  <strong>{settings.displayName || (lang === "zh" ? "NavoPath 用户" : "NavoPath user")}</strong>
                  <UiPencilIcon size={13} strokeWidth={1.8} aria-hidden="true" />
                </button>}
                {authEmail && <span>{authEmail}</span>}
                {profileNameError && <span className="df-settings-profile-error" role="alert">{profileNameError}</span>}
              </div>
                </section>
  );
  return (
    <>
      <div className="df-utility-backdrop" onMouseDown={onClose} />
      <aside className="df-utility-panel" role="dialog" aria-modal="true" aria-labelledby="df-utility-title">
        <MobileSheetDismissHandle onDismiss={onClose} lang={lang} />
        <div className="df-utility-head">
          <div className="df-utility-head-leading">
            {kind === "settings" && compactLayout && !settingsHome && <button type="button" className="df-settings-back-button" onClick={backToSettingsHome} aria-label={lang === "zh" ? "返回设置" : "Back to settings"}><span aria-hidden="true">‹</span><span>{lang === "zh" ? "设置" : "Settings"}</span></button>}
            <h2 id="df-utility-title">{kind === "settings" && !settingsHome ? settingsCategoryLabel(settingsTarget.category, lang) : kind === "settings" ? t(lang, "settings.settings") : t(lang, "settings.aboutNavo")}</h2>
          </div>
          <CloseButton ref={closeButtonRef} label={t(lang, "settings.close")} onClick={onClose} />
        </div>
        {kind === "settings" ? (
          <div className={`df-utility-body df-settings-shell${settingsHome ? "" : " df-settings-detail-shell"}`}>
            {settingsHome ? (
              <div className="df-settings-home">
                {profileHero}
                {!compactLayout && <section className="df-settings-home-card df-settings-home-notification-card">
                  <button type="button" className="df-settings-home-entry" onClick={openNotifications}>
                    <span className="df-settings-home-entry-icon"><UiBellIcon size={19} strokeWidth={1.8} /></span>
                    <span className="df-settings-home-entry-copy">
                      <strong>{lang === "zh" ? "通知" : "Notifications"}</strong>
                      <small>{lang === "zh" ? "查看 Navo AI 的主动提醒与未读消息。" : "View proactive Navo AI reminders and unread messages."}</small>
                    </span>
                    <span className="df-settings-home-entry-chevron" aria-hidden="true">›</span>
                  </button>
                </section>}
                <section className="df-settings-home-group" aria-labelledby="df-settings-quick-title">
                  <header className="df-settings-home-heading">
                    <h3 id="df-settings-quick-title">{lang === "zh" ? "快速设置" : "Quick settings"}</h3>
                    <p>{lang === "zh" ? "常用选项可直接在这里调整。" : "Adjust the options you use most, right here."}</p>
                  </header>
                  <div className="df-settings-home-card df-settings-home-quick-card">
                    <div className="df-settings-home-quick-row">
                      <div className="df-settings-home-quick-label"><UiPencilIcon size={19} strokeWidth={1.8} /><span>{lang === "zh" ? "界面模式" : "Appearance"}</span></div>
                      <SettingSelect<Settings["theme"]>
                        value={settings.theme}
                        ariaLabel={lang === "zh" ? "界面模式" : "Appearance"}
                        onChange={(value) => onSave({ theme: value })}
                        options={[{ value: "light", label: t(lang, "settings.light") }, { value: "dark", label: t(lang, "settings.dark") }]}
                      />
                    </div>
                    {settings.theme !== "dark" && <div className="df-settings-home-quick-row df-settings-home-quick-row--accent">
                      <div className="df-settings-home-quick-label"><UiCopyIcon size={19} strokeWidth={1.8} /><span>{lang === "zh" ? "强调色" : "Accent color"}</span></div>
                      <div className="df-settings-accent-native">
                        <span className="df-settings-accent-dot" style={{ backgroundColor: selectedAccent }} />
                        <SettingSelect<string>
                          value={selectedAccent}
                          ariaLabel={lang === "zh" ? "强调色" : "Accent color"}
                          onChange={(color) => onSave({ executeAccentColor: color, planningAccentColor: color })}
                          options={accentOptions.map((color) => ({ value: color, label: ACCENT_COLOR_NAMES[color.toUpperCase()]?.[lang === "zh" ? 0 : 1] || color }))}
                        />
                        <span className="df-settings-accent-arrows" aria-hidden="true"><span>⌃</span><span>⌄</span></span>
                      </div>
                    </div>}
                    <div className="df-settings-home-quick-row">
                      <div className="df-settings-home-quick-label"><UiBellIcon size={19} strokeWidth={1.8} /><span>{lang === "zh" ? "语言" : "Language"}</span></div>
                      <SettingSelect<Language>
                        value={settings.language || lang}
                        ariaLabel={lang === "zh" ? "语言" : "Language"}
                        onChange={(value) => onSave({ language: value })}
                        options={[{ value: "zh", label: "中文" }, { value: "en", label: "English" }]}
                      />
                    </div>
                  </div>
                </section>
                <section className="df-settings-home-group" aria-labelledby="df-settings-sections-title">
                  <header className="df-settings-home-heading">
                    <h3 id="df-settings-sections-title">{lang === "zh" ? "设置" : "Settings"}</h3>
                    <p>{lang === "zh" ? "打开一个分区，查看全部相关选项。" : "Open a section to see all related options."}</p>
                  </header>
                  <div className="df-settings-home-card df-settings-home-detail-card">
                    {SETTINGS_CATEGORIES.filter((category) => category.id !== "widget" || isDesktopRuntime).map((category) => (
                      <button type="button" className="df-settings-home-entry" key={category.id} onClick={() => navigateSettings({ category: category.id })}>
                        <span className="df-settings-home-entry-icon"><SettingsCategoryIcon category={category.id} /></span>
                        <span className="df-settings-home-entry-copy">
                          <strong>{lang === "zh" ? category.labelZh : category.labelEn}</strong>
                          <small>{settingsCategoryDescription(category.id, lang, settings.theme === "dark")}</small>
                        </span>
                        <span className="df-settings-home-entry-chevron" aria-hidden="true">›</span>
                      </button>
                    ))}
                  </div>
                </section>
              </div>
            ) : <>
            <div className="df-settings-rail">
              <nav className="df-settings-nav ui-choice-list" aria-label={lang === "zh" ? "设置分区" : "Settings sections"}>
                {SETTINGS_CATEGORIES.filter((category) => category.id !== "widget" || isDesktopRuntime).map((category) => (
                  <button type="button" key={category.id} className={`ui-choice-item${settingsTarget.category === category.id ? " active" : ""}`} aria-current={settingsTarget.category === category.id ? "page" : undefined} onClick={() => navigateSettings({ category: category.id })}>{lang === "zh" ? category.labelZh : category.labelEn}</button>
                ))}
              </nav>
            </div>
            <div ref={settingsContentRef} className="df-settings-content">
            {settingsTarget.category === "general" && <SettingSection anchor="general-basics" title={lang === "zh" ? "基础" : "Basics"} description={lang === "zh" ? "语言、时间边界与通知显示。" : "Language, time boundary, and notification display."}>
              <SettingRow
                anchor="language"
                title={lang === "zh" ? "语言" : "Language"}
                control={<SettingSelect<Language>
                  value={settings.language || lang}
                  ariaLabel={lang === "zh" ? "语言" : "Language"}
                  onChange={(value) => onSave({ language: value })}
                  options={[
                    { value: "zh", label: "中文" },
                    { value: "en", label: "English" },
                  ]}
                />}
              />
              <SettingRow
                anchor="day-start"
                title={lang === "zh" ? "一天开始时间" : "Day start time"}
                description={lang === "zh" ? "决定时间轴的起始分界，影响跨天滚动与统计范围。" : "Sets the boundary used by the timeline, cross-day scroll, and metric ranges."}
                control={<SettingTextInput type="time" value={settings.dayStartTime || "00:00"} ariaLabel={lang === "zh" ? "一天开始时间" : "Day start time"} onChange={(value) => onSave({ dayStartTime: value })} />}
              />
              <SettingRow
                anchor="notification-badge"
                title={lang === "zh" ? "应用内通知角标" : "In-app notification badge"}
                description={lang === "zh" ? "显示通知入口的未读数量。关闭后仍可在通知中心查看通知。" : "Show the unread count on the notification control. Notifications remain available in the notification center when hidden."}
                control={<SettingToggle checked={settings.showInAppNotificationBadge !== false} ariaLabel={lang === "zh" ? "应用内通知角标" : "In-app notification badge"} onChange={(next) => onSave({ showInAppNotificationBadge: next })} />}
              />
            </SettingSection>}

            {settingsTarget.category === "appearance" && <SettingSection title={lang === "zh" ? "外观" : "Appearance"} description={settings.theme === "dark"
              ? (lang === "zh" ? "深色模式使用柔和白色交互高亮；已保存的强调色会在浅色模式下继续生效。" : "Dark mode uses a softened white interaction accent. Your saved accent returns in light mode.")
              : (lang === "zh" ? "纸面风格、字体与克制的点缀色。" : "Paper surface, typography, and restrained accent color.")}>
              <SettingRow
                anchor="theme"
                title={t(lang, "settings.uiMode")}
                control={<SettingSelect<Settings["theme"]>
                  value={settings.theme}
                  ariaLabel={t(lang, "settings.uiMode")}
                  onChange={(value) => onSave({ theme: value })}
                  options={[
                    { value: "light", label: t(lang, "settings.light") },
                    { value: "dark", label: t(lang, "settings.dark") },
                  ]}
                />}
              />
              <SettingRow
                anchor="typography"
                title={lang === "zh" ? "字体风格" : "Typography"}
                control={<SettingSelect<Settings["typographyStyle"]>
                  value={settings.typographyStyle || "editorial"}
                  ariaLabel={lang === "zh" ? "字体风格" : "Typography"}
                  onChange={(value) => onSave({ typographyStyle: value })}
                  options={[
                    { value: "editorial", label: lang === "zh" ? "编辑衬线" : "Editorial Serif" },
                    { value: "balanced", label: lang === "zh" ? "平衡混排" : "Balanced" },
                    { value: "sans", label: lang === "zh" ? "现代无衬线" : "Modern Sans" },
                  ]}
                />}
              />
              <SettingRow
                anchor="timeline-font"
                title={lang === "zh" ? "时间轴字体大小" : "Timeline font size"}
                description={lang === "zh" ? "调整时间轴任务标题字号。" : "Scale the timeline task title font size."}
                control={
                  <span className="df-settings-number-wrap">
                    <input
                      type="range"
                      className="df-settings-range"
                      min={0.85}
                      max={1.3}
                      step={0.05}
                      value={settings.timelineFontScale ?? 1}
                      aria-label={lang === "zh" ? "时间轴字体大小" : "Timeline font size"}
                      onChange={(event) => onSave({ timelineFontScale: Number(event.target.value) })}
                    />
                    <span className="df-settings-number-suffix">{Math.round((settings.timelineFontScale ?? 1) * 100)}%</span>
                  </span>
                }
              />
              {settings.theme !== "dark" && <div className="df-settings-accent-colors" data-settings-anchor="accent-colors" tabIndex={-1}>
                <SettingDescription>{lang === "zh" ? "点缀色用于细线、勾选与当前时间标记，不会作为大面积填充。" : "Accent colors are used for fine rules, checks, and the current-time marker, never as dominant fills."}</SettingDescription>
                <div className="df-settings-accent-row">
                  <ThemeAccentSetting
                    label={lang === "zh" ? "强调色" : "Accent color"}
                    presets={EXECUTE_THEME_PRESETS_LIGHT}
                    value={selectedAccent}
                    onChange={(color) => onSave({ executeAccentColor: color, planningAccentColor: color })}
                  />
                </div>
              </div>}
            </SettingSection>}

            {settingsTarget.category === "general" && <SettingSection anchor="execution-defaults" title={lang === "zh" ? "执行默认项" : "Execution defaults"} description={lang === "zh" ? "时间轴与完成任务的默认行为。" : "Default timeline and completed-task behavior."}>
              <SettingRow
                anchor="default-timeline"
                title={lang === "zh" ? "默认时间轴视图" : "Default timeline view"}
                control={<SettingSelect<NonNullable<Settings["defaultTimelineView"]>>
                  value={settings.defaultTimelineView || "daily"}
                  ariaLabel={lang === "zh" ? "默认时间轴视图" : "Default timeline view"}
                  onChange={(value) => onSave({ defaultTimelineView: value })}
                  options={[
                    { value: "daily", label: viewLabel(lang, "daily") },
                    { value: "3day", label: viewLabel(lang, "3day") },
                    { value: "weekly", label: viewLabel(lang, "weekly") },
                    { value: "month", label: viewLabel(lang, "month") },
                  ]}
                />}
              />
              <SettingRow
                anchor="continuous-scroll"
                title={lang === "zh" ? "开启无限跨天滚动" : "Continuous cross-day scroll"}
                description={lang === "zh" ? "时间轴可连续滚动到前后日期。" : "The timeline scrolls continuously across days."}
                control={<SettingToggle checked={settings.continuousCrossDayScroll !== false} ariaLabel={lang === "zh" ? "无限跨天滚动" : "Continuous cross-day scroll"} onChange={(next) => onSave({ continuousCrossDayScroll: next })} />}
              />
              <SettingRow
                anchor="hide-completed"
                title={t(lang, "settings.hideCompleted")}
                description={lang === "zh" ? "在时间轴上隐藏已完成任务。" : "Hide completed tasks from the timeline."}
                control={<SettingToggle checked={Boolean(settings.hideCompleted)} ariaLabel={t(lang, "settings.hideCompleted")} onChange={(next) => onSave({ hideCompleted: next })} />}
              />
            </SettingSection>}

            {settingsTarget.category === "workflow" && <SettingSection anchor="planning-views" title={lang === "zh" ? "规划视图" : "Planning views"} description={lang === "zh" ? "选择规划页中可用的组织方式。" : "Choose the organization views available on Planning."}>
              <SettingRow
                title={lang === "zh" ? "启用看板视图" : "Enable Kanban view"}
                control={<SettingToggle checked={settings.featureKanbanViewEnabled !== false} ariaLabel={lang === "zh" ? "启用看板视图" : "Enable Kanban view"} onChange={(next) => onSave({ featureKanbanViewEnabled: next })} />}
              />
              <SettingRow
                title={lang === "zh" ? "启用四象限视图" : "Enable Eisenhower matrix view"}
                control={<SettingToggle checked={settings.featureQuadrantViewEnabled !== false} ariaLabel={lang === "zh" ? "启用四象限视图" : "Enable Eisenhower matrix view"} onChange={(next) => onSave({ featureQuadrantViewEnabled: next })} />}
              />
              <SettingRow
                title={lang === "zh" ? "启用列表视图" : "Enable list view"}
                control={<SettingToggle checked={settings.featureListViewEnabled !== false} ariaLabel={lang === "zh" ? "启用列表视图" : "Enable list view"} onChange={(next) => onSave({ featureListViewEnabled: next })} />}
              />
            </SettingSection>}

            {settingsTarget.category === "workflow" && <SettingSection anchor="smart-scheduling" title={lang === "zh" ? "智能排程" : "Smart scheduling"} description={lang === "zh" ? "定义自动排程使用的工作时段与任务间隔。" : "Define the working window and task spacing used by automatic scheduling."}>
              <SettingRow
                anchor="schedule-start"
                title={lang === "zh" ? "规划开始" : "Planning starts"}
                control={<SettingTextInput type="time" value={settings.scheduleDayStartTime || "08:00"} ariaLabel={lang === "zh" ? "规划开始" : "Planning starts"} onChange={(value) => onSave({ scheduleDayStartTime: value })} />}
              />
              <SettingRow
                anchor="schedule-end"
                title={lang === "zh" ? "规划结束" : "Planning ends"}
                control={<SettingTextInput type="time" value={settings.dayEndTime || "22:00"} ariaLabel={lang === "zh" ? "规划结束" : "Planning ends"} onChange={(value) => onSave({ dayEndTime: value })} />}
              />
              <SettingRow
                anchor="schedule-buffer"
                title={lang === "zh" ? "任务缓冲" : "Task buffer"}
                description={lang === "zh" ? "自动排程在相邻任务间预留的时间。" : "Time reserved between adjacent automatically scheduled tasks."}
                control={<SettingNumberInput value={settings.scheduleBufferMinutes ?? 5} min={0} max={60} step={5} suffix={lang === "zh" ? "分钟" : "min"} ariaLabel={lang === "zh" ? "任务缓冲" : "Task buffer"} onChange={(value) => onSave({ scheduleBufferMinutes: Math.max(0, Math.min(60, value)) })} />}
              />
            </SettingSection>}

            {settingsTarget.category === "workflow" && <SettingSection anchor="templates" title={lang === "zh" ? "模板" : "Templates"} description={lang === "zh" ? "把可复用的时间段模板应用到今天。" : "Apply reusable time-block templates to today."}>
              <SettingRow
                title={lang === "zh" ? "启用模板功能" : "Enable templates"}
                description={lang === "zh" ? "关闭后隐藏今日候选顶栏的「模板」入口。" : "When off, the Templates button in the today-candidate header is hidden."}
                control={<SettingToggle checked={settings.featureTemplatesEnabled !== false} ariaLabel={lang === "zh" ? "启用模板功能" : "Enable templates"} onChange={(next) => onSave({ featureTemplatesEnabled: next })} />}
              />
              <SettingRow
                title={lang === "zh" ? "管理模板" : "Manage templates"}
                description={lang === "zh" ? "打开模板编辑弹窗，新建或编辑时间段模板。" : "Open the template editor to create or edit time-block templates."}
                control={<SettingActionButton onClick={() => onOpenScheduleTemplates?.()} disabled={!onOpenScheduleTemplates}>{lang === "zh" ? "打开模板" : "Open templates"}</SettingActionButton>}
              />
            </SettingSection>}

            {settingsTarget.category === "workflow" && <SettingSection anchor="habits" title={lang === "zh" ? "习惯" : "Habits"} description={lang === "zh" ? "每日 / 每周重复行为的开关与显示。" : "Toggles and visibility for daily / weekly recurring behaviors."}>
              <SettingRow
                title={lang === "zh" ? "启用习惯功能" : "Enable habits"}
                description={lang === "zh" ? "关闭后隐藏今日候选中的习惯区与习惯入口。" : "When off, the habits area in today's candidates and habit entries are hidden."}
                control={<SettingToggle checked={settings.featureHabitsEnabled !== false} ariaLabel={lang === "zh" ? "启用习惯功能" : "Enable habits"} onChange={(next) => onSave({ featureHabitsEnabled: next })} />}
              />
              <SettingRow
                title={lang === "zh" ? "在今日候选中显示习惯区" : "Show habits in today's candidates"}
                description={lang === "zh" ? "关闭后仅隐藏今日候选中的习惯区，保留习惯功能和数据。" : "When off, only hides the habits area in today's candidates; habit features and data stay available."}
                control={<SettingToggle checked={settings.featureHabitCandidatesEnabled !== false} disabled={settings.featureHabitsEnabled === false} ariaLabel={lang === "zh" ? "在今日候选中显示习惯区" : "Show habits in today's candidates"} onChange={(next) => onSave({ featureHabitCandidatesEnabled: next })} />}
              />
              <SettingRow
                title={lang === "zh" ? "习惯是否计入指标" : "Include habits in metrics"}
                description={lang === "zh" ? "控制指标页是否统计习惯时间。" : "Control whether metrics include habit time."}
                control={<SettingSelect<NonNullable<Settings["metricsIncludeHabits"]>>
                  value={settings.metricsIncludeHabits || "include"}
                  ariaLabel={lang === "zh" ? "习惯是否计入指标" : "Include habits in metrics"}
                  onChange={(value) => onSave({ metricsIncludeHabits: value })}
                  options={[
                    { value: "include", label: lang === "zh" ? "计入" : "Include" },
                    { value: "exclude", label: lang === "zh" ? "排除" : "Exclude" },
                    { value: "only", label: lang === "zh" ? "仅习惯" : "Habits only" },
                  ]}
                />}
              />
            </SettingSection>}

            {settingsTarget.category === "workflow" && <SettingSection anchor="engagement" title={lang === "zh" ? "投入度评分" : "Engagement rating"}>
              <SettingRow
                title={lang === "zh" ? "启用投入度评分" : "Enable engagement rating"}
                description={lang === "zh" ? "完成后评 10–100%，默认 80%。点击百分比快速选择；左侧色条长度表示投入度，统计时长按评分计算。" : "Rate completed work 10–100%, default 80%. Click the percentage to choose. Left stripe length shows engagement; time is weighted by rating."}
                control={<SettingToggle checked={settings.featureEngagementEnabled === true} ariaLabel={lang === "zh" ? "启用投入度评分" : "Enable engagement rating"} onChange={(next) => onSave({ featureEngagementEnabled: next })} />}
              />
            </SettingSection>}

            {settingsTarget.category === "workflow" && <SettingSection anchor="metrics" title={lang === "zh" ? "指标" : "Metrics"} description={lang === "zh" ? "规划页指标视图的默认范围与分组。" : "Default range and grouping for the planning-page metrics view."}>
              <SettingRow
                title={lang === "zh" ? "启用指标视图" : "Enable metrics view"}
                description={lang === "zh" ? "关闭后隐藏规划页的「指标」视图入口。" : "When off, the Metrics entry in the planning view switcher is hidden."}
                control={<SettingToggle checked={settings.featureMetricsEnabled !== false} ariaLabel={lang === "zh" ? "启用指标视图" : "Enable metrics view"} onChange={(next) => onSave({ featureMetricsEnabled: next })} />}
              />
              <SettingRow
                title={lang === "zh" ? "默认时间范围" : "Default time range"}
                control={<SettingSelect<NonNullable<Settings["metricsRangePreset"]>>
                  value={settings.metricsRangePreset || "today"}
                  ariaLabel={lang === "zh" ? "默认时间范围" : "Default time range"}
                  onChange={(value) => onSave({ metricsRangePreset: value })}
                  options={[
                    { value: "today", label: lang === "zh" ? "今天" : "Today" },
                    { value: "thisWeek", label: lang === "zh" ? "本周" : "This week" },
                    { value: "thisMonth", label: lang === "zh" ? "本月" : "This month" },
                    { value: "all", label: lang === "zh" ? "全部" : "All time" },
                  ]}
                />}
              />
              <SettingRow
                title={lang === "zh" ? "默认分组" : "Default grouping"}
                control={<SettingSelect<NonNullable<Settings["metricsGroupBy"]>>
                  value={settings.metricsGroupBy || "project"}
                  ariaLabel={lang === "zh" ? "默认分组" : "Default grouping"}
                  onChange={(value) => onSave({ metricsGroupBy: value })}
                  options={[
                    { value: "project", label: lang === "zh" ? "项目" : "Project" },
                    { value: "customCategory", label: lang === "zh" ? "自定义分类" : "Custom category" },
                    { value: "tag", label: lang === "zh" ? "标签" : "Tag" },
                    { value: "importance", label: lang === "zh" ? "重要程度" : "Importance" },
                    { value: "urgency", label: lang === "zh" ? "紧急程度" : "Urgency" },
                  ]}
                />}
              />
              <SettingRow
                title={lang === "zh" ? "默认显示指标" : "Default display metric"}
                control={<SettingSelect<NonNullable<Settings["metricsDisplayMetric"]>>
                  value={settings.metricsDisplayMetric || "percentage"}
                  ariaLabel={lang === "zh" ? "默认显示指标" : "Default display metric"}
                  onChange={(value) => onSave({ metricsDisplayMetric: value })}
                  options={[
                    { value: "percentage", label: lang === "zh" ? "占比" : "Percentage" },
                    { value: "duration", label: lang === "zh" ? "时长" : "Duration" },
                    { value: "taskCount", label: lang === "zh" ? "任务数" : "Task count" },
                    { value: "completionRate", label: lang === "zh" ? "完成率" : "Completion rate" },
                  ]}
                />}
              />
              <SettingRow
                title={lang === "zh" ? "习惯是否计入统计" : "Include habits in metrics"}
                control={<SettingSelect<NonNullable<Settings["metricsIncludeHabits"]>>
                  value={settings.metricsIncludeHabits || "include"}
                  ariaLabel={lang === "zh" ? "习惯是否计入统计" : "Include habits in metrics"}
                  onChange={(value) => onSave({ metricsIncludeHabits: value })}
                  options={[
                    { value: "include", label: lang === "zh" ? "计入" : "Include" },
                    { value: "exclude", label: lang === "zh" ? "排除" : "Exclude" },
                    { value: "only", label: lang === "zh" ? "仅习惯" : "Habits only" },
                  ]}
                />}
              />
              <SettingRow
                title={lang === "zh" ? "完成状态筛选" : "Completion filter"}
                control={<SettingSelect<NonNullable<Settings["metricsCompletionFilter"]>>
                  value={settings.metricsCompletionFilter || "all"}
                  ariaLabel={lang === "zh" ? "完成状态筛选" : "Completion filter"}
                  onChange={(value) => onSave({ metricsCompletionFilter: value })}
                  options={[
                    { value: "all", label: lang === "zh" ? "全部" : "All" },
                    { value: "completed", label: lang === "zh" ? "仅已完成" : "Completed only" },
                    { value: "incomplete", label: lang === "zh" ? "仅未完成" : "Incomplete only" },
                  ]}
                />}
              />
            </SettingSection>}

            {settingsTarget.category === "widget" && <SettingSection
              anchor="desktop-window-settings"
              title={lang === "zh" ? "桌面窗口" : "Desktop Windows"}
              description={Boolean(window.desktopApi?.widget || window.desktopApi?.compactWindow)
                ? (lang === "zh" ? "管理完整竖屏小窗与「正在做」小组件。" : "Manage the full portrait window and the current-task widget.")
                : (lang === "zh" ? "桌面端启用后可用。当前环境未检测到桌面端。" : "Available on the desktop build. No desktop runtime detected in this environment.")}
            >
              <SettingRow
                anchor="portrait-window"
                title={lang === "zh" ? "竖屏小窗" : "Portrait window"}
                description={lang === "zh" ? "在独立窗口中打开完整应用的竖屏布局，不影响「正在做」小组件。" : "Open the complete app in an independent portrait layout without affecting the current-task widget."}
                control={<><SettingActionButton disabled={!Boolean(window.desktopApi?.compactWindow)} onClick={() => { void window.desktopApi?.compactWindow?.open({ alwaysOnTop: settings.compactWindowAlwaysOnTop !== false }); }}>{lang === "zh" ? "打开" : "Open"}</SettingActionButton><SettingActionButton disabled={!Boolean(window.desktopApi?.compactWindow)} onClick={() => { void window.desktopApi?.compactWindow?.close(); }}>{lang === "zh" ? "关闭" : "Close"}</SettingActionButton></>}
              />
              <SettingRow
                title={lang === "zh" ? "竖屏小窗置顶" : "Portrait window always on top"}
                control={<SettingToggle checked={settings.compactWindowAlwaysOnTop !== false} disabled={!Boolean(window.desktopApi?.compactWindow)} ariaLabel={lang === "zh" ? "竖屏小窗置顶" : "Portrait window always on top"} onChange={(next) => { onSave({ compactWindowAlwaysOnTop: next }); void window.desktopApi?.compactWindow?.setAlwaysOnTop(next); }} />}
              />
              <SettingDivider />
              <SettingRow
                anchor="desktop-widget"
                title={lang === "zh" ? "启用桌面小组件" : "Enable desktop widget"}
                description={lang === "zh" ? "置顶小窗快速查看正在做与计时。" : "Always-on-top mini panel for the current task and timer."}
                control={<SettingToggle checked={settings.featureWidgetEnabled !== false} disabled={!Boolean(window.desktopApi?.widget)} ariaLabel={lang === "zh" ? "启用桌面小组件" : "Enable desktop widget"} onChange={(next) => onSave({ featureWidgetEnabled: next })} />}
              />
              <SettingRow
                title={lang === "zh" ? "启动时自动打开" : "Open widget on launch"}
                control={<SettingToggle checked={settings.widgetOpenOnLaunch === true} disabled={!Boolean(window.desktopApi?.widget)} ariaLabel={lang === "zh" ? "启动时自动打开" : "Open widget on launch"} onChange={(next) => onSave({ widgetOpenOnLaunch: next })} />}
              />
              <SettingRow
                title={lang === "zh" ? "始终置顶" : "Always on top"}
                control={<SettingToggle checked={settings.widgetAlwaysOnTop !== false} disabled={!Boolean(window.desktopApi?.widget)} ariaLabel={lang === "zh" ? "始终置顶" : "Always on top"} onChange={(next) => { onSave({ widgetAlwaysOnTop: next }); void window.desktopApi?.widget?.setAlwaysOnTop(next); }} />}
              />
              <SettingRow
                title={lang === "zh" ? "背景透明度" : "Background opacity"}
                description={lang === "zh" ? "只调整纸面背景，文字和计时始终清晰显示。" : "Adjusts only the paper background; text and timer remain visible."}
                control={<SettingNumberInput value={Math.round(widgetAppearance.opacity * 100)} min={0} max={100} step={1} suffix="%" ariaLabel={lang === "zh" ? "小组件背景透明度" : "Widget background opacity"} onChange={(value) => saveWidgetAppearance({ opacity: value / 100 })} />}
              />
              <SettingDivider />
              <SettingRow
                anchor="widget-font"
                title={lang === "zh" ? "字体" : "Font family"}
                control={<SettingSelect value={widgetAppearance.fontFamily} ariaLabel={lang === "zh" ? "小组件字体" : "Widget font family"} onChange={(fontFamily) => saveWidgetAppearance({ fontFamily })} options={[
                  { value: "system-ui, sans-serif", label: lang === "zh" ? "系统字体" : "System" },
                  { value: "Inter, system-ui, sans-serif", label: "Inter" },
                  { value: "Georgia, serif", label: lang === "zh" ? "衬线字体" : "Serif" },
                  { value: "ui-monospace, monospace", label: lang === "zh" ? "等宽字体" : "Monospace" },
                ]} />}
              />
              <SettingRow
                title={lang === "zh" ? "字号比例" : "Font scale"}
                control={<SettingNumberInput value={widgetAppearance.fontScale} min={0.5} max={2} step={0.05} suffix="×" ariaLabel={lang === "zh" ? "小组件字号比例" : "Widget font scale"} onChange={(fontScale) => saveWidgetAppearance({ fontScale })} />}
              />
              <SettingDivider />
              <div className="df-settings-subtabs ui-choice-list ui-choice-list--inline" role="tablist" aria-label={lang === "zh" ? "小组件外观主题" : "Widget appearance theme"}>
                {(["light", "dark"] as const).map((theme) => <button key={theme} type="button" role="tab" aria-selected={widgetThemeOpen === theme} className={`ui-choice-item${widgetThemeOpen === theme ? " active" : ""}`} onClick={() => setWidgetThemeOpen(theme)}>{theme === "light" ? (lang === "zh" ? "浅色" : "Light") : (lang === "zh" ? "深色" : "Dark")}</button>)}
              </div>
              {(() => {
                const theme = widgetThemeOpen;
                const themeName = theme === "light" ? (lang === "zh" ? "浅色" : "Light") : (lang === "zh" ? "深色" : "Dark");
                const colors = widgetAppearance[theme];
                return <div className="df-settings-theme-fields" data-settings-anchor={theme === "light" ? "widget-light" : "widget-dark"} tabIndex={-1}>
                  <SettingRow anchor={`widget-${theme}-background`} title={lang === "zh" ? `${themeName}背景` : `${themeName} background`} control={<SettingColorInput value={colors.backgroundColor} ariaLabel={lang === "zh" ? `${themeName}背景颜色` : `${themeName} background color`} onChange={(backgroundColor) => saveWidgetThemeColor(theme, { backgroundColor })} />} />
                  <SettingRow anchor={`widget-${theme}-text`} title={lang === "zh" ? `${themeName}文字` : `${themeName} text`} control={<SettingColorInput value={colors.fontColor} ariaLabel={lang === "zh" ? `${themeName}文字颜色` : `${themeName} text color`} onChange={(fontColor) => saveWidgetThemeColor(theme, { fontColor })} />} />
                  <SettingRow anchor={`widget-${theme}-timer`} title={lang === "zh" ? `${themeName}计时` : `${themeName} timer`} control={<SettingColorInput value={colors.timerColor} ariaLabel={lang === "zh" ? `${themeName}计时颜色` : `${themeName} timer color`} onChange={(timerColor) => saveWidgetThemeColor(theme, { timerColor })} />} />
                  <SettingRow anchor={`widget-${theme}-overrun`} title={lang === "zh" ? `${themeName}超时` : `${themeName} overrun`} control={<SettingColorInput value={colors.overrunColor} ariaLabel={lang === "zh" ? `${themeName}超时颜色` : `${themeName} overrun color`} onChange={(overrunColor) => saveWidgetThemeColor(theme, { overrunColor })} />} />
                </div>;
              })()}
              <SettingDivider />
              <SettingRow
                anchor="widget-timer"
                title={lang === "zh" ? "计时模式" : "Timer mode"}
                control={<SettingSelect value={widgetTimerDraft.mode} ariaLabel={lang === "zh" ? "小组件计时模式" : "Widget timer mode"} onChange={(mode) => updateWidgetTimerDraft({ mode })} options={[
                  { value: "stopwatch", label: lang === "zh" ? "正计时" : "Stopwatch" },
                  { value: "pomodoro", label: lang === "zh" ? "番茄钟" : "Pomodoro" },
                  { value: "countdown", label: lang === "zh" ? "倒计时" : "Countdown" },
                ]} />}
              />
              {widgetTimerDraft.mode === "pomodoro" && <>
                <SettingRow title={lang === "zh" ? "专注时长" : "Focus duration"} control={<SettingNumberInput value={widgetTimerDraft.focusMinutes} min={1} max={180} step={1} suffix={lang === "zh" ? "分钟" : "min"} ariaLabel={lang === "zh" ? "番茄钟专注时长" : "Pomodoro focus duration"} onChange={(focusMinutes) => updateWidgetTimerDraft({ focusMinutes })} />} />
                <SettingRow title={lang === "zh" ? "休息时长" : "Break duration"} control={<SettingNumberInput value={widgetTimerDraft.breakMinutes} min={1} max={60} step={1} suffix={lang === "zh" ? "分钟" : "min"} ariaLabel={lang === "zh" ? "番茄钟休息时长" : "Pomodoro break duration"} onChange={(breakMinutes) => updateWidgetTimerDraft({ breakMinutes })} />} />
                <SettingRow title={lang === "zh" ? "循环轮数" : "Pomodoro rounds"} control={<SettingNumberInput value={widgetTimerDraft.rounds} min={1} max={12} step={1} ariaLabel={lang === "zh" ? "番茄钟循环轮数" : "Pomodoro rounds"} onChange={(rounds) => updateWidgetTimerDraft({ rounds })} />} />
              </>}
              {widgetTimerDraft.mode === "countdown" && <SettingRow title={lang === "zh" ? "倒计时时长" : "Countdown duration"} control={<SettingNumberInput value={Math.round(widgetTimerDraft.countdownSeconds / 60)} min={1} max={1440} step={1} suffix={lang === "zh" ? "分钟" : "min"} ariaLabel={lang === "zh" ? "倒计时时长" : "Countdown duration"} onChange={(minutes) => updateWidgetTimerDraft({ countdownSeconds: minutes * 60 })} />} />}
              {widgetTimerDraft.mode === "stopwatch" && <SettingDescription>{lang === "zh" ? "正计时无需设置时长。" : "Stopwatch mode has no duration settings."}</SettingDescription>}
              <SettingRow
                title={lang === "zh" ? "计时器操作" : "Timer actions"}
                control={<><SettingActionButton onClick={() => setWidgetTimerDraft(widgetTimerSettings)}>{lang === "zh" ? "取消" : "Cancel"}</SettingActionButton><SettingActionButton onClick={() => onWidgetAction({ type: "resetWidgetTimer", draft: widgetTimerDraft })}>{lang === "zh" ? "重置计时器" : "Reset timer"}</SettingActionButton><SettingActionButton onClick={() => onWidgetAction({ type: "saveTimerSettings", draft: widgetTimerDraft })}>{lang === "zh" ? "保存" : "Save"}</SettingActionButton></>}
              />
              <SettingDivider />
              <SettingRow
                anchor="widget-reset"
                title={lang === "zh" ? "恢复默认外观" : "Restore default appearance"}
                control={<SettingActionButton onClick={() => onSave({ widgetAppearance: structuredClone(DEFAULT_WIDGET_APPEARANCE), widgetAppearanceMigrated: true })}>{lang === "zh" ? "恢复" : "Restore"}</SettingActionButton>}
              />
              <SettingRow
                title={lang === "zh" ? "重置位置与尺寸" : "Reset position and size"}
                description={lang === "zh" ? "恢复为 400 × 80，并放回屏幕内的默认位置。" : "Restore 400 × 80 and return the widget to its default on-screen position."}
                control={<SettingActionButton disabled={!Boolean(window.desktopApi?.widget)} onClick={() => { void window.desktopApi?.widget?.setBounds({ x: 80, y: 80, width: 400, height: 80 }); }}>{lang === "zh" ? "重置" : "Reset"}</SettingActionButton>}
              />
            </SettingSection>}
            {settingsTarget.category === "general" && <SettingSection anchor="general-help" title={lang === "zh" ? "帮助" : "Help"}>
              <SettingRow
                anchor="restart-onboarding"
                title={lang === "zh" ? "重新开始新手指南" : "Restart onboarding guide"}
                description={lang === "zh" ? "重新触发首次使用引导流程。" : "Re-trigger the first-run onboarding flow."}
                control={<SettingActionButton onClick={() => onSave({ onboardingVersion: 1, onboardingStep: "add" })}>{lang === "zh" ? "重新开始" : "Restart"}</SettingActionButton>}
              />
              <div className="df-settings-disclosure" data-settings-anchor="shortcuts" tabIndex={-1}>
                <button
                  type="button"
                  className="df-settings-disclosure-toggle"
                  aria-expanded={shortcutsOpen}
                  onClick={() => setShortcutsOpen((open) => !open)}
                >
                  <span><strong>{lang === "zh" ? "快捷键参考" : "Shortcut reference"}</strong><small>{lang === "zh" ? "查看固定快捷键" : "View fixed shortcuts"}</small></span>
                  <span aria-hidden="true">{shortcutsOpen ? "−" : "+"}</span>
                </button>
                {shortcutsOpen && <div className="df-settings-disclosure-body">
                  <p className="df-settings-desc">{lang === "zh" ? "本版本暂不支持自定义快捷键。" : "Custom shortcuts are not enabled in this version."}</p>
                  <div className="df-shortcut-reference">
                    {shortcutGroups.map((group) => (
                      <section key={group.scope} className="df-shortcut-group">
                        <h4>{shortcutScopeLabel(group.scope)}</h4>
                        <div className="df-shortcut-list">
                          {group.shortcuts.map((shortcut) => (
                            <div key={shortcut.id} className="df-shortcut-row">
                              <span>{lang === "zh" ? shortcut.labelZh : shortcut.labelEn}</span>
                              <kbd>{shortcut.keys.join(" / ")}</kbd>
                            </div>
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                </div>}
              </div>
            </SettingSection>}
            {settingsTarget.category === "ai" && <SettingSection title="Navo AI" description={lang === "zh" ? "模型由服务端网关自动路由；本地估时、分类与排程在 AI 不可用时仍可工作。" : "Models are routed by the server gateway; local estimation, classification, and scheduling still work when AI is unavailable."}>
              <SettingRow layout="stacked" anchor="ai-provider" title={lang === "zh" ? "AI 提供商与密钥" : "AI provider and key"} description={lang === "zh" ? "支持 DeepSeek、SiliconFlow、OpenAI、Anthropic、GLM 和通义千问。" : "Supports DeepSeek, SiliconFlow, OpenAI, Anthropic, GLM, and Qwen."} control={<AiProviderSettings lang={lang} onSave={onSave} />} />
              <SettingRow anchor="ai-reasoning" title={lang === "zh" ? "思考模式" : "Reasoning mode"} control={<SettingSelect value={settings.reasoningMode || "instant"} ariaLabel={lang === "zh" ? "思考模式" : "Reasoning mode"} onChange={(value) => onSave({ reasoningMode: value as Settings["reasoningMode"] })} options={[
                { value: "instant", label: lang === "zh" ? "即时" : "Instant" },
                ...reasoningModesForModel(settings.model).filter((mode) => mode === "high" || mode === "xhigh").map((mode) => ({ value: mode, label: mode === "xhigh" ? "Xhigh" : "High" })),
              ]} />} />
              <SettingRow anchor="ai-estimate" title={lang === "zh" ? "自动估算任务用时" : "Estimate task duration"} control={<SettingToggle checked={settings.autoEstimateTaskDuration !== false} ariaLabel={lang === "zh" ? "自动估算任务用时" : "Estimate task duration"} onChange={(next) => onSave({ autoEstimateTaskDuration: next })} />} />
              <SettingRow anchor="ai-project" title={lang === "zh" ? "自动归入项目" : "Auto-assign project"} description={lang === "zh" ? "仅在判断置信度较高时归入已有项目。" : "Assign to an existing project only at high confidence."} control={<SettingToggle checked={settings.autoAssignTaskProject !== false} ariaLabel={lang === "zh" ? "自动归入项目" : "Auto-assign project"} onChange={(next) => onSave({ autoAssignTaskProject: next })} />} />
              <SettingRow anchor="ai-briefs" title={lang === "zh" ? "每日开工与收工简报" : "Daily start and end briefs"} description={cloudReady ? (lang === "zh" ? "由云端按工作时间调度；应用关闭时邮件仍可送达，打开应用后收工复盘会追加到固定的每日复盘对话。简报只读。" : "Scheduled in the cloud using your work hours; morning email can arrive while the app is closed, and the end-of-day review is appended to the fixed Daily review conversation when you open the app. Briefs are read-only.") : (lang === "zh" ? "登录云端账号后可启用。" : "Sign in to a cloud account to enable briefs.")} control={<SettingToggle checked={Boolean(settings.aiBriefsEnabled)} disabled={!cloudReady} ariaLabel={lang === "zh" ? "每日 AI 简报" : "Daily AI briefs"} onChange={(next) => onSave({ aiBriefsEnabled: next })} />} />
              <SettingRow title={lang === "zh" ? "工作日开始" : "Workday starts"} description={lang === "zh" ? "云端在此时间生成开工简报并发送邮件（邮件开关开启时）。" : "The cloud creates the start brief here and emails it when email delivery is enabled."} control={<SettingTextInput type="time" value={settings.scheduleDayStartTime || "08:00"} disabled={!settings.aiBriefsEnabled || !cloudReady} ariaLabel={lang === "zh" ? "工作日开始时间" : "Workday start time"} onChange={(value) => onSave({ scheduleDayStartTime: value })} />} />
              <SettingRow title={lang === "zh" ? "工作日结束" : "Workday ends"} description={lang === "zh" ? "云端在此时间检查未完成任务，并生成每日复盘。" : "The cloud checks unfinished tasks and creates the daily review here."} control={<SettingTextInput type="time" value={settings.dayEndTime || "22:00"} disabled={!settings.aiBriefsEnabled || !cloudReady} ariaLabel={lang === "zh" ? "工作日结束时间" : "Workday end time"} onChange={(value) => onSave({ dayEndTime: value })} />} />
              <Suspense fallback={null}><ProactiveAssistantSettings settings={settings} data={data} lang={lang} cloudReady={Boolean(cloudReady)} onSave={onSave} onSaveData={onSaveData} onRequestLocation={requestProactiveLocation} /></Suspense>
              <SettingRow anchor="ai-memory" title={t(lang, "settings.allowAiContext")} description={lang === "zh" ? "启用后，下方才显示可参与上下文的记忆。" : "When enabled, memories available to context appear below."} control={<SettingToggle checked={Boolean(settings.aiMemoryEnabled)} ariaLabel={t(lang, "settings.allowAiContext")} onChange={(next) => onSave({ aiMemoryEnabled: next })} />} />
              <SettingRow anchor="hide-ai" title={t(lang, "settings.hideAllAi")} control={<SettingToggle checked={Boolean(settings.hideAi)} ariaLabel={t(lang, "settings.hideAllAi")} onChange={(next) => onSave({ hideAi: next })} />} />
              <SettingRow
                anchor="ai-reset"
                title={lang === "zh" ? "AI 数据操作" : "AI data actions"}
                description={lang === "zh" ? "重置个性化不会删除任务；清空对话只移除对话历史。" : "Resetting personalization keeps tasks; clearing conversations removes chat history only."}
                control={<><SettingActionButton onClick={() => { const now = workspaceNow().toISOString(); onSaveData({ ...data, aiProfile: { version: 1, updatedAt: now, historySince: now, durationByProject: {}, projectTokenWeights: {}, preferredStartHourByProject: {}, feedback: { durationCorrections: 0, projectCorrections: 0, assignmentUndos: 0, scheduleAccepts: 0, scheduleRejects: 0 } } }); }}>{lang === "zh" ? "重置个性化" : "Reset personalization"}</SettingActionButton><SettingActionButton disabled={(data.chat || []).length === 0} onClick={onClearChatHistory}>{lang === "zh" ? "清空对话" : "Clear conversations"}</SettingActionButton></>}
              />
              {Boolean(settings.aiMemoryEnabled) && <section className="df-ai-memory-settings" data-settings-anchor="ai-memory-list" tabIndex={-1}>
                <div className="df-ai-memory-settings-head">
                  <div><strong>{lang === "zh" ? "AI 记忆" : "AI memory"}</strong><small>{lang === "zh" ? `${visibleMemories.length} 条会参与上下文` : `${visibleMemories.length} available to context`}</small></div>
                  <button onClick={addManualMemory}>{lang === "zh" ? "新增" : "Add"}</button>
                </div>
                <div className="df-ai-memory-list">
                  {visibleMemories.length === 0 && <p className="df-ai-memory-empty">{lang === "zh" ? "还没有保存的记忆。可在这里新增，或从 AI 对话保存。" : "No saved memories yet. Add one here or save one from an AI conversation."}</p>}
                  {visibleMemories.map((memory) => (
                    <article key={memory.id} className={`df-ai-memory-item ${memory.pinned ? "pinned" : ""}`}>
                      <textarea value={memory.content} onChange={(event) => saveMemory(memory.id, { content: event.target.value })} />
                      <input value={(memory.tags || []).join(", ")} onChange={(event) => saveMemory(memory.id, { tags: event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean) })} placeholder="tags" />
                      {memory.sourceMessages && memory.sourceMessages.length > 0 && <small>{lang === "zh" ? `保存自 ${memory.sourceMessages.length} 条对话原文` : `Saved from ${memory.sourceMessages.length} messages`}</small>}
                      <div className="df-ai-memory-actions">
                        <span>{memory.source || "auto"}</span>
                        <button onClick={() => saveMemory(memory.id, { pinned: !memory.pinned })}>{memory.pinned ? (lang === "zh" ? "取消置顶" : "Unpin") : (lang === "zh" ? "置顶" : "Pin")}</button>
                        <button className="danger-lite" onClick={() => saveMemory(memory.id, { archived: true })}>{lang === "zh" ? "删除" : "Delete"}</button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>}
            </SettingSection>}
            {settingsTarget.category === "integrations" && <div className="df-settings-subtabs df-settings-integration-tabs ui-choice-list ui-choice-list--inline" role="tablist" aria-label={lang === "zh" ? "日历与集成" : "Calendar and integrations"}>
              <button type="button" role="tab" aria-selected={integrationTab === "calendar"} className={`ui-choice-item${integrationTab === "calendar" ? " active" : ""}`} onClick={() => { setIntegrationTab("calendar"); setSettingsTarget({ category: "integrations", anchor: "calendar-feed" }); }}>{lang === "zh" ? "日历订阅" : "Calendar"}</button>
              <button type="button" role="tab" aria-selected={integrationTab === "external-calendar"} className={`ui-choice-item${integrationTab === "external-calendar" ? " active" : ""}`} onClick={() => { setIntegrationTab("external-calendar"); setSettingsTarget({ category: "integrations", anchor: "external-calendar" }); }}>{lang === "zh" ? "外部日历" : "External"}</button>
              <button type="button" role="tab" aria-selected={integrationTab === "plugins"} className={`ui-choice-item${integrationTab === "plugins" ? " active" : ""}`} onClick={() => { setIntegrationTab("plugins"); setSettingsTarget({ category: "integrations", anchor: "plugins" }); }}>{lang === "zh" ? "插件" : "Plugins"}</button>
              <button type="button" role="tab" aria-selected={integrationTab === "mcp"} className={`ui-choice-item${integrationTab === "mcp" ? " active" : ""}`} onClick={() => { setIntegrationTab("mcp"); setSettingsTarget({ category: "integrations", anchor: "mcp" }); }}>MCP</button>
              <button type="button" role="tab" aria-selected={integrationTab === "sync"} className={`ui-choice-item${integrationTab === "sync" ? " active" : ""}`} onClick={() => { setIntegrationTab("sync"); setSettingsTarget({ category: "integrations", anchor: "sync-bridge" }); }}>{lang === "zh" ? "同步" : "Sync"}</button>
            </div>}
            {settingsTarget.category === "integrations" && integrationTab === "calendar" && <section className="df-settings-group" data-settings-anchor="calendar-feed" tabIndex={-1}><h3>{lang === "zh" ? "日历订阅" : "Calendar Subscription"}</h3><CalendarFeedManager lang={lang} /></section>}
            {settingsTarget.category === "integrations" && integrationTab === "external-calendar" && <section className="df-settings-group" data-settings-anchor="external-calendar" tabIndex={-1}><h3>{lang === "zh" ? "外部日历" : "External Calendars"}</h3><ExternalCalendarManager lang={lang} /></section>}
            {settingsTarget.category === "integrations" && integrationTab === "mcp" && <section className="df-settings-group" data-settings-anchor="mcp" tabIndex={-1}><h3>MCP</h3><Suspense fallback={<p className="df-mcp-status">{lang === "zh" ? "正在打开 MCP…" : "Opening MCP…"}</p>}><McpTokenManager lang={lang} /></Suspense></section>}
            {settingsTarget.category === "integrations" && integrationTab === "sync" && <section className="df-settings-group" data-settings-anchor="sync-bridge" tabIndex={-1}><h3>{lang === "zh" ? "同步" : "Sync"}</h3><Suspense fallback={null}><SyncBridgeManager lang={lang} /></Suspense></section>}
            {settingsTarget.category === "integrations" && integrationTab === "plugins" && <section className="df-settings-group" data-settings-anchor="plugins" tabIndex={-1}>
              <h3>{lang === "zh" ? "插件" : "Plugins"}</h3>
              <p className="df-settings-desc">{lang === "zh" ? "这里会显示随应用发布的内置插件，以及桌面端用户插件目录中经过校验的本地 manifest。本地插件可保存配置，但不会加载或执行 index.js 等目录脚本。" : "This list includes built-in plugins shipped with the app and validated local manifests from the desktop plugin directory. Local plugin configuration can be stored, but directory scripts such as index.js are not loaded or executed."}</p>

              <div className="df-settings-divider" />
              <div className="df-settings-subhead">{lang === "zh" ? "可用插件" : "Available plugins"}</div>

              <div className="df-plugin-list">
                {listRegisteredPlugins().map((plugin) => {
                  const enabled = Boolean(settings?.enabledPlugins?.includes(plugin.id));
                  const active = isPluginActive(plugin.id);
                  const externalManifest = plugin.source === "external";
                  return (
                    <div key={plugin.id} className={`df-plugin-card ${enabled ? "installed" : ""}`}>
                      <div className="df-plugin-icon">{plugin.icon}</div>
                      <div className="df-plugin-info">
                        <div className="df-plugin-header">
                          <strong className="df-plugin-name">{localizedPluginName(plugin, lang)}</strong>
                          <span className="df-plugin-version">v{plugin.version}</span>
                        </div>
                        <p className="df-plugin-desc">{localizedPluginDescription(plugin, lang)}</p>
                        <p className="df-plugin-enabled-summary">{localizedPluginEnabledSummary(plugin, lang)}</p>
                        <div className="df-plugin-meta">
                          <span className="df-plugin-author">{plugin.author}</span>
                          <span>{externalManifest ? (lang === "zh" ? "声明权限" : "Declared permissions") : (lang === "zh" ? "权限" : "Permissions")}: {plugin.permissions.join(", ")}</span>
                          {enabled && (
                            <span className="df-plugin-status">
                              {externalManifest
                                ? (lang === "zh" ? "配置已启用" : "Configuration enabled")
                                : active
                                  ? (lang === "zh" ? "运行中" : "Running")
                                  : (lang === "zh" ? "已启用，等待刷新" : "Enabled, refreshing")}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="df-plugin-actions">
                        {enabled ? (
                          <>
                            <button
                              type="button"
                              className="df-plugin-config"
                              onClick={() => openPluginConfig(plugin.id)}
                            >
                              {lang === "zh" ? "配置" : "Configure"}
                            </button>
                            <button
                              type="button"
                              className="df-plugin-uninstall"
                              onClick={() => togglePlugin(plugin.id)}
                            >
                              {lang === "zh" ? "停用" : "Disable"}
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="df-plugin-install"
                            onClick={() => togglePlugin(plugin.id)}
                          >
                            {lang === "zh" ? "启用" : "Enable"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="df-settings-divider" />
              <a className="df-plugin-doc-link" href="/plugin-guide">
                <span>{lang === "zh" ? "打开 Plugins / MCP 使用教程" : "Open Plugins / MCP guide"}</span>
                <small>{lang === "zh" ? "查看内置插件、本地插件、MCP 配置和安全边界" : "Read built-in plugins, local plugins, MCP setup, and security boundaries"}</small>
                <i aria-hidden="true">↗</i>
              </a>
              <div className="df-settings-divider" />
              <div className="df-settings-subhead">{lang === "zh" ? "已启用工具" : "Enabled tools"}</div>
              <PluginRuntimePanel settings={settings} data={data} onSave={onSave} onSaveData={onSaveData} lang={lang} />
            </section>}
            {!compactLayout && settingsTarget.category === "account-data" && <SettingSection anchor="account-profile" title={lang === "zh" ? "个人资料" : "Profile"}>
              {profileHero}
            </SettingSection>}
            {settingsTarget.category === "account-data" && <SettingSection
              anchor="data-backup"
              title={lang === "zh" ? "数据与备份" : "Data & Backup"}
              description={lang === "zh" ? "导出、导入与本地数据清理。导入会覆盖当前数据，请谨慎操作。" : "Export, import, and local-data cleanup. Importing overwrites current data — proceed with care."}
            >
              <SettingRow
                title={lang === "zh" ? "导出为 JSON" : "Export as JSON"}
                description={lang === "zh" ? "包含任务、项目、习惯、时间记录与设置的完整备份。" : "Full backup including tasks, projects, habits, time entries, and settings."}
                control={<SettingActionButton onClick={() => exportDataAsJson(data, settings)}>{lang === "zh" ? "导出" : "Export"}</SettingActionButton>}
              />
              <SettingRow
                title={lang === "zh" ? "导出任务为 CSV" : "Export tasks as CSV"}
                description={lang === "zh" ? "仅导出任务列表，便于表格工具查看。" : "Export the task list only, for use in spreadsheet tools."}
                control={<SettingActionButton onClick={() => exportTasksAsCsv(data)}>{lang === "zh" ? "导出 CSV" : "Export CSV"}</SettingActionButton>}
              />
              <SettingDivider />
              <SettingRow
                title={lang === "zh" ? "导入 JSON（完整数据）" : "Import JSON (full data)"}
                description={lang === "zh" ? "覆盖当前所有数据与设置。" : "Overwrites all current data and settings."}
                control={<SettingActionButton onClick={() => {
                  if (confirm(lang === "zh" ? "导入 JSON 将覆盖当前所有数据，确定要继续吗？" : "Importing JSON will overwrite all current data. Are you sure you want to continue?")) {
                    importDataFromJson();
                  }
                }}>{lang === "zh" ? "导入" : "Import"}</SettingActionButton>}
              />
              <SettingRow
                title={lang === "zh" ? "导入任务 CSV" : "Import tasks CSV"}
                description={lang === "zh" ? "把 CSV 中的任务合并到当前数据。" : "Merge tasks from a CSV file into the current data."}
                control={<SettingActionButton onClick={() => importTasksFromCsv()}>{lang === "zh" ? "导入 CSV" : "Import CSV"}</SettingActionButton>}
              />
              <SettingSection title={lang === "zh" ? "危险操作" : "Danger zone"} tone="danger">
                <SettingRow
                  anchor="clear-local-data"
                  title={lang === "zh" ? "清空本地数据" : "Clear local data"}
                  description={lang === "zh" ? "删除当前浏览器 / 桌面端的所有本地数据（任务、项目、习惯、时间记录、设置）。云端数据不受影响。" : "Removes all local data on this browser / desktop build (tasks, projects, habits, time entries, settings). Cloud data is unaffected."}
                  control={<SettingActionButton tone="danger" onClick={() => setConfirmClearLocalData(true)}>{lang === "zh" ? "清空…" : "Clear…"}</SettingActionButton>}
                />
              </SettingSection>
            </SettingSection>}

            {settingsTarget.category === "account-data" && <section className="df-settings-group" data-settings-anchor="account" tabIndex={-1}><h3>{lang === "zh" ? "账户" : "Account"}</h3>
              <SubscriptionPanel lang={lang} />
              {authEmail && <p className="df-settings-account">{authEmail}</p>}
              <div data-settings-anchor="sync" tabIndex={-1}><SyncSettingsControl
                  settings={settings}
                  lang={lang}
                  cloudReady={Boolean(cloudReady)}
                  isManualSyncing={Boolean(isManualSyncing)}
                  onChange={(patch) => onSave(patch)}
                  onSyncNow={onSyncNow}
                /></div>
              <div data-settings-anchor="updates" tabIndex={-1}><DesktopUpdateControl lang={lang} /></div>
              <div data-settings-anchor="auto-launch" tabIndex={-1}><AutoLaunchToggle lang={lang} /></div>
              <div data-settings-anchor="delete-account" tabIndex={-1}><AccountMoreSection lang={lang} onShowAbout={onShowAbout} onDeleteAccount={onDeleteAccount} /></div>
              {onSignOut && <SettingRow
                title={t(lang, "settings.logout")}
                description={lang === "zh" ? "退出当前 NavoPath 账户。" : "Sign out of the current NavoPath account."}
                control={<SettingActionButton onClick={onSignOut}>{t(lang, "settings.logout")}</SettingActionButton>}
              />}
            </section>}

            {settingsTarget.category === "account-data" && <SettingSection anchor="recovery-settings" title={lang === "zh" ? "恢复与重置" : "Recovery & Reset"}>
              <SettingSection title={lang === "zh" ? "危险操作" : "Danger zone"} tone="danger">
                <SettingRow
                  anchor="reset-settings"
                  title={lang === "zh" ? "重置所有设置" : "Reset all settings"}
                  description={lang === "zh" ? "把所有设置项恢复为默认值。任务、项目、习惯、时间记录等数据不会删除。" : "Restore every setting to its default. Tasks, projects, habits, and time entries are not affected."}
                  control={<SettingActionButton tone="danger" onClick={() => setConfirmResetSettings(true)}>{lang === "zh" ? "重置…" : "Reset…"}</SettingActionButton>}
                />
              </SettingSection>
            </SettingSection>}
            </div>
            </>}
              </div>
        ) : (
          <div className="df-utility-body">
            <strong>{t(lang, "settings.version")}</strong>
            <p>{t(lang, "settings.aboutDesc")}</p>
            <small>{t(lang, "settings.lastUpdated")}</small>
            <DesktopUpdateControl lang={lang} />
            <a className="df-settings-row" href="/changelog">
              <strong>{lang === "zh" ? "查看更新日志" : "View changelog"}</strong>
              <span aria-hidden="true">↗</span>
            </a>
          </div>
        )}
      </aside>
      {pluginConfigDialogId && (() => {
        const plugin = listRegisteredPlugins().find((p) => p.id === pluginConfigDialogId);
        if (!plugin) return null;
        return createPortal(
          <div className="df-dialog-overlay" role="presentation" onMouseDown={() => { setPluginConfigDialogId(null); }}>
            <section
              className="df-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="df-plugin-config-title"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <form onSubmit={(event) => { event.preventDefault(); commitPluginConfig(); }}>
                <h2 id="df-plugin-config-title">{plugin.icon} {localizedPluginName(plugin, lang)}</h2>
                <p className="df-settings-desc">{localizedPluginDescription(plugin, lang)}</p>
                <div className="df-plugin-config-fields">
                  {plugin.configFields.map((field) => {
                    const value = pluginConfigDraft[field.key];
                    if (field.type === "boolean") {
                      return (
                        <label key={field.key} className="df-utility-check">
                          <input
                            type="checkbox"
                            checked={Boolean(value)}
                            onChange={(event) => savePluginConfigField(field.key, event.target.checked)}
                          />
                          {pluginText(field.label, field.labelI18n, lang)}
                        </label>
                      );
                    }
                    if (field.type === "select") {
                      return (
                        <label key={field.key} className="df-plugin-config-field">
                          <span>{pluginText(field.label, field.labelI18n, lang)}</span>
                          <select value={String(value ?? "")} onChange={(event) => savePluginConfigField(field.key, event.target.value)}>
                            {(field.options ?? []).map((opt) => (
                              <option key={opt.value} value={opt.value}>{pluginText(opt.label, opt.labelI18n, lang)}</option>
                            ))}
                          </select>
                        </label>
                      );
                    }
                    if (field.type === "number") {
                      return (
                        <label key={field.key} className="df-plugin-config-field">
                          <span>{pluginText(field.label, field.labelI18n, lang)}</span>
                          <input
                            type="number"
                            value={Number(value ?? 0)}
                            min={field.min}
                            max={field.max}
                            onChange={(event) => savePluginConfigField(field.key, Number(event.target.value))}
                          />
                        </label>
                      );
                    }
                    return (
                      <label key={field.key} className="df-plugin-config-field">
                        <span>{pluginText(field.label, field.labelI18n, lang)}</span>
                        <textarea
                          rows={3}
                          maxLength={MAX_PLUGIN_CONFIG_STRING_LENGTH}
                          value={String(value ?? "")}
                          onChange={(event) => savePluginConfigField(field.key, event.target.value)}
                        />
                      </label>
                    );
                  })}
                </div>
                <div className="df-dialog-actions">
                  <button type="button" className="df-dialog-secondary" onClick={() => { setPluginConfigDialogId(null); }}>
                    {lang === "zh" ? "取消" : "Cancel"}
                  </button>
                  <button type="submit" className="df-dialog-primary">
                    {lang === "zh" ? "保存" : "Save"}
                  </button>
                </div>
              </form>
            </section>
          </div>,
          document.body,
        );
      })()}
      {confirmResetSettings && createPortal(
        <div className="df-dialog-overlay" role="presentation" onMouseDown={() => setConfirmResetSettings(false)}>
          <section className="df-dialog" role="dialog" aria-modal="true" aria-labelledby="df-reset-settings-title" onMouseDown={(event) => event.stopPropagation()}>
            <h2 id="df-reset-settings-title">{lang === "zh" ? "重置所有设置" : "Reset all settings"}</h2>
            <p className="df-settings-desc">{lang === "zh" ? "这将把所有设置项恢复为默认值。任务、项目、习惯、时间记录等数据不会删除。此操作无法撤销。" : "This restores every setting to its default. Tasks, projects, habits, and time entries are not affected. This cannot be undone."}</p>
            <div className="df-dialog-actions">
              <button type="button" className="df-dialog-secondary" onClick={() => setConfirmResetSettings(false)}>{lang === "zh" ? "取消" : "Cancel"}</button>
              <button type="button" className="df-dialog-danger" onClick={() => { onSave(getDefaultSettings()); setConfirmResetSettings(false); }}>{lang === "zh" ? "重置" : "Reset"}</button>
            </div>
          </section>
        </div>,
        document.body,
      )}
      {confirmClearLocalData && createPortal(
        <div className="df-dialog-overlay" role="presentation" onMouseDown={() => setConfirmClearLocalData(false)}>
          <section className="df-dialog" role="dialog" aria-modal="true" aria-labelledby="df-clear-local-title" onMouseDown={(event) => event.stopPropagation()}>
            <h2 id="df-clear-local-title">{lang === "zh" ? "清空本地数据" : "Clear local data"}</h2>
            <p className="df-settings-desc">{lang === "zh" ? "这将删除当前浏览器 / 桌面端的所有本地数据（任务、项目、习惯、时间记录、设置）。云端数据不受影响。此操作无法撤销。" : "This removes all local data on this browser / desktop build (tasks, projects, habits, time entries, settings). Cloud data is unaffected. This cannot be undone."}</p>
            <label className="df-utility-confirm-phrase">
              <span>{lang === "zh" ? "请输入 DELETE 以确认" : "Type DELETE to confirm"}</span>
              <input type="text" value={clearLocalDataPhrase} onChange={(event) => setClearLocalDataPhrase(event.target.value)} placeholder="DELETE" />
            </label>
            <div className="df-dialog-actions">
              <button type="button" className="df-dialog-secondary" onClick={() => { setConfirmClearLocalData(false); setClearLocalDataPhrase(""); }}>{lang === "zh" ? "取消" : "Cancel"}</button>
              <button type="button" className="df-dialog-danger" disabled={clearLocalDataPhrase !== "DELETE"} onClick={() => {
                try {
                  // Wipe only NavoPath-owned local entries; Supabase auth
                  // session keys (sb-*) are preserved so the user stays
                  // signed in and the cloud profile is re-fetched.
                  const preserve: string[] = [];
                  const toRemove: string[] = [];
                  for (let i = 0; i < localStorage.length; i += 1) {
                    const key = localStorage.key(i);
                    if (!key) continue;
                    if (key.startsWith("sb-") || key.startsWith("supabase")) { preserve.push(key); continue; }
                    toRemove.push(key);
                  }
                  for (const key of toRemove) localStorage.removeItem(key);
                } catch (err) {
                  console.error("Failed to clear local data:", err);
                }
                setConfirmClearLocalData(false);
                setClearLocalDataPhrase("");
                // Hard reload so the app re-bootstraps from a clean state.
                window.location.href = window.location.pathname;
              }}>{lang === "zh" ? "清空" : "Clear"}</button>
            </div>
          </section>
        </div>,
        document.body,
      )}
    </>
  );
}

function ThemeAccentSetting({ label, presets, value, onChange }: { label: string; presets: string[]; value: string; onChange: (color: string) => void }) {
  return (
    <section className="df-theme-setting df-theme-accent-setting">
      <div className="df-theme-accent-heading">
        <strong>{label}</strong>
        <span className="df-theme-accent-current" style={{ "--project-color": value } as CSSProperties} aria-hidden="true" />
      </div>
      <ProjectColorPicker presets={presets} value={value} onChange={onChange} />
    </section>
  );
}
