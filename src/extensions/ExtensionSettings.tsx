import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Language } from "../types";
import { SettingActionButton, SettingColorInput, SettingDescription, SettingNumberInput, SettingRow, SettingSection, SettingSelect, SettingTextInput, SettingToggle } from "../components/SettingsControls";
import { ActionDisclosure, Button, CloseButton, Modal } from "../components/UiPrimitives";
import { UiSearchIcon } from "../components/UiIcons";
import { extensionService } from "./service";
import type { CatalogEntry, CompactPluginPlacement, ExtensionKind, ThemeOption } from "./types";
import { getAppHeaderPlugins } from "./compactDock";
import { COMPACT_DOCK_LIMITS, DEFAULT_COMPACT_DOCK_LIMIT } from "./packages";
import { ExtensionMount } from "./ExtensionMount";
import "./ExtensionSettings.css";

function ThemeOptionControl({ option, value, onChange }: { option: ThemeOption; value: unknown; onChange: (value: unknown) => void }) {
  if (option.type === "boolean") return <SettingToggle checked={Boolean(value)} ariaLabel={option.label} onChange={onChange} />;
  if (option.type === "color") return <SettingColorInput value={String(value)} ariaLabel={option.label} onChange={onChange} />;
  if (option.type === "number") return <SettingNumberInput value={Number(value)} min={option.min} max={option.max} ariaLabel={option.label} onChange={onChange} />;
  return <SettingTextInput value={String(value)} ariaLabel={option.label} onChange={onChange} />;
}

type PreviewMode = "split" | "light" | "dark";
function PluginMarketIdentity({ name, iconUrl }: { name: string; iconUrl?: string }) {
  const [failed, setFailed] = useState(false);
  return <span className="df-extension-plugin-icon" aria-hidden="true">{iconUrl && !failed ? <img src={iconUrl} alt="" loading="lazy" onError={() => setFailed(true)} /> : Array.from(name.trim())[0]?.toLocaleUpperCase() || "P"}</span>;
}
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

