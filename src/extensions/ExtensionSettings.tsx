import { pluginMcpGrant, SCHEDULE_TEMPLATE_PLUGIN, type PluginMcpAccess } from "../../shared/pluginMcp";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type { Language } from "../types";
import { SettingActionButton, SettingColorInput, SettingNumberInput, SettingRow, SettingSection, SettingDisclosure, SettingSelect, SettingTextInput, SettingToggle } from "../components/SettingsControls";
import { EmptyState } from "../components/EmptyState";
import { ActionDisclosure, Button, CloseButton, Modal } from "../components/UiPrimitives";
import { UiSearchIcon } from "../components/UiIcons";
import { PluginMarketIdentity } from "./PluginMarketIdentity";
import { extensionService } from "./service";
import type { CatalogEntry, CompactPluginPlacement, ExtensionKind, ThemeOption, PluginSettingOption } from "./types";
import { getAppHeaderPlugins } from "./compactDock";
import { COMPACT_DOCK_LIMITS, DEFAULT_COMPACT_DOCK_LIMIT } from "./packages";
import { ExtensionMount } from "./ExtensionMount";
import { pluginTier, groupPluginTiers, type PluginTier } from "./pluginTier";
import { pluginSettingsPages, pluginOptionAnchor, pluginPageAnchor } from "../pluginSettingsNavigation";
import { normalizePomodoroClockFont, pomodoroClockFonts, POMODORO_EXTENSION_KEY } from "../widget/pomodoroAppearance";
import "./ExtensionSettings.css";

function ExtensionOptionControl({ option, value, onChange, disabled }: { option: ThemeOption | PluginSettingOption; value: unknown; onChange: (value: unknown) => void; disabled?: boolean }) {
  if (option.type === "select") return <SettingSelect value={option.choices.some(choice => choice.value === value) ? String(value) : option.default} options={option.choices} ariaLabel={option.label} disabled={disabled} onChange={onChange} />;
  if (option.type === "boolean") return <SettingToggle checked={typeof value === "boolean" ? value : Boolean(option.default)} ariaLabel={option.label} disabled={disabled} onChange={onChange} />;
  if (option.type === "color") return <SettingColorInput value={typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : String(option.default)} ariaLabel={option.label} disabled={disabled} onChange={onChange} />;
  if (option.type === "number") return <SettingNumberInput value={typeof value === "number" && Number.isFinite(value) ? value : Number(option.default)} min={option.min} max={option.max} step={"step" in option ? option.step : undefined} ariaLabel={option.label} disabled={disabled} commitOnBlur onChange={next => onChange(Math.min(option.max ?? Infinity, Math.max(option.min ?? -Infinity, next)))} />;
  return <SettingTextInput value={typeof value === "string" ? value : String(option.default)} ariaLabel={option.label} disabled={disabled} onChange={next => onChange(next.slice(0, 10000))} />;
}

type PreviewMode = "split" | "light" | "dark";
function catalogStats(entry: CatalogEntry, lang: Language) {
  const downloads = typeof entry.downloads === "number" && Number.isFinite(entry.downloads) && entry.downloads >= 0
    ? new Intl.NumberFormat(lang === "zh" ? "zh-CN" : "en-US").format(entry.downloads)
    : lang === "zh" ? "暂无数据" : "Unavailable";
  const published = entry.publishedAt && Number.isFinite(Date.parse(entry.publishedAt))
    ? new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "en-US", { dateStyle: "medium" }).format(new Date(entry.publishedAt))
    : lang === "zh" ? "暂无记录" : "Unavailable";
  return { downloads, published };
}
function ThemePreviewImage({ entry, lang, mode }: { entry: CatalogEntry; lang: Language; mode: "light" | "dark" }) {
  const [fallback, setFallback] = useState(false);
  const [failed, setFailed] = useState(false);
  const path = entry.manifest.previews?.[mode] || entry.manifest.preview;
  const local = entry.sourceId === "official" && path ? `${import.meta.env.BASE_URL}extensions/previews/${entry.manifest.id}${entry.manifest.previews ? `-${mode}` : ""}.${path.split(".").pop()}` : undefined;
  const remote = entry.previewUrls?.[mode] || entry.previewUrl;
  const source = fallback ? remote : local || remote;
  return <div className={`df-extension-preview-image df-extension-preview-image--${mode}`}>{source && !failed ? <img src={source} alt={lang === "zh" ? `${entry.manifest.name} ${mode === "light" ? "浅色" : "深色"}预览` : `${entry.manifest.name} ${mode} preview`} loading="lazy" referrerPolicy="no-referrer" onError={() => { if (local && !fallback && remote) setFallback(true); else setFailed(true); }} /> : <span>{lang === "zh" ? "暂无预览" : "No preview provided"}</span>}</div>;
}
function ThemePreview({ entry, lang, mode }: { entry: CatalogEntry; lang: Language; mode: PreviewMode }) {
  const paired = Boolean(entry.manifest.previews || entry.previewUrls);
  const split = mode === "split" && paired;
  return <div className={`df-extension-preview${split ? " df-extension-preview--split" : ""}`}>
    {(split || mode !== "dark") && <ThemePreviewImage key={`${entry.sourceId}:${entry.manifest.id}:light`} entry={entry} lang={lang} mode="light" />}
    {(split || mode === "dark") && <ThemePreviewImage key={`${entry.sourceId}:${entry.manifest.id}:dark`} entry={entry} lang={lang} mode="dark" />}
    {paired && <><span className="df-extension-preview-label df-extension-preview-label--light" hidden={mode === "dark"}>{lang === "zh" ? "浅色" : "Light"}</span><span className="df-extension-preview-label df-extension-preview-label--dark" hidden={mode === "light"}>{lang === "zh" ? "深色" : "Dark"}</span></>}
  </div>;
}

