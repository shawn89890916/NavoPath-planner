import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Language } from "../types";
import { SettingActionButton, SettingColorInput, SettingDescription, SettingNumberInput, SettingRow, SettingSection, SettingSelect, SettingTextInput, SettingToggle } from "../components/SettingsControls";
import { extensionService } from "./service";
import type { ExtensionKind, ThemeOption } from "./types";
import { ExtensionMount } from "./ExtensionMount";
import "./ExtensionSettings.css";

function ThemeOptionControl({ option, value, onChange }: { option: ThemeOption; value: unknown; onChange: (value: unknown) => void }) {
  if (option.type === "boolean") return <SettingToggle checked={Boolean(value)} ariaLabel={option.label} onChange={onChange} />;
  if (option.type === "color") return <SettingColorInput value={String(value)} ariaLabel={option.label} onChange={onChange} />;
  if (option.type === "number") return <SettingNumberInput value={Number(value)} min={option.min} max={option.max} ariaLabel={option.label} onChange={onChange} />;
  return <SettingTextInput value={String(value)} ariaLabel={option.label} onChange={onChange} />;
}

export function ExtensionSettings({ lang, kind }: { lang: Language; kind: ExtensionKind }) {
  const snapshot = useSyncExternalStore(extensionService.subscribe, extensionService.getSnapshot);
  const { preferences, safeMode, busy } = snapshot;
  const zh = lang === "zh";
  const text = (cn: string, en: string) => zh ? cn : en;
  const [query, setQuery] = useState("");
  const [browse, setBrowse] = useState(false);
  const [sources, setSources] = useState(false);
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [packageUrl, setPackageUrl] = useState("");
  const [pageId, setPageId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const installed = Object.values(preferences.installed).filter((item) => item.manifest.kind === kind);
  const matches = (name: string, description: string, author: string) => `${name} ${description} ${author}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
  const filtered = installed.filter(({ manifest }) => matches(manifest.name, manifest.description, manifest.author));
  const catalog = snapshot.catalog.filter(({ manifest }) => manifest.kind === kind && matches(manifest.name, manifest.description, manifest.author));
  const page = snapshot.settingsPages.find((item) => item.id === pageId);
  const active = installed.find((item) => item.key === preferences.activeTheme);
  const updateCount = installed.filter((item) => snapshot.updates[item.key]).length;
  async function run(action: () => Promise<unknown>) {
    setError("");
    try { await action(); } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
  }
  useEffect(() => { if (pageId && !page) setPageId(null); }, [pageId, page]);

  if (page) return <SettingSection title={page.name}>
    <SettingActionButton onClick={() => setPageId(null)}>{text("返回插件", "Back to plugins")}</SettingActionButton>
    <ExtensionMount contribution={page} />
  </SettingSection>;

  return <div className="df-extensions" aria-busy={busy}>
    <SettingSection anchor={kind === "plugin" ? "plugins" : "themes"} title={kind === "plugin" ? text("插件", "Plugins") : text("主题", "Themes")} description={kind === "plugin" ? text("安装和管理独立插件。插件可以读取和修改工作区，并连接网络；请仅启用你信任的来源。", "Install and manage independent plugins. Plugins can read and change your workspace and access the network; enable sources you trust.") : text("选择社区主题，并单独调整主题选项。", "Choose a community theme and customize its options.")}>
      {kind === "plugin" && <SettingRow title={text("受限模式", "Restricted mode")} description={text("暂停全部插件执行，保留安装和配置。关闭后恢复已启用的插件。", "Pause all plugin execution while keeping installations and settings. Turn off to resume enabled plugins.")} control={<SettingToggle checked={safeMode} disabled={busy} ariaLabel={text("受限模式", "Restricted mode")} onChange={(next) => void run(() => extensionService.setSafeMode(next))} />} />}
      {kind === "theme" && <SettingRow title={text("当前主题", "Current theme")} control={<SettingSelect value={preferences.activeTheme ?? ""} ariaLabel={text("当前主题", "Current theme")} options={[{ value: "", label: text("NavoPath 默认", "NavoPath default") }, ...installed.map((item) => ({ value: item.key, label: item.manifest.name }))]} onChange={(key) => void run(() => extensionService.selectTheme(key || null))} />} />}
      <SettingRow title={text("已安装", "Installed")} description={text(`${installed.length} 个 · ${updateCount} 个可更新`, `${installed.length} installed · ${updateCount} updates`)} control={<>
        <SettingActionButton disabled={busy} onClick={() => { setBrowse((value) => !value); if (!browse) void run(() => extensionService.refreshCatalog()); }}>{browse ? text("返回已安装", "Show installed") : text("浏览市场", "Browse market")}</SettingActionButton>
        <SettingActionButton disabled={busy} onClick={() => fileInput.current?.click()}>{text("导入", "Import")}</SettingActionButton>
        <SettingActionButton disabled={busy} onClick={() => void run(() => extensionService.checkUpdates())}>{text("检查更新", "Check updates")}</SettingActionButton>
      </>} />
      <input ref={fileInput} className="df-extension-file" type="file" accept=".zip,.navopackage.json,application/zip,application/json" aria-label={text("导入扩展包", "Import extension package")} onChange={(event) => { const file = event.target.files?.[0]; if (file) void run(() => extensionService.importFile(file, kind)); event.target.value = ""; }} />
      <SettingRow title={text("从网址安装", "Install from URL")} description={text("输入 HTTPS 扩展包地址或 GitHub 仓库地址。", "Enter an HTTPS package URL or GitHub repository URL.")} control={<><SettingTextInput value={packageUrl} placeholder="https://github.com/author/extension" ariaLabel={text("扩展包或仓库地址", "Package or repository URL")} onChange={setPackageUrl} /><SettingActionButton disabled={busy || !packageUrl.trim()} onClick={() => void run(async () => { await extensionService.installFromUrl(packageUrl.trim(), kind); setPackageUrl(""); })}>{text("安装", "Install")}</SettingActionButton></>} />
      <SettingRow title={text("自动检查更新", "Check updates automatically")} control={<SettingToggle checked={preferences.autoCheckUpdates} ariaLabel={text("自动检查更新", "Check updates automatically")} onChange={(autoCheckUpdates) => void run(() => extensionService.setPreference({ autoCheckUpdates }))} />} />
      <SettingRow title={text("自动安装更新", "Install updates automatically")} description={text("仅更新已安装的扩展。", "Updates installed extensions only.")} control={<SettingToggle checked={preferences.autoUpdate} ariaLabel={text("自动安装更新", "Install updates automatically")} onChange={(autoUpdate) => void run(() => extensionService.setPreference({ autoUpdate }))} />} />
      <SettingRow title={text("扩展来源", "Extension sources")} description={text(`${preferences.sources.length} 个 HTTPS 市场源`, `${preferences.sources.length} HTTPS catalog sources`)} control={<SettingActionButton onClick={() => setSources((value) => !value)}>{sources ? text("收起", "Collapse") : text("管理来源", "Manage sources")}</SettingActionButton>} />
      {sources && <div className="df-extension-sources">
        {preferences.sources.map((source) => <SettingRow key={source.id} title={source.name} description={source.url} control={<SettingActionButton disabled={busy || source.id === "official"} tone="danger" onClick={() => void run(() => extensionService.removeSource(source.id))}>{source.id === "official" ? text("默认来源", "Default source") : text("移除来源", "Remove source")}</SettingActionButton>} />)}
        <SettingRow title={text("来源名称", "Source name")} control={<SettingTextInput value={sourceName} ariaLabel={text("来源名称", "Source name")} onChange={setSourceName} />} />
        <SettingRow title={text("市场地址", "Catalog URL")} description={text("输入 HTTPS 索引地址。", "Enter an HTTPS catalog URL.")} control={<><SettingTextInput value={sourceUrl} placeholder="https://example.com/catalog.json" ariaLabel={text("市场地址", "Catalog URL")} onChange={setSourceUrl} /><SettingActionButton disabled={busy || !sourceUrl.trim()} onClick={() => void run(async () => { await extensionService.addSource(sourceUrl.trim(), sourceName.trim() || undefined); setSourceUrl(""); setSourceName(""); })}>{text("添加来源", "Add source")}</SettingActionButton></>} />
      </div>}
      <SettingRow title={browse ? text("搜索市场", "Search market") : text("搜索已安装", "Search installed")} control={<SettingTextInput value={query} ariaLabel={text("搜索扩展", "Search extensions")} onChange={setQuery} />} />
      {(error || snapshot.error) && <p className="df-extension-error" role="alert">{error || snapshot.error}</p>}
      {browse ? <div className="df-extension-list">
        {catalog.length === 0 && <SettingDescription>{busy ? text("正在载入市场…", "Loading catalog…") : text("没有匹配的扩展。可添加来源或导入扩展包。", "No matching extensions. Add a source or import a package.")}</SettingDescription>}
        {catalog.map((entry) => {
          const existing = installed.find((item) => item.sourceId === entry.sourceId && item.manifest.id === entry.manifest.id);
          return <SettingRow key={`${entry.sourceId}:${entry.manifest.id}`} title={entry.manifest.name} description={<>{entry.manifest.description}<br />{entry.manifest.author} · v{entry.manifest.version} · {preferences.sources.find((source) => source.id === entry.sourceId)?.name ?? entry.sourceId}</>} control={<SettingActionButton disabled={busy || Boolean(existing)} onClick={() => void run(() => extensionService.install(entry))}>{existing ? text("已安装", "Installed") : text("安装", "Install")}</SettingActionButton>} />;
        })}
      </div> : <div className="df-extension-list">
        {filtered.length === 0 && <SettingDescription>{text("暂无匹配的已安装扩展。", "No matching installed extensions.")}</SettingDescription>}
        {filtered.map((item) => {
          const pages = snapshot.settingsPages.filter((contribution) => contribution.owner === item.key || contribution.owner === item.manifest.id);
          return <SettingRow key={item.key} title={item.manifest.name} description={<>{item.manifest.description}<br />{item.manifest.author} · v{item.manifest.version} · {preferences.sources.find(source => source.id === item.sourceId)?.name ?? item.sourceId} · {snapshot.status[item.key] || (item.enabled ? text("已启用", "Enabled") : text("已停用", "Disabled"))}</>} control={<>
            {kind === "plugin" && <SettingToggle checked={item.enabled} disabled={busy || safeMode} ariaLabel={`${text("启用", "Enable")} ${item.manifest.name}`} onChange={(enabled) => void run(() => extensionService.toggle(item.key, enabled))} />}
            {pages.map((contribution) => <SettingActionButton key={contribution.id} onClick={() => setPageId(contribution.id)}>{contribution.name}</SettingActionButton>)}
            {snapshot.updates[item.key] && <SettingActionButton disabled={busy} onClick={() => void run(() => extensionService.update(item.key))}>{text("更新", "Update")} {snapshot.updates[item.key].manifest.version}</SettingActionButton>}
            {item.previous && <SettingActionButton disabled={busy} onClick={() => void run(() => extensionService.rollback(item.key))}>{text("回退", "Roll back")} {item.previous.manifest.version}</SettingActionButton>}
            <SettingActionButton disabled={busy} tone="danger" onClick={() => { if (confirmation === item.key) { setConfirmation(null); void run(() => extensionService.uninstall(item.key)); } else setConfirmation(item.key); }}>{confirmation === item.key ? text("确认卸载", "Confirm uninstall") : text("卸载", "Uninstall")}</SettingActionButton>
            {confirmation === item.key && <SettingActionButton onClick={() => setConfirmation(null)}>{text("取消", "Cancel")}</SettingActionButton>}
          </>} />;
        })}
      </div>}
      <SettingDescription><a href="/plugin-guide">{text("插件、主题与 MCP 使用指南", "Plugin, theme and MCP guide")}</a></SettingDescription>
    </SettingSection>
    {kind === "theme" && active && Boolean(active.manifest.options?.length) && <SettingSection title={text("主题选项", "Theme options")}>
      {active.manifest.options!.map((option) => <SettingRow key={option.key} title={option.label} control={<ThemeOptionControl option={option} value={extensionService.getConfig(active.key)[option.key] ?? option.default} onChange={(value) => void run(() => extensionService.saveConfig(active.key, { [option.key]: value }))} />} />)}
      <SettingRow title={text("恢复主题选项", "Restore theme options")} control={<SettingActionButton onClick={() => void run(() => extensionService.saveConfig(active.key, Object.fromEntries(active.manifest.options!.map((option) => [option.key, option.default]))))}>{text("恢复默认", "Restore defaults")}</SettingActionButton>} />
    </SettingSection>}
  </div>;
}