export function ExtensionSettings({ lang, kind, settingsPageId, onSelectPage }: { lang: Language; kind: ExtensionKind; settingsPageId?: string | null; onSelectPage?: (id: string | null) => void }) {
  const snapshot = useSyncExternalStore(extensionService.subscribe, extensionService.getSnapshot);
  const { preferences, busy, safeMode, catalogLoading, checkingUpdates } = snapshot;
  const zh = lang === "zh", plugin = kind === "plugin";
  const text = (cn: string, en: string) => zh ? cn : en;
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"installed" | "market" | "sources" | "url">("installed");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [packageUrl, setPackageUrl] = useState("");
  const [localPageId, setLocalPageId] = useState<string | null>(null);
  const pageId = settingsPageId === undefined ? localPageId : settingsPageId;
  const setPageId = onSelectPage || setLocalPageId;
  const [onlyInstalled, setOnlyInstalled] = useState(false);
  const [marketSort, setMarketSort] = useState("name");
  const [previewMode, setPreviewMode] = useState<PreviewMode>("split");
  const [selectedCatalogKey, setSelectedCatalogKey] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState("");
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [fallbackSettingsKey, setFallbackSettingsKey] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const installed = Object.values(preferences.installed).filter((item) => item.manifest.kind === kind);
  const toolbarOwners = plugin ? getAppHeaderPlugins(snapshot).owners : undefined;
  const matches = (name: string, description: string, author: string) => `${name} ${description} ${author}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
  const filtered = installed.filter(({ manifest }) => matches(manifest.name, manifest.description, manifest.author));
  const catalog = snapshot.catalog.filter(({ manifest, sourceId }) => manifest.kind === kind && matches(manifest.name, manifest.description, manifest.author) && (!onlyInstalled || installed.some(item => item.sourceId === sourceId && item.manifest.id === manifest.id))).sort((a, b) => marketSort === "downloads" ? (b.downloads ?? -1) - (a.downloads ?? -1) : marketSort === "updated" ? (Date.parse(b.publishedAt || "") || 0) - (Date.parse(a.publishedAt || "") || 0) : a.manifest[marketSort === "author" ? "author" : "name"].localeCompare(b.manifest[marketSort === "author" ? "author" : "name"], lang));
  const selectedCatalog = snapshot.catalog.find(entry => `${entry.sourceId}:${entry.manifest.id}` === selectedCatalogKey && entry.manifest.kind === kind);
  const page = snapshot.settingsPages.find((item) => item.id === pageId);
  const active = installed.find((item) => item.key === preferences.activeTheme);
  const updateCount = installed.filter((item) => snapshot.updates[item.key]).length;
  async function run(action: () => Promise<unknown>, label = "") {
    setError(""); setNotice(""); if (label) setPending(label);
    try { await action(); } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
    finally { if (label) setPending(current => current === label ? "" : current); }
  }
  function navigate(next: typeof view) { setView(next); setQuery(""); setSelectedCatalogKey(null); setConfirmation(null); setError(""); setNotice(""); }
  function browseMarket() { navigate("market"); void run(() => extensionService.refreshCatalog()); }
  function statusLabel(value: string) { const parts = value.split(" / "); return parts.length === 2 ? parts[zh ? 0 : 1] : value; }
  useEffect(() => { if (pageId && !page) setPageId(null); }, [pageId, page]);
  const search = <label className="df-extension-search"><UiSearchIcon size={16} /><SettingTextInput value={query} placeholder={view === "market" ? text("搜索名称、作者或描述…", "Search name, author or description…") : text(plugin ? "搜索已安装的插件…" : "搜索已安装的主题…", plugin ? "Search installed plugins…" : "Search installed themes…")} ariaLabel={text("搜索扩展", "Search extensions")} onChange={setQuery} /></label>;
  const back = <div className="df-extension-back"><SettingActionButton onClick={() => navigate("installed")}>{text(plugin ? "返回插件" : "返回主题", plugin ? "Back to plugins" : "Back to themes")}</SettingActionButton></div>;

  if (page) return <div className="df-extensions"><SettingSection presentation="plain" title={page.name}>
    <div className="df-extension-back"><SettingActionButton onClick={() => setPageId(null)}>{text("返回插件", "Back to plugins")}</SettingActionButton></div>
    <ExtensionMount contribution={page} />
  </SettingSection></div>;

  return <div className="df-extensions">
    <input ref={fileInput} className="df-extension-file" type="file" accept=".zip,.navopackage.json,application/zip,application/json" aria-label={text("导入扩展包", "Import extension package")} onChange={(event) => { const file = event.target.files?.[0]; if (file) void run(() => extensionService.importFile(file, kind), text("正在导入…", "Importing…")); event.target.value = ""; }} />
    {(error || snapshot.error) && <p className="df-extension-error" role="alert">{error || snapshot.error}</p>}
    <div className="df-extension-feedback" role="status">{pending || notice}</div>
    {(view === "installed" || view === "market") && <>
      <SettingSection presentation="plain" anchor={plugin ? "plugins" : "themes"} title={text(plugin ? "社区插件" : "主题", plugin ? "Community plugins" : "Themes")} description={plugin ? text("插件可以访问工作区与网络，请启用你信任的插件。", "Plugins can access your workspace and the network. Enable plugins you trust.") : text("选择主题，或探索社区制作的外观。", "Choose a theme or explore community designs.")}>
        {plugin ? <SettingRow title={text("受限模式", "Restricted mode")} description={text(safeMode ? "已暂停所有插件。关闭后恢复已启用的插件。" : "开启后暂停插件，保留安装与配置。", safeMode ? "All plugins are paused. Turn off to resume enabled plugins." : "Pause plugins while keeping installations and settings.")} control={<SettingToggle checked={safeMode} ariaLabel={text("受限模式", "Restricted mode")} onChange={(next) => void run(() => extensionService.setSafeMode(next))} />} /> : <SettingRow title={text("当前主题", "Current theme")} control={<SettingSelect value={preferences.activeTheme ?? ""} disabled={busy} ariaLabel={text("当前主题", "Current theme")} options={[{ value: "", label: text("NavoPath 默认", "NavoPath default") }, ...installed.map((item) => ({ value: item.key, label: item.manifest.name }))]} onChange={(key) => void run(() => extensionService.selectTheme(key || null), text("正在切换主题…", "Applying theme…"))} />} />}
        <SettingRow title={text(plugin ? "社区插件市场" : "社区主题", plugin ? "Community plugin market" : "Community themes")} description={text(plugin ? "浏览并安装社区制作的插件。" : "浏览并安装社区制作的主题。", plugin ? "Discover plugins made by the community." : "Discover themes made by the community.")} control={<SettingActionButton tone="primary" onClick={browseMarket}>{text("浏览市场", "Browse market")}</SettingActionButton>} />
        <SettingRow title={text(plugin ? "安装插件" : "安装主题", plugin ? "Install a plugin" : "Install a theme")} description={text("导入本地文件，或从发布网址安装。", "Import a file or install from a release URL.")} control={<><SettingActionButton onClick={() => fileInput.current?.click()}>{text("导入", "Import")}</SettingActionButton><ActionDisclosure label={text("更多安装方式", "More installation options")}><SettingActionButton onClick={() => navigate("url")}>{text("从网址安装", "Install from URL")}</SettingActionButton></ActionDisclosure></>} />
        <SettingRow title={text("检查更新", "Check updates")} description={text(`${installed.length} 个已安装${updateCount ? ` · ${updateCount} 个可更新` : ""}`, `${installed.length} installed${updateCount ? ` · ${updateCount} updates` : ""}`)} control={<SettingActionButton pending={Boolean(checkingUpdates)} onClick={() => void run(async () => { await extensionService.checkUpdates(); setNotice(text("更新检查完成。", "Update check complete.")); })}>{text("检查更新", "Check updates")}</SettingActionButton>} />
        <SettingRow title={text("自动检查更新", "Check updates automatically")} control={<SettingToggle checked={preferences.autoCheckUpdates} disabled={busy} ariaLabel={text("自动检查更新", "Check updates automatically")} onChange={(autoCheckUpdates) => void run(() => extensionService.setPreference({ autoCheckUpdates }))} />} />
        <SettingRow title={text("自动安装更新", "Install updates automatically")} description={text("关闭时，由你决定何时升级。", "When off, you choose when to upgrade.")} control={<SettingToggle checked={preferences.autoUpdate} disabled={busy} ariaLabel={text("自动安装更新", "Install updates automatically")} onChange={(autoUpdate) => void run(() => extensionService.setPreference({ autoUpdate }))} />} />
        <SettingRow title={text("扩展来源", "Extension sources")} description={text(`${preferences.sources.length} 个市场源`, `${preferences.sources.length} catalog sources`)} control={<SettingActionButton onClick={() => navigate("sources")}>{text("管理来源", "Manage sources")}</SettingActionButton>} />
      </SettingSection>
      {plugin && <SettingSection presentation="plain" title={text("插件工具入口", "Plugin tool placement")}>
        <SettingRow title={text("插件快捷栏数量", "Plugin dock slots")} control={<SettingSelect
          disabled={busy}
          value={String(preferences.compactDockLimit ?? DEFAULT_COMPACT_DOCK_LIMIT)}
          ariaLabel={text("插件快捷栏数量", "Plugin dock slots")}
          options={COMPACT_DOCK_LIMITS.map((count) => ({ value: String(count), label: String(count) }))}
          onChange={(value) => void run(() => extensionService.setPreference({ compactDockLimit: Number(value) }))}
        />} />
        {installed.filter((item) => item.enabled && toolbarOwners?.has(item.key)).map((item) => <SettingRow key={`placement:${item.key}`} title={item.manifest.name} control={<SettingSelect disabled={safeMode || busy} value={preferences.compactPlacements?.[item.key] || "auto"} ariaLabel={text(`${item.manifest.name} 的入口位置`, `${item.manifest.name} placement`)} options={[{ value: "auto", label: text("自动", "Automatic") }, { value: "bottom", label: text("底栏", "Dock") }, { value: "more", label: text("更多", "More") }, { value: "settings", label: text("仅设置", "Settings only") }]} onChange={(value) => void run(() => extensionService.setCompactPlacement(item.key, value as CompactPluginPlacement))} />} />)}
      </SettingSection>}
      <SettingSection presentation="plain" title={<>{text(plugin ? "已安装插件" : "已安装主题", plugin ? "Installed plugins" : "Installed themes")} <span className="df-extension-count">{installed.length}</span></>}>
        {installed.length > 0 && search}
        {safeMode && plugin && installed.length > 0 && <p className="df-extension-note">{text("受限模式已暂停插件。关闭上方开关后即可启用。", "Restricted mode pauses plugins. Turn it off above to enable them.")}</p>}
        <div className="df-extension-list">
          {filtered.length === 0 && <div className="df-extension-empty"><p>{query ? text("没有找到匹配项。", "No matches found.") : text(plugin ? "还没有安装插件" : "还没有安装社区主题", plugin ? "No plugins installed yet" : "No community themes installed yet")}</p><SettingDescription>{text(plugin ? "从社区市场选择插件，也可以导入自己的插件。" : "保留默认外观，或从社区找到喜欢的主题。", plugin ? "Explore the market or import your own plugin." : "Keep the default appearance or find a theme you like.")}</SettingDescription></div>}
          {filtered.map((item) => {
            const ownedPages = snapshot.settingsPages.filter((contribution) => contribution.owner === item.key);
            const pages = Array.from(new Map((ownedPages.length ? ownedPages : snapshot.settingsPages.filter((contribution) => contribution.owner === item.manifest.id)).map((contribution) => [contribution.name.trim().toLocaleLowerCase(), contribution])).values());
            const selected = preferences.activeTheme === item.key;
            return <SettingRow key={item.key} title={item.manifest.name} description={<>{item.manifest.description}<span className="df-extension-meta">v{item.manifest.version} · {item.manifest.author} · {preferences.sources.find(source => source.id === item.sourceId)?.name ?? item.sourceId}</span><span className="df-extension-state">{plugin ? statusLabel(snapshot.status[item.key] || (item.enabled ? text("已启用", "Enabled") : text("已停用", "Disabled"))) : selected ? text("使用中", "Active") : text("已安装", "Installed")}</span></>} control={confirmation === item.key ? <><SettingActionButton disabled={busy} tone="danger" onClick={() => void run(async () => { await extensionService.uninstall(item.key); setConfirmation(null); }, text("正在卸载…", "Uninstalling…"))}>{text("确认卸载", "Confirm uninstall")}</SettingActionButton><SettingActionButton onClick={() => setConfirmation(null)}>{text("取消", "Cancel")}</SettingActionButton></> : <>
              {pages.length > 0 ? pages.map((contribution) => <SettingActionButton key={contribution.id} ariaLabel={text(`${item.manifest.name} 设置`, `${item.manifest.name} settings`)} onClick={() => setPageId(contribution.id)}>{pages.length === 1 ? text("设置", "Settings") : contribution.name}</SettingActionButton>) : plugin && <SettingActionButton ariaLabel={text(`${item.manifest.name} 设置`, `${item.manifest.name} settings`)} onClick={() => setFallbackSettingsKey(item.key)}>{text("设置", "Settings")}</SettingActionButton>}
              {!plugin && !selected && <SettingActionButton disabled={busy} onClick={() => void run(() => extensionService.selectTheme(item.key), text("正在切换主题…", "Applying theme…"))}>{text("使用", "Use theme")}</SettingActionButton>}
              {snapshot.updates[item.key] && <SettingActionButton pending={pending === (zh ? "正在更新…" : "Updating…")} disabled={busy && pending !== (zh ? "正在更新…" : "Updating…")} onClick={() => void run(() => extensionService.update(item.key), text("正在更新…", "Updating…"))}>{pending === (zh ? "正在更新…" : "Updating…") ? text("正在更新…", "Updating…") : text("更新", "Update")}</SettingActionButton>}
              <ActionDisclosure label={text(`${item.manifest.name} 更多操作`, `More actions for ${item.manifest.name}`)}>
                {item.previous && <SettingActionButton disabled={busy} onClick={() => void run(() => extensionService.rollback(item.key), text("正在回退…", "Rolling back…"))}>{text("回退", "Roll back")} {item.previous.manifest.version}</SettingActionButton>}
                <SettingActionButton disabled={busy} tone="danger" onClick={() => setConfirmation(item.key)}>{text("卸载", "Uninstall")}</SettingActionButton>
              </ActionDisclosure>
              {plugin && <SettingToggle checked={item.enabled} disabled={busy || safeMode} ariaLabel={`${text("启用", "Enable")} ${item.manifest.name}`} onChange={(enabled) => void run(() => extensionService.toggle(item.key, enabled), text("正在应用…", "Applying…"))} />}
            </>} />;
          })}
        </div>
      </SettingSection>
      {!plugin && active && Boolean(active.manifest.options?.length) && <SettingSection presentation="plain" title={text("主题选项", "Theme options")}>
        {active.manifest.options!.map((option) => <SettingRow key={option.key} title={option.label} control={<ThemeOptionControl option={option} value={extensionService.getConfig(active.key)[option.key] ?? option.default} onChange={(value) => void run(() => extensionService.saveConfig(active.key, { [option.key]: value }))} />} />)}
        <SettingRow title={text("恢复主题选项", "Restore theme options")} control={<SettingActionButton onClick={() => void run(() => extensionService.saveConfig(active.key, Object.fromEntries(active.manifest.options!.map((option) => [option.key, option.default]))))}>{text("恢复默认", "Restore defaults")}</SettingActionButton>} />
      </SettingSection>}
    </>}
    {(() => { const item = installed.find(candidate => candidate.key === fallbackSettingsKey); return <Modal open={Boolean(plugin && item)} label={item?.manifest.name ?? text("插件设置", "Plugin settings")} className="df-extension-info" onClose={() => setFallbackSettingsKey(null)}><header><h2>{item?.manifest.name}</h2><CloseButton label={text("关闭", "Close")} onClick={() => setFallbackSettingsKey(null)} /></header>{item && <><p>{item.manifest.description}</p><dl><div><dt>{text("版本", "Version")}</dt><dd>{item.manifest.version}</dd></div><div><dt>{text("作者", "Author")}</dt><dd>{item.manifest.author}</dd></div><div><dt>{text("支持平台", "Platforms")}</dt><dd>{item.manifest.platforms.join(" · ")}</dd></div></dl><p className="df-extension-meta">{text("此插件没有可配置选项。它的入口和功能会显示在应用顶栏。", "This plugin has no configurable options. Its entry and features appear in the app toolbar.")}</p></>}</Modal>; })()}
    <Modal open={view === "market"} label={text(plugin ? "社区插件市场" : "社区主题市场", plugin ? "Community plugin market" : "Community theme market")} className="df-extension-market" onClose={() => navigate("installed")} onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); navigate("installed"); } }}>
      <header className="df-extension-market-head"><div><h2>{text(plugin ? "社区插件市场" : "社区主题", plugin ? "Community plugin market" : "Community themes")}</h2><p>{text(plugin ? "为你的工作区添加新能力。" : "找到适合你的工作区外观。", plugin ? "Add new capabilities to your workspace." : "Find an appearance that feels right for your workspace.")}</p></div><CloseButton label={text("关闭市场", "Close market")} onClick={() => navigate("installed")} /></header>
      {!plugin && <label className="df-extension-preview-control"><span>{text("预览外观", "Preview appearance")}</span><SettingSelect value={previewMode} ariaLabel={text("预览外观", "Preview appearance")} options={[{ value: "split", label: text("浅色与深色", "Light and dark") }, { value: "light", label: text("浅色", "Light") }, { value: "dark", label: text("深色", "Dark") }]} onChange={value => setPreviewMode(value as PreviewMode)} /></label>}
      {!selectedCatalog && <div className="df-extension-market-toolbar">{search}<label className="df-extension-market-filter"><span>{text("仅显示已安装", "Installed only")}</span><SettingToggle checked={onlyInstalled} ariaLabel={text("仅显示已安装", "Installed only")} onChange={setOnlyInstalled} /></label><SettingSelect value={marketSort} ariaLabel={text("市场排序", "Sort market")} options={[{ value: "name", label: text("按名称", "Name") }, { value: "author", label: text("按作者", "Author") }, ...(plugin ? [{ value: "downloads", label: text("下载量", "Downloads") }, { value: "updated", label: text("最近上传", "Recently updated") }] : [])]} onChange={setMarketSort} /><span className="df-extension-market-count">{text(`${catalog.length} 个${plugin ? "插件" : "主题"}`, `${catalog.length} ${plugin ? "plugins" : "themes"}`)}</span></div>}
      <div className="df-extension-market-body">
        {(pending || notice || catalogLoading) && <p className="df-extension-note" role="status">{pending || notice || text("正在刷新市场…你可以继续浏览或返回。", "Refreshing catalog… You can keep browsing or go back.")}</p>}
        {(error || snapshot.error) && <p className="df-extension-error" role="alert">{error || snapshot.error}</p>}
        {selectedCatalog ? <article className="df-extension-detail">
          <Button onClick={() => setSelectedCatalogKey(null)}>{text("返回市场", "Back to market")}</Button>
          {!plugin && <ThemePreview entry={selectedCatalog} lang={lang} mode={previewMode} />}
          <div className="df-extension-plugin-heading"><PluginMarketIdentity name={selectedCatalog.manifest.name} iconUrl={plugin ? selectedCatalog.iconUrl : undefined} /><div><h3>{selectedCatalog.manifest.name}</h3><p className="df-extension-meta">{selectedCatalog.manifest.author} · v{selectedCatalog.manifest.version}</p></div></div>
          <p>{selectedCatalog.manifest.description}</p>
          <dl>{plugin && (() => { const stats = catalogStats(selectedCatalog, lang); return <><div><dt>{text("下载量", "Downloads")}</dt><dd>{stats.downloads}</dd></div><div><dt>{text("最新版上传", "Latest upload")}</dt><dd>{stats.published}</dd></div></>; })()}<div><dt>{text("来源", "Source")}</dt><dd>{preferences.sources.find(source => source.id === selectedCatalog.sourceId)?.name ?? selectedCatalog.sourceId}</dd></div><div><dt>{text("最低应用版本", "Requires NavoPath")}</dt><dd>{selectedCatalog.manifest.minAppVersion}</dd></div><div><dt>{text("支持平台", "Platforms")}</dt><dd>{selectedCatalog.manifest.platforms.join(" · ")}</dd></div></dl>
          {installed.some(item => item.sourceId === selectedCatalog.sourceId && item.manifest.id === selectedCatalog.manifest.id) ? <Button onClick={() => navigate("installed")}>{text("管理已安装", "Manage installed")}</Button> : <Button variant="primary" disabled={busy} onClick={() => void run(() => extensionService.install(selectedCatalog), text(`正在安装 ${selectedCatalog.manifest.name}…`, `Installing ${selectedCatalog.manifest.name}…`))}>{text("安装", "Install")}</Button>}
        </article> : <>
          {catalog.length === 0 && !catalogLoading && <div className="df-extension-empty"><p>{text("没有找到匹配的扩展。", "No matching extensions.")}</p><Button onClick={() => void run(() => extensionService.refreshCatalog())}>{text("重新加载", "Reload catalog")}</Button><Button onClick={() => navigate("sources")}>{text("管理来源", "Manage sources")}</Button></div>}
          <div className="df-extension-market-grid">{catalog.map(entry => {
            const key = `${entry.sourceId}:${entry.manifest.id}`;
            const existing = installed.find(item => item.sourceId === entry.sourceId && item.manifest.id === entry.manifest.id);
            return <article className="df-extension-market-card" key={key}>
              <button type="button" className="df-extension-market-open" aria-label={text(`查看 ${entry.manifest.name}`, `View ${entry.manifest.name}`)} onClick={() => setSelectedCatalogKey(key)}>
                {!plugin && <ThemePreview entry={entry} lang={lang} mode={previewMode} />}
                {plugin && <div className="df-extension-plugin-heading"><PluginMarketIdentity name={entry.manifest.name} iconUrl={entry.iconUrl} /><div><h3>{entry.manifest.name}</h3><span className="df-extension-meta">{entry.manifest.author} · v{entry.manifest.version}</span></div></div>}
                {!plugin && <><h3>{entry.manifest.name}</h3><span className="df-extension-meta">{entry.manifest.author} · v{entry.manifest.version}</span></>}
                <p>{entry.manifest.description}</p>
                {plugin && <span className="df-extension-market-stats">{(() => { const stats = catalogStats(entry, lang); return <>{text("下载", "Downloads")} {stats.downloads}<span aria-hidden="true">·</span>{text("上传", "Updated")} {stats.published}</>; })()}</span>}
              </button>
              <footer><span className="df-extension-state">{existing ? text("已安装", "Installed") : preferences.sources.find(source => source.id === entry.sourceId)?.name ?? entry.sourceId}</span>{existing ? <Button onClick={() => navigate("installed")}>{text("管理", "Manage")}</Button> : <Button variant="primary" disabled={busy} onClick={() => void run(() => extensionService.install(entry), text(`正在安装 ${entry.manifest.name}…`, `Installing ${entry.manifest.name}…`))}>{text("安装", "Install")}</Button>}</footer>
            </article>;
          })}</div>
        </>}
      </div>
    </Modal>
    {view === "url" && <SettingSection presentation="plain" title={text("从网址安装", "Install from URL")} description={text("输入 HTTPS 扩展包地址或 GitHub 仓库地址。", "Enter an HTTPS package URL or GitHub repository URL.")}>
      {back}
      <SettingRow layout="stacked" title={text("扩展包或仓库地址", "Package or repository URL")} control={<div className="df-extension-form"><SettingTextInput value={packageUrl} placeholder="https://github.com/author/extension" ariaLabel={text("扩展包或仓库地址", "Package or repository URL")} onChange={setPackageUrl} /><SettingActionButton tone="primary" disabled={busy || !packageUrl.trim()} onClick={() => void run(async () => { await extensionService.installFromUrl(packageUrl.trim(), kind); setPackageUrl(""); navigate("installed"); }, text("正在安装…", "Installing…"))}>{text("安装", "Install")}</SettingActionButton></div>} />
    </SettingSection>}
    {view === "sources" && <SettingSection presentation="plain" title={text("扩展来源", "Extension sources")} description={text("添加你信任的社区市场。来源名称会显示在每个扩展旁。", "Add catalogs you trust. Each package shows where it comes from.")}>
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
