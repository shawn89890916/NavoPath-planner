import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import type { Language } from "../types";
import { CONNECTION_PROVIDERS, connectionProvider, readSpPairState, spConnectionListed, spConnectionLabel, spPluginConnection, SP_PLUGIN_KEY, SP_COMPANION_URL, type SpPairState } from "../connectionProviders";
import { extensionService } from "../extensions/service";
import { ExtensionMount } from "../extensions/ExtensionMount";
import CalendarFeedManager from "./CalendarFeedManager";
import { SettingRow, SettingSection, SettingActionButton } from "./SettingsControls";

const initialState: SpPairState = { kind: "loading", conflicts: 0 };

function useConnectionStatus(anchor?: string) {
  const [pair, setPair] = useState(initialState);
  const [apple, setApple] = useState<boolean | null>(null);
  const [external, setExternal] = useState<number | null>(null);
  const [shared, setShared] = useState<boolean | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    const api = window.plannerApi;
    let closed = false, running = false;
    const readPair = async () => {
      if (running || closed || document.hidden) return;
      running = true;
      try {
        const auth = await api.getAuthState?.();
        if (closed) return;
        if (!auth?.user || auth.mode !== "cloud" || !api.requestSuperProductivitySync) {
          setPair({ kind: "unavailable", conflicts: 0 }); return;
        }
        const state = await api.requestSuperProductivitySync(auth.user.id, "/state");
        if (!closed) setPair(readSpPairState(state));
      } catch (caught) {
        if (!closed) setPair({ kind: caught instanceof Error && caught.message === "Connection not found" ? "unpaired" : "unknown", conflicts: 0 });
      } finally { running = false; }
    };
    const readMetadata = async () => {
      const results = await Promise.allSettled([
        api.getCalDavCredential ? api.getCalDavCredential().then(value => Boolean(value)) : Promise.resolve(null),
        api.listExternalCalendars ? api.listExternalCalendars().then(value => value.sources.length) : Promise.resolve(null),
        api.listCalendarFeedTokens ? api.listCalendarFeedTokens().then(value => value.length > 0) : Promise.resolve(null),
      ]);
      if (closed) return;
      setApple(results[0].status === "fulfilled" ? results[0].value as boolean | null : null);
      setExternal(results[1].status === "fulfilled" ? results[1].value as number | null : null);
      setShared(results[2].status === "fulfilled" ? results[2].value as boolean | null : null);
    };
    void readPair(); void readMetadata();
    const timer = window.setInterval(() => void readPair(), 15_000);
    const changed = () => { void readMetadata(); void readPair(); };
    window.addEventListener("navopath:external-calendar-changed", changed);
    return () => { closed = true; window.clearInterval(timer); window.removeEventListener("navopath:external-calendar-changed", changed); };
  }, [anchor, refreshKey]);
  return { pair, apple, external, shared, refresh: () => setRefreshKey(value => value + 1) };
}

