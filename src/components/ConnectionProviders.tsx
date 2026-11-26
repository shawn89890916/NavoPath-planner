import { useState, useSyncExternalStore, type ReactNode } from "react";
import type { Language } from "../types";
import { CONNECTION_PROVIDERS, connectionProvider, spPluginConnection, SP_PLUGIN_KEY, SP_COMPANION_URL } from "../connectionProviders";
import { extensionService } from "../extensions/service";
import { ExtensionMount } from "../extensions/ExtensionMount";
import CalendarFeedManager from "./CalendarFeedManager";
import { SettingRow, SettingSection, SettingActionButton } from "./SettingsControls";

function SuperProductivitySetup({ lang, history }: { lang: Language; history: ReactNode }) {
  const zh = lang === "zh";
  const snapshot = useSyncExternalStore(extensionService.subscribe, extensionService.getSnapshot);
  const { installed, page } = spPluginConnection(snapshot);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const install = async () => {
    setWorking(true); setError("");
    try {
      let current = spPluginConnection(extensionService.getSnapshot());
      if (!current.installed) {
        if (!current.catalog) { await extensionService.refreshCatalog(); current = spPluginConnection(extensionService.getSnapshot()); }
        if (!current.catalog) throw new Error(zh ? "官方插件暂不可用，请刷新后重试。" : "Official plugin is unavailable. Refresh and retry.");
        if (!current.installed) await extensionService.install(current.catalog);
      }
      current = spPluginConnection(extensionService.getSnapshot());
      if (current.installed && !current.installed.enabled) await extensionService.toggle(SP_PLUGIN_KEY, true);
    } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
    finally { setWorking(false); }
  };
  return <>
    <SettingSection title={zh ? "1. 连接任务与当前排程" : "1. Connect tasks and active schedules"}
      description={zh ? "保留现有配对和首次导入设置。插件负责双向同步，不需要重新配对已有连接。" : "Keep existing pairing and import preferences. The plugin handles two-way sync; existing connections need no new pairing."}>
      <SettingRow title="NavoPath Sync" description={installed?.enabled ? (zh ? "已启用" : "Enabled") : installed ? (zh ? "已安装，未启用" : "Installed, disabled") : (zh ? "需要安装官方同步插件" : "Official sync plugin required")}
        control={!installed?.enabled && <SettingActionButton disabled={working || snapshot.busy || snapshot.safeMode} onClick={() => void install()}>{working ? (zh ? "处理中…" : "Working…") : installed ? (zh ? "启用" : "Enable") : (zh ? "安装并启用" : "Install and enable")}</SettingActionButton>} />
      {snapshot.safeMode && <p role="status">{zh ? "安全模式中不运行插件。" : "Plugins do not run in safe mode."}</p>}
      {error && <p className="df-mcp-status error" role="alert">{error}</p>}
      <SettingRow title={zh ? "Super Productivity 端插件" : "Super Productivity companion"}
        description={zh ? "在 SP 的 Settings → Plugins 中安装 ZIP，打开 NavoPath Sync；已有插件可跳过。" : "Install the ZIP in SP Settings → Plugins, then open NavoPath Sync. Skip if already installed."}
        control={<a href={SP_COMPANION_URL} target="_blank" rel="noopener noreferrer">{zh ? "下载插件" : "Download plugin"}</a>} />
      {page ? <ExtensionMount contribution={page} lang={lang} /> : installed?.enabled && !snapshot.safeMode && <p role="status">{snapshot.status[SP_PLUGIN_KEY] || (zh ? "正在等待插件设置加载…" : "Waiting for plugin settings…")}</p>}
    </SettingSection>
    <SettingSection title={zh ? "2. 显示历史时间轴（可选）" : "2. Show timeline history (optional)"}
      description={zh ? "已完成、返回未完成和额外时间块通过只读日历补充显示。当前排程继续由插件同步。" : "Completed, returned-unfinished and additional blocks appear through a read-only calendar. Active schedules still sync through the plugin."}>
      {history}
      <ol>
        <li>{zh ? "在 SP 主界面打开集成与日历面板，点击 +，选择 Other (iCal)。" : "In SP, open the Integrations & Calendars panel, click +, and choose Other (iCal)."}</li>
        <li>{zh ? "粘贴历史订阅链接，关闭自动导入任务，然后保存。" : "Paste the history link, turn off automatic task import, and save."}</li>
        <li>{zh ? "打开 Schedule 查看；已添加的历史日历无需重复添加。不要同时订阅完整 NavoPath 日历，以免重复显示。" : "Open Schedule to view it. Do not add the history calendar twice or subscribe to the full NavoPath feed in SP, which duplicates active slots."}</li>
      </ol>
      <p className="df-mcp-status muted">{zh ? "历史订阅由 SP 手动确认，刷新频率由 SP 控制；NavoPath 无法检测远端是否已添加。" : "SP confirms calendar setup manually and controls refresh timing. NavoPath cannot detect whether the remote calendar was added."}</p>
    </SettingSection>
  </>;
}
export default function ConnectionProviders({ lang, anchor, onSelect, errorMessage, caldav }: { lang: Language; anchor?: string; onSelect: (anchor: string) => void; errorMessage: (error: unknown, lang: Language) => string; caldav: ReactNode }) {
  const zh = lang === "zh";
  const selected = connectionProvider(anchor);
  return <div data-settings-anchor="connections" tabIndex={-1}>
    {!selected ? <SettingSection title={zh ? "连接应用" : "Connect apps"} description={zh ? "选择应用，查看支持的同步方式并完成连接。" : "Choose an app to see its supported sync options and set it up."}>
      {CONNECTION_PROVIDERS.map(provider => <SettingRow key={provider.id} anchor={provider.anchor} title={zh ? provider.nameZh : provider.nameEn} description={zh ? provider.descriptionZh : provider.descriptionEn}
        control={<SettingActionButton onClick={() => onSelect(provider.anchor)}>{zh ? "配置" : "Set up"}</SettingActionButton>} />)}
    </SettingSection> : <div data-settings-anchor={selected.anchor} tabIndex={-1}>
      <SettingActionButton onClick={() => onSelect("connections")}>{zh ? "‹ 所有应用" : "‹ All apps"}</SettingActionButton>
      <SettingSection title={zh ? selected.nameZh : selected.nameEn} description={zh ? selected.descriptionZh : selected.descriptionEn}>
        {selected.id === "notion-calendar" && <p>{zh ? "先在支持 URL 订阅的日历账户中添加链接，再将该账户连接到 Notion Calendar。直接支持取决于日历服务。" : "Add the URL to a calendar account that supports subscriptions, then connect that account to Notion Calendar. Availability depends on the calendar service."}</p>}
      </SettingSection>
      {selected.id === "super-productivity" ? <SuperProductivitySetup lang={lang} history={<CalendarFeedManager key="history" lang={lang} historyOnly errorMessage={errorMessage} />} /> : <>
        {selected.id === "apple-calendar" && caldav}
        <CalendarFeedManager key="calendar" lang={lang} errorMessage={errorMessage} />
      </>}
    </div>}
  </div>;
}