export function ExtensionSettings({ lang, kind, settingsPageId, onSelectPage, mcpAccess, onMcpAccessChange, inlineSettings, inlineTarget, inlineAnchor, settingsOwner, settingsAnchor, openMarket, onCloseMarket, onSelectOwner, onManageConnection }: {
  lang: Language;
  kind: ExtensionKind;
  settingsPageId?: string | null;
  onSelectPage?: (id: string | null) => void;
  settingsOwner?: string;
  settingsAnchor?: string;
  openMarket?: boolean;
  onCloseMarket?: () => void;
  onSelectOwner?: (owner: string) => void;
  onManageConnection?: () => void;
  inlineSettings?: Readonly<Record<string, ReactNode>>;
  inlineTarget?: string;
  inlineAnchor?: string;
  mcpAccess?: PluginMcpAccess;
  onMcpAccessChange?: (owner: string, grant: string | false) => void;
}) {
  const snapshot = useSyncExternalStore(extensionService.subscribe, extensionService.getSnapshot);
  const { preferences, busy, safeMode, catalogLoading, checkingUpdates } = snapshot;
  const zh = lang === "zh", plugin = kind === "plugin";
  const text = (cn: string, en: string) => zh ? cn : en;
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"installed" | "market" | "sources" | "url">(openMarket ? "market" : "installed");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [packageUrl, setPackageUrl] = useState("");
  const [expandedInline, setExpandedInline] = useState<string | undefined>(inlineTarget);
  const inlineRoot = useRef<HTMLDivElement>(null);
  useEffect(() => { if (inlineTarget) setExpandedInline(inlineTarget); }, [inlineTarget, inlineAnchor]);
  useEffect(() => {
    if (!inlineTarget || expandedInline !== inlineTarget || !inlineAnchor) return;
    const id = window.requestAnimationFrame(() => {
      const element = [...(inlineRoot.current?.querySelectorAll<HTMLElement>("[data-settings-anchor]") ?? [])].find(node => node.dataset.settingsAnchor === inlineAnchor);
      if (element) { element.scrollIntoView({ block: "nearest" }); element.focus({ preventScroll: true }); }
    });
    return () => window.cancelAnimationFrame(id);
  }, [expandedInline, inlineTarget, inlineAnchor]);
  const [localPageId, setLocalPageId] = useState<string | null>(null);
  const pageId = settingsPageId === undefined ? localPageId : settingsPageId;
  const setPageId = onSelectPage || setLocalPageId;
  const [onlyInstalled, setOnlyInstalled] = useState(false);
  const [marketSort, setMarketSort] = useState("name");
  const [marketTier, setMarketTier] = useState<"all" | PluginTier>("all");
  const [previewMode, setPreviewMode] = useState<PreviewMode>("split");
  const [selectedCatalogKey, setSelectedCatalogKey] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState("");
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [fallbackSettingsKey, setFallbackSettingsKey] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const installed = Object.values(preferences.installed).filter((item) => item.manifest.kind === kind);
  const mcpPlugins = installed.flatMap((item) => {
    if (item.key === SCHEDULE_TEMPLATE_PLUGIN) return [{ item, grant: "enabled" }];
    const grant = pluginMcpGrant(item);
    return grant ? [{ item, grant }] : [];
  });
  const toolbarOwners = plugin ? getAppHeaderPlugins(snapshot).owners : undefined;
  const matches = (name: string, description: string, author: string) => `${name} ${description} ${author}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
  const filtered = installed.filter(({ manifest }) => matches(manifest.name, manifest.description, manifest.author));
  const catalog = snapshot.catalog.filter(({ manifest, sourceId }) => manifest.kind === kind && (!plugin || marketTier === "all" || pluginTier({ sourceId, manifest }) === marketTier) && matches(manifest.name, manifest.description, manifest.author) && (!onlyInstalled || installed.some(item => item.sourceId === sourceId && item.manifest.id === manifest.id))).sort((a, b) => marketSort === "downloads" ? (b.downloads ?? -1) - (a.downloads ?? -1) : marketSort === "updated" ? (Date.parse(b.publishedAt || "") || 0) - (Date.parse(a.publishedAt || "") || 0) : a.manifest[marketSort === "author" ? "author" : "name"].localeCompare(b.manifest[marketSort === "author" ? "author" : "name"], lang));
  const installedGroups = plugin ? groupPluginTiers(filtered) : [{ tier: "community" as const, items: filtered }];
  const marketGroups = plugin ? groupPluginTiers(catalog) : [{ tier: "community" as const, items: catalog }];
  const tierLabel = (tier: PluginTier) => tier === "official" ? text("官方插件", "Official plugins") : text("社区插件", "Community plugins");
  const selectedCatalog = snapshot.catalog.find(entry => `${entry.sourceId}:${entry.manifest.id}` === selectedCatalogKey && entry.manifest.kind === kind);
  const page = snapshot.settingsPages.find((item) => item.id === pageId);
  const active = installed.find((item) => item.key === preferences.activeTheme);
  const updateCount = installed.filter((item) => snapshot.updates[item.key]).length;
  const batch = snapshot.updateBatch?.kind === kind ? snapshot.updateBatch : undefined;
  const batchRunning = Boolean(snapshot.updateBatch?.running);
  const retryCount = batch?.failures.filter(failure => snapshot.updates[failure.key]).length ?? 0;
  const updateLabel = text("全部更新", "Update all");
  const checkLabel = text("检查更新", "Check updates");
  async function run(action: () => Promise<unknown>, label = "") {
    setError(""); setNotice(""); if (label) setPending(label);
    try { await action(); } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
    finally { if (label) setPending(current => current === label ? "" : current); }
  }
  function navigate(next: typeof view) { if (view === "market" && next !== "market" && openMarket) onCloseMarket?.(); setView(next); setQuery(""); setMarketTier("all"); setSelectedCatalogKey(null); setConfirmation(null); setError(""); setNotice(""); }
  function browseMarket() { navigate("market"); void run(() => extensionService.refreshCatalog()); }
  useEffect(() => { if (openMarket) { setView("market"); setSelectedCatalogKey(null); void extensionService.refreshCatalog().catch(caught => setError(String(caught))); } }, [openMarket]);
  const updateControls = (inMarket: boolean) => <div className="df-extension-update-strip">
    <div className="df-extension-update-copy" role="status" aria-live="polite">
      {batch?.running ? <><strong>{text("正在更新", "Updating")} {batch.processed}/{batch.total}</strong><span>{installed.find(item => item.key === batch.current)?.manifest.name ?? text("准备中…", "Preparing…")}</span><progress aria-label={text("批量更新进度", "Batch update progress")} value={batch.processed} max={batch.total} /></>
        : batch && batch.failures.length > 0 ? <><strong>{text(`已更新 ${batch.updated} 项 · ${batch.failures.length} 项失败`, `${batch.updated} updated · ${batch.failures.length} failed`)}</strong>{batch.failures.map(failure => <span className="df-extension-update-failure" key={failure.key}>{failure.name}: {failure.error}</span>)}</>
        : updateCount ? <strong>{text(`${updateCount} 个可用更新`, `${updateCount} updates available`)}</strong>
        : batch ? <span>{text(`更新完成 · ${batch.updated} 项已更新`, `Finished · ${batch.updated} updated`)}</span> : null}
    </div>
    <div className="df-extension-update-actions">
      {inMarket && <SettingActionButton pending={Boolean(checkingUpdates)} disabled={batchRunning} onClick={() => void run(() => extensionService.checkUpdates())}>{checkLabel}</SettingActionButton>}
      {retryCount > 0 && !batch?.running && <SettingActionButton disabled={busy || batchRunning || Boolean(checkingUpdates)} onClick={() => void run(() => extensionService.updateAll(kind, true))}>{text("重试失败项", "Retry failed")}</SettingActionButton>}
      {updateCount > 0 && !batch?.running && <SettingActionButton tone="primary" disabled={busy || batchRunning || Boolean(checkingUpdates)} onClick={() => void run(() => extensionService.updateAll(kind))}>{updateLabel}</SettingActionButton>}
    </div>
  </div>;
  function statusLabel(value: string) { const parts = value.split(" / "); return parts.length === 2 ? parts[zh ? 0 : 1] : value; }
  useEffect(() => { if (pageId && !page) setPageId(null); }, [pageId, page]);
  const search = <label className="df-extension-search"><UiSearchIcon size={16} /><SettingTextInput value={query} placeholder={view === "market" ? text("搜索名称、作者或描述…", "Search name, author or description…") : text(plugin ? "搜索已安装的插件…" : "搜索已安装的主题…", plugin ? "Search installed plugins…" : "Search installed themes…")} ariaLabel={text("搜索扩展", "Search extensions")} onChange={setQuery} /></label>;
  const back = <div className="df-extension-back"><SettingActionButton onClick={() => navigate("installed")}>{text(plugin ? "返回插件" : "返回主题", plugin ? "Back to plugins" : "Back to themes")}</SettingActionButton></div>;

  const ownerItem = settingsOwner ? installed.find(item => item.key === settingsOwner) : undefined;
  const ownerRoot = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!settingsOwner || !settingsAnchor) return;
    const frame = window.requestAnimationFrame(() => {
      const anchor = Array.from(ownerRoot.current?.querySelectorAll<HTMLElement>("[data-settings-anchor]") ?? []).find(node => node.dataset.settingsAnchor === settingsAnchor);
      if (anchor) { anchor.scrollIntoView({ block: "nearest" }); anchor.focus({ preventScroll: true }); }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [settingsOwner, settingsAnchor, busy]);
  function declaredSettings(item: typeof installed[number]) {
    const declared = plugin ? item.manifest.settingsOptions : undefined;
    if (!declared?.length) return null;
    const config = extensionService.getConfig(item.key);
    return <>
      {declared.map(option => <SettingRow key={option.key} anchor={pluginOptionAnchor(option.key)} title={option.label} description={option.description} control={<ExtensionOptionControl option={option} value={config[option.key] ?? option.default} disabled={busy} onChange={value => void run(() => extensionService.saveConfig(item.key, { [option.key]: value }), text("正在保存…", "Saving…"))} />} />)}
      <SettingRow title={text("恢复插件默认选项", "Restore plugin defaults")} control={<SettingActionButton disabled={busy} onClick={() => void run(() => extensionService.saveConfig(item.key, Object.fromEntries(declared.map(option => [option.key, option.default]))), text("正在保存…", "Saving…"))}>{text("恢复默认", "Reset")}</SettingActionButton>} />
    </>;
  }
  if (ownerItem) {
    const pages = pluginSettingsPages(snapshot, ownerItem);
    const native = inlineSettings?.[ownerItem.key];
    const focusClockFont = ownerItem.key === POMODORO_EXTENSION_KEY ? normalizePomodoroClockFont(extensionService.getConfig(ownerItem.key).clockFont) : undefined;
    const fontLabel = text("计时数字字体", "Clock font");
    return <div className="df-extensions" ref={ownerRoot} aria-label={ownerItem.manifest.name}>
      {(error || snapshot.error) && <p className="df-extension-error" role="alert">{error || snapshot.error}</p>}
      {(pending || notice) && <p className="df-extension-note" role="status">{pending || notice}</p>}
      {safeMode ? <p className="df-extension-note">{text("受限模式已开启，插件运行时暂停。", "Restricted mode is on; plugin runtime is paused.")}</p> : null}
      {native}
      {Boolean(ownerItem.manifest.settingsOptions?.length) && <SettingSection variant="grouped">{declaredSettings(ownerItem)}</SettingSection>}
      {focusClockFont && <SettingRow title={fontLabel} control={<><span className="df-focus-font-preview" data-focus-clock-font={focusClockFont} aria-hidden="true">23:00</span><SettingSelect ariaLabel={fontLabel} value={focusClockFont} disabled={busy} options={pomodoroClockFonts.map(option => ({ value: option.value, label: option[lang] }))} onChange={value => void run(() => extensionService.saveConfig(ownerItem.key, { clockFont: normalizePomodoroClockFont(value) }), fontLabel)} /></>} />}
      {pages.map(contribution => <SettingSection key={contribution.id} anchor={pluginPageAnchor(contribution.id)} title={pages.length > 1 || native || ownerItem.manifest.settingsOptions?.length ? contribution.name : undefined}><ExtensionMount contribution={contribution} lang={lang} /></SettingSection>)}
      {!native && !ownerItem.manifest.settingsOptions?.length && !pages.length && <p className="df-extension-note" role="status">{busy ? text("正在重新加载插件设置…", "Reloading plugin settings…") : text("插件设置暂不可用。", "Plugin settings are unavailable.")}</p>}
    </div>;
  }
  if (page) {
    const focusClockFont = page.owner === POMODORO_EXTENSION_KEY
      ? normalizePomodoroClockFont(extensionService.getConfig(page.owner).clockFont)
      : undefined;
    const fontLabel = text("计时数字字体", "Clock font");
    return <div className="df-extensions" aria-label={page.name}><SettingSection title={settingsPageId === undefined ? page.name : undefined}>
      <div className="df-extension-back"><SettingActionButton onClick={() => setPageId(null)}>{text("返回插件", "Back to plugins")}</SettingActionButton></div>
      {focusClockFont && <SettingRow title={fontLabel} control={<>
        <span className="df-focus-font-preview" data-focus-clock-font={focusClockFont} aria-hidden="true">23:00</span>
        <SettingSelect ariaLabel={fontLabel} value={focusClockFont} disabled={pending === fontLabel}
          options={pomodoroClockFonts.map(option => ({ value: option.value, label: option[lang] }))}
          onChange={(value) => void run(() => extensionService.saveConfig(page.owner, { clockFont: normalizePomodoroClockFont(value) }), fontLabel)} />
      </>} />}
      {error && <p className="df-extension-error" role="alert">{error}</p>}
      <ExtensionMount contribution={page} lang={lang} />
    </SettingSection></div>;
  }

  return <div className="df-extensions">
    <input ref={fileInput} className="df-extension-file" type="file" accept=".zip,.navopackage.json,application/zip,application/json" aria-label={text("导入扩展包", "Import extension package")} onChange={(event) => { const file = event.target.files?.[0]; if (file) void run(() => extensionService.importFile(file, kind), text("正在导入…", "Importing…")); event.target.value = ""; }} />
    {(error || snapshot.error) && <p className="df-extension-error" role="alert">{error || snapshot.error}</p>}
    <div className="df-extension-feedback" role="status">{pending || notice}</div>
    {(view === "installed" || view === "market") && <>
      <div data-settings-anchor={plugin ? "plugins" : "themes"} tabIndex={-1} className="df-settings-extension-tools">
        <span data-settings-anchor={plugin ? "plugin-market" : undefined} tabIndex={plugin ? -1 : undefined}><SettingActionButton tone="primary" onClick={browseMarket}>{text("浏览市场", "Browse market")}</SettingActionButton></span>
        <SettingActionButton onClick={() => fileInput.current?.click()}>{text("导入", "Import")}</SettingActionButton>
        <SettingActionButton pending={Boolean(checkingUpdates)} disabled={batchRunning} onClick={() => void run(async () => { await extensionService.checkUpdates(); setNotice(text("更新检查完成。", "Update check complete.")); })}>{text("检查更新", "Check updates")}</SettingActionButton>
        <ActionDisclosure label={text("更多安装方式", "More installation options")}><SettingActionButton onClick={() => navigate("url")}>{text("从网址安装", "Install from URL")}</SettingActionButton></ActionDisclosure>
      </div>
      {plugin && safeMode && <SettingRow title={text("受限模式已开启", "Restricted mode is on")} description={text("所有插件已暂停，安装与配置仍保留。", "Plugins are paused; installations and settings are preserved.")} control={<SettingActionButton onClick={() => void run(() => extensionService.setSafeMode(false))}>{text("退出受限模式", "Resume plugins")}</SettingActionButton>} />}
      {!plugin && <SettingRow title={text("当前主题", "Current theme")} control={<SettingSelect value={preferences.activeTheme ?? ""} disabled={busy} ariaLabel={text("当前主题", "Current theme")} options={[{ value: "", label: text("NavoPath 默认", "NavoPath default") }, ...installed.map((item) => ({ value: item.key, label: item.manifest.name }))]} onChange={(key) => void run(() => extensionService.selectTheme(key || null), text("正在切换主题…", "Applying theme…"))} />} />}
      {(updateCount > 0 || batch) && updateControls(false)}
      <SettingSection variant="grouped" title={text(plugin ? "已安装插件" : "已安装主题", plugin ? "Installed plugins" : "Installed themes")}>
        {installed.length > 0 && search}
        <div className="df-extension-list">
          {filtered.length === 0 && !error && !snapshot.error && (
            <EmptyState announce title={query.trim() ? text("没有找到匹配项", "No matches found")
              : text(plugin ? "还没有安装插件" : "还没有安装社区主题", plugin ? "No plugins installed yet" : "No community themes installed yet")}>
              {query.trim()
                ? <Button onClick={() => setQuery("")}>{text("清除搜索", "Clear search")}</Button>
                : <Button variant="primary" onClick={browseMarket}>{text("浏览市场", "Browse market")}</Button>}
            </EmptyState>
          )}
          {installedGroups.map(group => <section key={group.tier} className="df-extension-tier" aria-label={plugin ? tierLabel(group.tier) : undefined}>
            {plugin && <h3 className="df-extension-tier-title">{tierLabel(group.tier)}</h3>}
            <div className="df-extension-list">{group.items.map((item) => {
            const pages = pluginSettingsPages(snapshot, item);
            const selected = preferences.activeTheme === item.key;
            const inline = item.enabled ? (inlineSettings?.[item.key] ?? declaredSettings(item)) : undefined;
            const directSettings = Boolean(plugin && onSelectOwner && item.enabled && (inline || pages.length));
            return <div className="df-extension-installed-item" key={item.key}><SettingRow title={item.manifest.name} description={<>{item.manifest.description}<span className="df-extension-meta">v{item.manifest.version} · {item.manifest.author} · {preferences.sources.find(source => source.id === item.sourceId)?.name ?? item.sourceId}</span><span className="df-extension-state">{plugin ? statusLabel(snapshot.status[item.key] || (item.enabled ? text("已启用", "Enabled") : text("已停用", "Disabled"))) : selected ? text("使用中", "Active") : text("已安装", "Installed")}</span></>} control={confirmation === item.key ? <><SettingActionButton disabled={busy} tone="danger" onClick={() => void run(async () => { await extensionService.uninstall(item.key); setConfirmation(null); }, text("正在卸载…", "Uninstalling…"))}>{text("确认卸载", "Confirm uninstall")}</SettingActionButton><SettingActionButton onClick={() => setConfirmation(null)}>{text("取消", "Cancel")}</SettingActionButton></> : <>
              {plugin && item.key === "official:super-productivity-sync" && onManageConnection ? <SettingActionButton onClick={onManageConnection}>{text("管理连接", "Manage connection")}</SettingActionButton> : directSettings ? <SettingActionButton ariaLabel={text(`${item.manifest.name} 设置`, `${item.manifest.name} settings`)} onClick={() => onSelectOwner?.(item.key)}>{text("设置", "Settings")}</SettingActionButton> : <>{inline && <SettingActionButton ariaLabel={text(`${item.manifest.name} 设置`, `${item.manifest.name} settings`)} onClick={() => setExpandedInline(current => current === item.key ? undefined : item.key)}>{expandedInline === item.key ? text("收起", "Collapse") : text("设置", "Settings")}</SettingActionButton>}
              {pages.length > 0 ? pages.map((contribution) => <SettingActionButton key={contribution.id} ariaLabel={text(`${item.manifest.name} ${inline ? "高级设置" : "设置"}`, `${item.manifest.name} ${inline ? "advanced settings" : "settings"}`)} onClick={() => setPageId(contribution.id)}>{pages.length === 1 ? text(inline ? "高级设置" : "设置", inline ? "Advanced settings" : "Settings") : contribution.name}</SettingActionButton>) : plugin && !inline && <SettingActionButton ariaLabel={text(`${item.manifest.name} 设置`, `${item.manifest.name} settings`)} onClick={() => setFallbackSettingsKey(item.key)}>{text("设置", "Settings")}</SettingActionButton>}</>}
              {!plugin && !selected && <SettingActionButton disabled={busy} onClick={() => void run(() => extensionService.selectTheme(item.key), text("正在切换主题…", "Applying theme…"))}>{text("使用", "Use theme")}</SettingActionButton>}
              {snapshot.updates[item.key] && <SettingActionButton pending={pending === (zh ? "正在更新…" : "Updating…")} disabled={busy || batchRunning} onClick={() => void run(() => extensionService.update(item.key), text("正在更新…", "Updating…"))}>{pending === (zh ? "正在更新…" : "Updating…") ? text("正在更新…", "Updating…") : text("更新", "Update")}</SettingActionButton>}
              <ActionDisclosure label={text(`${item.manifest.name} 更多操作`, `More actions for ${item.manifest.name}`)}>
                {item.previous && <SettingActionButton disabled={busy} onClick={() => void run(() => extensionService.rollback(item.key), text("正在回退…", "Rolling back…"))}>{text("回退", "Roll back")} {item.previous.manifest.version}</SettingActionButton>}
                <SettingActionButton disabled={busy} tone="danger" onClick={() => setConfirmation(item.key)}>{text("卸载", "Uninstall")}</SettingActionButton>
              </ActionDisclosure>
              {plugin && <SettingToggle checked={item.enabled} disabled={busy || safeMode} ariaLabel={`${text("启用", "Enable")} ${item.manifest.name}`} onChange={(enabled) => void run(() => extensionService.toggle(item.key, enabled), text("正在应用…", "Applying…"))} />}
            </>} />{!directSettings && inline && expandedInline === item.key && <div className="df-settings-inline-plugin" ref={inlineRoot}>{inline}</div>}</div>;
          })}</div></section>)}
        </div>
        {plugin && <SettingActionButton onClick={browseMarket}>{text("添加插件", "Add plugins")}</SettingActionButton>}
      </SettingSection>
      {inlineTarget && !installed.some(item => item.key === inlineTarget) && <p className="df-extension-note">{text("请先安装对应插件。", "Install the corresponding plugin to configure it.")}</p>}
      <SettingDisclosure title={text(plugin ? "插件管理偏好" : "主题管理偏好", plugin ? "Plugin management preferences" : "Theme management preferences")}>
        {plugin && <SettingRow title={text("受限模式", "Restricted mode")} description={text("开启后暂停插件，保留安装与配置。", "Pause plugins while keeping installations and settings.")} control={<SettingToggle checked={safeMode} ariaLabel={text("受限模式", "Restricted mode")} onChange={next => void run(() => extensionService.setSafeMode(next))} />} />}
        <SettingRow title={text("自动检查更新", "Check updates automatically")} control={<SettingToggle checked={preferences.autoCheckUpdates} disabled={busy} ariaLabel={text("自动检查更新", "Check updates automatically")} onChange={(autoCheckUpdates) => void run(() => extensionService.setPreference({ autoCheckUpdates }))} />} />
        <SettingRow title={text("自动安装更新", "Install updates automatically")} control={<SettingToggle checked={preferences.autoUpdate} disabled={busy} ariaLabel={text("自动安装更新", "Install updates automatically")} onChange={(autoUpdate) => void run(() => extensionService.setPreference({ autoUpdate }))} />} />
        <SettingRow title={text("扩展来源", "Extension sources")} description={text(`${preferences.sources.length} 个市场源`, `${preferences.sources.length} catalog sources`)} control={<SettingActionButton onClick={() => navigate("sources")}>{text("管理来源", "Manage sources")}</SettingActionButton>} />

      {plugin && <SettingSection title={text("插件工具入口", "Plugin tool placement")}>
        <SettingRow title={text("插件快捷栏数量", "Plugin dock slots")} control={<SettingSelect
          disabled={busy}
          value={String(preferences.compactDockLimit ?? DEFAULT_COMPACT_DOCK_LIMIT)}
          ariaLabel={text("插件快捷栏数量", "Plugin dock slots")}
          options={COMPACT_DOCK_LIMITS.map((count) => ({ value: String(count), label: String(count) }))}
          onChange={(value) => void run(() => extensionService.setPreference({ compactDockLimit: Number(value) }))}
        />} />
        {installed.filter((item) => item.enabled && toolbarOwners?.has(item.key)).map((item) => <SettingRow key={`placement:${item.key}`} title={item.manifest.name} control={<SettingSelect disabled={safeMode || busy} value={preferences.compactPlacements?.[item.key] || "auto"} ariaLabel={text(`${item.manifest.name} 的入口位置`, `${item.manifest.name} placement`)} options={[{ value: "auto", label: text("自动", "Automatic") }, { value: "bottom", label: text("底栏", "Dock") }, { value: "more", label: text("更多", "More") }, { value: "settings", label: text("仅设置", "Settings only") }]} onChange={(value) => void run(() => extensionService.setCompactPlacement(item.key, value as CompactPluginPlacement))} />} />)}
      </SettingSection>}

      </SettingDisclosure>
      {plugin && onMcpAccessChange && mcpPlugins.length > 0 && <SettingSection variant="grouped" title={text("MCP 权限", "MCP access")}>
        {mcpPlugins.map(({ item, grant }) => {
          const official = item.key === SCHEDULE_TEMPLATE_PLUGIN;
          const fields = item.manifest.mcp?.settings;
          const read = fields?.read?.join(", ");
          const write = fields?.write?.join(", ");
          const description = official
            ? text("允许 Agent 列出、新建和编辑日程模板。", "Let agents list, create, and edit schedule templates.")
            : [read && text("读取 " + read, "Read " + read), write && text("修改 " + write, "Write " + write)].filter(Boolean).join(" · ");
          const checked = official ? mcpAccess?.[item.key] !== false : mcpAccess?.[item.key] === grant;
          return <SettingRow key={item.key} title={item.manifest.name} description={description}
            control={<SettingToggle checked={checked} disabled={!item.enabled || busy}
              ariaLabel={text(item.manifest.name + " MCP 权限", item.manifest.name + " MCP access")}
              onChange={(enabled) => onMcpAccessChange(item.key, enabled ? grant : false)} />} />;
        })}
      </SettingSection>}
      {!plugin && active && Boolean(active.manifest.options?.length) && <SettingSection variant="grouped" title={text("主题选项", "Theme options")}>
        {active.manifest.options!.map((option) => <SettingRow key={option.key} title={option.label} control={<ExtensionOptionControl option={option} value={extensionService.getConfig(active.key)[option.key] ?? option.default} onChange={(value) => void run(() => extensionService.saveConfig(active.key, { [option.key]: value }))} />} />)}
        <SettingRow title={text("恢复主题选项", "Restore theme options")} control={<SettingActionButton onClick={() => void run(() => extensionService.saveConfig(active.key, Object.fromEntries(active.manifest.options!.map((option) => [option.key, option.default]))))}>{text("恢复默认", "Restore defaults")}</SettingActionButton>} />
      </SettingSection>}
    </>}
    {(() => { const item = installed.find(candidate => candidate.key === fallbackSettingsKey); return <Modal open={Boolean(plugin && item)} label={item?.manifest.name ?? text("插件设置", "Plugin settings")} className="df-extension-info" onClose={() => setFallbackSettingsKey(null)}><header><h2>{item?.manifest.name}</h2><CloseButton label={text("关闭", "Close")} onClick={() => setFallbackSettingsKey(null)} /></header>{item && <><p>{item.manifest.description}</p><dl><div><dt>{text("版本", "Version")}</dt><dd>{item.manifest.version}</dd></div><div><dt>{text("作者", "Author")}</dt><dd>{item.manifest.author}</dd></div><div><dt>{text("支持平台", "Platforms")}</dt><dd>{item.manifest.platforms.join(" · ")}</dd></div></dl><p className="df-extension-meta">{text("此插件没有可配置选项。它的入口和功能会显示在应用顶栏。", "This plugin has no configurable options. Its entry and features appear in the app toolbar.")}</p></>}</Modal>; })()}
    <Modal open={view === "market"} label={text(plugin ? "插件市场" : "社区主题市场", plugin ? "Plugin market" : "Community theme market")} className="df-extension-market" onClose={() => navigate("installed")} onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); navigate("installed"); } }}>
      <header className="df-extension-market-head"><div><h2>{text(plugin ? "插件市场" : "社区主题", plugin ? "Plugin market" : "Community themes")}</h2></div><CloseButton label={text("关闭市场", "Close market")} onClick={() => navigate("installed")} /></header>
      {!plugin && <label className="df-extension-preview-control"><span>{text("预览外观", "Preview appearance")}</span><SettingSelect value={previewMode} ariaLabel={text("预览外观", "Preview appearance")} options={[{ value: "split", label: text("浅色与深色", "Light and dark") }, { value: "light", label: text("浅色", "Light") }, { value: "dark", label: text("深色", "Dark") }]} onChange={value => setPreviewMode(value as PreviewMode)} /></label>}
      {!selectedCatalog && <div className="df-extension-market-toolbar">{search}{plugin && <SettingSelect value={marketTier} ariaLabel={text("插件分类", "Plugin category")} options={[{value: "all", label: text("全部插件", "All plugins")}, {value: "official", label: tierLabel("official")}, {value: "community", label: tierLabel("community")}]} onChange={value => setMarketTier(value as "all" | PluginTier)} />}<label className="df-extension-market-filter"><span>{text("仅显示已安装", "Installed only")}</span><SettingToggle checked={onlyInstalled} ariaLabel={text("仅显示已安装", "Installed only")} onChange={setOnlyInstalled} /></label><SettingSelect value={marketSort} ariaLabel={text("市场排序", "Sort market")} options={[{ value: "name", label: text("按名称", "Name") }, { value: "author", label: text("按作者", "Author") }, ...(plugin ? [{ value: "downloads", label: text("下载量", "Downloads") }, { value: "updated", label: text("最近上传", "Recently updated") }] : [])]} onChange={setMarketSort} /><span className="df-extension-market-count">{text(`${catalog.length} 个${plugin ? "插件" : "主题"}`, `${catalog.length} ${plugin ? "plugins" : "themes"}`)}</span></div>}
      {updateControls(true)}
      <div className="df-extension-market-body">
        {(pending || notice || catalogLoading) && <p className="df-extension-note" role="status">{pending || notice || text("正在刷新市场…你可以继续浏览或返回。", "Refreshing catalog… You can keep browsing or go back.")}</p>}
        {(error || snapshot.error) && <p className="df-extension-error" role="alert">{error || snapshot.error}</p>}
        {selectedCatalog ? <article className="df-extension-detail">
          <Button onClick={() => setSelectedCatalogKey(null)}>{text("返回市场", "Back to market")}</Button>
          {!plugin && <ThemePreview entry={selectedCatalog} lang={lang} mode={previewMode} />}
          <div className="df-extension-plugin-heading">{plugin && <PluginMarketIdentity entry={selectedCatalog} />}<div><h3>{selectedCatalog.manifest.name}</h3><p className="df-extension-meta">{selectedCatalog.manifest.author} · v{selectedCatalog.manifest.version}{plugin && ` · ${tierLabel(pluginTier(selectedCatalog))}`}</p></div></div>
          <p>{selectedCatalog.manifest.description}</p>
          <dl>{plugin && (() => { const stats = catalogStats(selectedCatalog, lang); return <><div><dt>{text("下载量", "Downloads")}</dt><dd>{stats.downloads}</dd></div><div><dt>{text("最新版上传", "Latest upload")}</dt><dd>{stats.published}</dd></div></>; })()}<div><dt>{text("来源", "Source")}</dt><dd>{preferences.sources.find(source => source.id === selectedCatalog.sourceId)?.name ?? selectedCatalog.sourceId}</dd></div><div><dt>{text("最低应用版本", "Requires NavoPath")}</dt><dd>{selectedCatalog.manifest.minAppVersion}</dd></div><div><dt>{text("支持平台", "Platforms")}</dt><dd>{selectedCatalog.manifest.platforms.join(" · ")}</dd></div></dl>
          {installed.some(item => item.sourceId === selectedCatalog.sourceId && item.manifest.id === selectedCatalog.manifest.id) ? <Button onClick={() => navigate("installed")}>{text("管理已安装", "Manage installed")}</Button> : <Button variant="primary" disabled={busy} onClick={() => void run(() => extensionService.install(selectedCatalog), text(`正在安装 ${selectedCatalog.manifest.name}…`, `Installing ${selectedCatalog.manifest.name}…`))}>{text("安装", "Install")}</Button>}
        </article> : <>
          {catalog.length === 0 && !catalogLoading && !error && !snapshot.error && (
            <EmptyState announce title={query.trim() || onlyInstalled || (plugin && marketTier !== "all") ? text("没有找到匹配的扩展", "No matching extensions") : text("暂无可用扩展", "No extensions available")}>
              {query.trim() || onlyInstalled || (plugin && marketTier !== "all")
                ? <Button onClick={() => { setQuery(""); setOnlyInstalled(false); setMarketTier("all"); }}>{text("清除筛选", "Clear filters")}</Button>
                : <Button onClick={() => navigate("sources")}>{text("管理来源", "Manage sources")}</Button>}
            </EmptyState>
          )}
          {marketGroups.map(group => <section key={group.tier} className="df-extension-tier" aria-label={plugin ? tierLabel(group.tier) : undefined}>
            {plugin && <h3 className="df-extension-tier-title">{tierLabel(group.tier)}</h3>}
            <div className={plugin ? "df-extension-market-list" : "df-extension-market-grid"}>{group.items.map(entry => {
            const key = `${entry.sourceId}:${entry.manifest.id}`;
            const existing = installed.find(item => item.sourceId === entry.sourceId && item.manifest.id === entry.manifest.id);
            return <article className={plugin ? "df-extension-market-row" : "df-extension-market-card"} key={key}>
              <button type="button" className="df-extension-market-open" aria-label={text(`查看 ${entry.manifest.name}`, `View ${entry.manifest.name}`)} onClick={() => setSelectedCatalogKey(key)}>
                {!plugin && <ThemePreview entry={entry} lang={lang} mode={previewMode} />}
                {plugin && <div className="df-extension-plugin-heading"><PluginMarketIdentity entry={entry} /><div><h3>{entry.manifest.name}</h3><span className="df-extension-meta">{entry.manifest.author} · v{entry.manifest.version}</span></div></div>}
                {!plugin && <><h3>{entry.manifest.name}</h3><span className="df-extension-meta">{entry.manifest.author} · v{entry.manifest.version}</span></>}
                <p>{entry.manifest.description}</p>
              </button>
              <footer><span className="df-extension-state">{existing ? text("已安装", "Installed") : preferences.sources.find(source => source.id === entry.sourceId)?.name ?? entry.sourceId}</span>{existing && snapshot.updates[existing.key] ? <Button disabled={busy || batchRunning} onClick={() => void run(() => extensionService.update(existing.key), text("正在更新…", "Updating…"))}>{batch?.running ? (batch.current === existing.key ? text("更新中…", "Updating…") : text("等待中", "Queued")) : text("更新", "Update")}</Button> : existing ? <Button onClick={() => navigate("installed")}>{text("管理", "Manage")}</Button> : <Button variant="primary" disabled={busy} onClick={() => void run(() => extensionService.install(entry), text(`正在安装 ${entry.manifest.name}…`, `Installing ${entry.manifest.name}…`))}>{text("安装", "Install")}</Button>}</footer>
            </article>;
          })}</div></section>)}
        </>}
      </div>
    </Modal>
    {view === "url" && <SettingSection title={text("从网址安装", "Install from URL")} description={text("输入 HTTPS 扩展包地址或 GitHub 仓库地址。", "Enter an HTTPS package URL or GitHub repository URL.")}>
      {back}
      <SettingRow layout="stacked" title={text("扩展包或仓库地址", "Package or repository URL")} control={<div className="df-extension-form"><SettingTextInput value={packageUrl} placeholder="https://github.com/author/extension" ariaLabel={text("扩展包或仓库地址", "Package or repository URL")} onChange={setPackageUrl} /><SettingActionButton tone="primary" disabled={busy || !packageUrl.trim()} onClick={() => void run(async () => { await extensionService.installFromUrl(packageUrl.trim(), kind); setPackageUrl(""); navigate("installed"); }, text("正在安装…", "Installing…"))}>{text("安装", "Install")}</SettingActionButton></div>} />
    </SettingSection>}
    {view === "sources" && <SettingSection title={text("扩展来源", "Extension sources")} description={text("添加你信任的社区市场。来源名称会显示在每个扩展旁。", "Add catalogs you trust. Each package shows where it comes from.")}>
      {back}
      <div className="df-extension-sources">{preferences.sources.map((source) => <SettingRow key={source.id} title={source.name} description={source.url} control={source.id === "official" ? <span className="df-extension-state">{text("默认来源", "Default source")}</span> : <SettingActionButton disabled={busy} tone="danger" onClick={() => void run(() => extensionService.removeSource(source.id))}>{text("移除来源", "Remove source")}</SettingActionButton>} />)}</div>
      <SettingRow layout="stacked" title={text("添加来源", "Add source")} control={<div className="df-extension-form">
        <SettingTextInput value={sourceName} placeholder={text("名称（选填）", "Name (optional)")} ariaLabel={text("来源名称", "Source name")} onChange={setSourceName} />
        <SettingTextInput value={sourceUrl} placeholder="https://example.com/catalog.json" ariaLabel={text("市场地址", "Catalog URL")} onChange={setSourceUrl} />
        <SettingActionButton tone="primary" disabled={busy || !sourceUrl.trim()} onClick={() => void run(async () => { await extensionService.addSource(sourceUrl.trim(), sourceName.trim() || undefined); setSourceUrl(""); setSourceName(""); }, text("正在添加来源…", "Adding source…"))}>{text("添加来源", "Add source")}</SettingActionButton>
      </div>} />
    </SettingSection>}
    <p className="df-extension-guide"><a href="/guidelines">{text("插件 API、设计规范与 MCP 文档", "Plugin API, design standards and MCP docs")}</a></p>
  </div>;
}