function SpDetail({ lang, pair, refresh, history }: { lang: Language; pair: SpPairState; refresh: () => void; history: ReactNode }) {
  const zh = lang === "zh";
  const t = (cn: string, en: string) => zh ? cn : en;
  const snapshot = useSyncExternalStore(extensionService.subscribe, extensionService.getSnapshot);
  const { installed, page } = spPluginConnection(snapshot);
  const enabled = Boolean(installed?.enabled && page && !snapshot.safeMode);
  const paired = ["waiting", "preview", "active", "paused"].includes(pair.kind);
  const [setup, setSetup] = useState(false);
  const [manage, setManage] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const install = async () => {
    setWorking(true); setError("");
    try {
      let current = spPluginConnection(extensionService.getSnapshot());
      if (!current.installed) {
        if (!current.catalog) { await extensionService.refreshCatalog(); current = spPluginConnection(extensionService.getSnapshot()); }
        if (!current.catalog) throw new Error(t("官方插件暂不可用，请重试。", "Official plugin unavailable. Retry."));
        if (!current.installed) await extensionService.install(current.catalog);
      }
      current = spPluginConnection(extensionService.getSnapshot());
      if (current.installed && !current.installed.enabled) await extensionService.toggle(SP_PLUGIN_KEY, true);
    } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
    finally { setWorking(false); refresh(); }
  };
  const attention = pair.kind === "preview" || pair.kind === "waiting" || pair.kind === "paused" || pair.conflicts > 0;
  const showSetup = (!paired && setup) || (paired && !enabled);
  const showPanel = enabled && (attention || manage || (!paired && setup));
  return <SettingSection title="Super Productivity" description={<span role="status">{spConnectionLabel(pair, enabled, zh)}</span>}>
    {pair.kind === "unknown" && <SettingRow title={t("暂时无法验证连接", "Unable to verify connection")} control={<SettingActionButton onClick={refresh}>{t("重试", "Retry")}</SettingActionButton>} />}
    {pair.kind === "unavailable" && <p>{t("登录 NavoPath 云端账户后可连接。", "Sign in to a NavoPath cloud account to connect.")}</p>}
    {!paired && !setup && pair.kind !== "loading" && pair.kind !== "unavailable" && <SettingRow title={t("同步任务与排程", "Sync tasks and schedules")} control={<SettingActionButton tone="primary" onClick={() => setSetup(true)}>{t("连接", "Connect")}</SettingActionButton>} />}
    {showSetup && <>
      {!enabled && <SettingRow title={t("NavoPath 同步插件", "NavoPath sync plugin")} description={snapshot.safeMode ? t("安全模式中不运行插件", "Plugins do not run in safe mode") : installed?.enabled ? t("正在等待插件加载", "Waiting for plugin to load") : undefined}
        control={!installed?.enabled && <SettingActionButton tone="primary" disabled={working || snapshot.busy || snapshot.safeMode} onClick={() => void install()}>{working ? t("处理中…", "Working…") : installed ? t("启用", "Enable") : t("安装并启用", "Install and enable")}</SettingActionButton>} />}
      {error && <p className="df-mcp-status error" role="alert">{error}</p>}
      {enabled && !paired && <SettingRow title={t("SP 端插件", "SP companion")} description={t("在 SP 设置的插件页安装 ZIP；已安装可跳过。", "Install the ZIP in SP Settings → Plugins; skip if installed.")} control={<a href={SP_COMPANION_URL} target="_blank" rel="noopener noreferrer">{t("下载", "Download")}</a>} />}
    </>}
    {paired && pair.kind === "active" && !attention && enabled && <SettingRow title={t("任务与排程", "Tasks and schedules")} description={t("双向同步 · 远端在线状态未知", "Two-way sync · remote availability unknown")} />}
    {paired && pair.conflicts > 0 && <p role="status">{t(`${pair.conflicts} 项冲突需要确认`, `${pair.conflicts} conflicts need review`)}</p>}
    {paired && <SettingRow title={t("历史时间轴", "Timeline history")} description={t("可选 · 只读订阅", "Optional · read-only subscription")} control={<SettingActionButton onClick={() => setHistoryOpen(value => !value)}>{historyOpen ? t("收起", "Hide") : t("配置", "Set up")}</SettingActionButton>} />}
    {paired && historyOpen && <div>
      {history}
      <p className="df-mcp-status muted">{t("在 SP 集成与日历面板点 + → Other (iCal)，粘贴链接并关闭自动导入任务。已有订阅无需重复添加；NavoPath 无法验证 SP 是否已添加。", "In SP Integrations & Calendars, choose + → Other (iCal), paste the link and turn off auto-import. Do not add it twice; NavoPath cannot verify the remote subscription.")}</p>
    </div>}
    {paired && !attention && enabled && <SettingRow title={t("管理连接", "Manage connection")} control={<SettingActionButton onClick={() => setManage(value => !value)}>{manage ? t("收起", "Hide") : t("打开", "Open")}</SettingActionButton>} />}
    {showPanel && page && <ExtensionMount contribution={page} />}
  </SettingSection>;
}

export default function ConnectionProviders({ lang, anchor, onSelect, errorMessage, caldav, externalCalendar, mcp, bridge }: {
  lang: Language; anchor?: string; onSelect: (anchor: string) => void; errorMessage: (error: unknown, lang: Language) => string;
  caldav: ReactNode; externalCalendar: ReactNode; mcp: ReactNode; bridge: ReactNode;
}) {
  const zh = lang === "zh";
  const t = (cn: string, en: string) => zh ? cn : en;
  const status = useConnectionStatus(anchor);
  const snapshot = useSyncExternalStore(extensionService.subscribe, extensionService.getSnapshot);
  const { installed, page } = spPluginConnection(snapshot);
  const spListed = spConnectionListed(status.pair, Boolean(installed));
  const selected = connectionProvider(anchor);
  const action = (target: string, title = t("打开", "Open")) => <SettingActionButton onClick={() => onSelect(target)}>{title}</SettingActionButton>;
  const back = (target = "connections") => <SettingActionButton onClick={() => onSelect(target)}>{t("‹ 连接", "‹ Connections")}</SettingActionButton>;
  const sharedCalendar = <CalendarFeedManager lang={lang} errorMessage={errorMessage} />;
  const isHome = !anchor || anchor === "connections";
  return <div data-settings-anchor="connections" tabIndex={-1}>
    {isHome ? <>
      <SettingSection title={t("应用", "Apps")}>
        {spListed && <SettingRow title="Super Productivity" description={spConnectionLabel(status.pair, Boolean(installed?.enabled && page && !snapshot.safeMode), zh)} control={action("connection-super-productivity")} />}
        {status.apple === true && <SettingRow title={t("Apple 日历", "Apple Calendar")} description={t("已生成凭据 · 远端状态未知", "Credential issued · remote status unknown")} control={action("connection-apple-calendar")} />}
        {!spListed && status.apple !== true && <p className="df-mcp-status muted">{status.pair.kind === "loading" ? t("正在检查连接…", "Checking connections…") : status.pair.kind === "unknown" ? t("暂时无法验证应用连接", "Unable to verify app connections") : t("尚无可确认的应用连接", "No verified app connections")}</p>}
        <SettingRow title={t("添加连接", "Add connection")} control={action("connection-add", t("添加", "Add"))} />
      </SettingSection>
      <SettingSection title={t("其他连接", "Other connections")}>
        <SettingRow title={t("外部日历", "External calendars")} description={status.external === null ? t("只读忙碌时间", "Read-only busy time") : t(`${status.external} 个来源`, `${status.external} sources`)} control={action("external-calendar")} />
        <SettingRow title={t("高级连接", "Advanced connections")} control={action("connection-advanced")} />
      </SettingSection>
    </> : <>
      {back(anchor === "calendar-feed" || anchor === "mcp" || anchor === "sync-bridge" ? "connection-advanced" : "connections")}
      <div data-settings-anchor={anchor} tabIndex={-1}>
        {anchor === "connection-add" ? <SettingSection title={t("添加连接", "Add connection")}>
          {CONNECTION_PROVIDERS.filter(item => item.id !== "super-productivity" || !spListed).filter(item => item.id !== "apple-calendar" || status.apple !== true).map(item =>
            <SettingRow key={item.id} title={zh ? item.nameZh : item.nameEn} description={zh ? item.descriptionZh : item.descriptionEn} control={action(item.anchor, t("选择", "Choose"))} />)}
        </SettingSection> : anchor === "connection-advanced" ? <SettingSection title={t("高级连接", "Advanced connections")}>
          <SettingRow title={t("共享日历订阅链接", "Shared calendar subscription")} description={status.shared === true ? t("已有有效链接", "Active link exists") : undefined} control={action("calendar-feed")} />
          <SettingRow title="MCP" control={action("mcp")} />
          <SettingRow title={t("云盘桥接", "Cloud folder bridge")} control={action("sync-bridge")} />
        </SettingSection> : anchor === "external-calendar" ? <SettingSection title={t("外部日历", "External calendars")}>{externalCalendar}</SettingSection> : anchor === "mcp" ? <SettingSection title="MCP">{mcp}</SettingSection> : anchor === "sync-bridge" ? <SettingSection title={t("云盘桥接", "Cloud folder bridge")}>{bridge}</SettingSection> : anchor === "calendar-feed" ? <SettingSection title={t("共享日历订阅", "Shared calendar subscription")} description={t("普通与历史订阅共享撤销生命周期；请勿公开链接。", "Regular and history links share revocation. Keep links private.")}>{sharedCalendar}</SettingSection> : selected?.id === "super-productivity" ? <SpDetail lang={lang} pair={status.pair} refresh={status.refresh} history={<CalendarFeedManager lang={lang} historyOnly errorMessage={errorMessage} />} /> : selected ? <SettingSection title={zh ? selected.nameZh : selected.nameEn} description={selected.id === "apple-calendar" && status.apple === true ? t("已生成凭据 · 远端状态未知", "Credential issued · remote status unknown") : zh ? selected.descriptionZh : selected.descriptionEn}>
          {selected.id === "apple-calendar" ? caldav : selected.id === "notion-calendar" ? <p>{t("先在支持 URL 订阅的日历账户中添加链接，再将该账户连接到 Notion Calendar。", "Add the URL to a supported calendar account, then connect it to Notion Calendar.")}</p> : null}
          <SettingRow title={t("只读日历订阅", "Read-only calendar subscription")} control={action("calendar-feed", t("管理链接", "Manage link"))} />
        </SettingSection> : null}
      </div>
    </>}
  </div>;
}
