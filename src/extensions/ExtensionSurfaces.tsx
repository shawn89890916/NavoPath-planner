import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Language } from "../types";
import { ActionDisclosure, Button, CloseButton, IconButton, Modal } from "../components/UiPrimitives";
import { RightUtilityPanel, utilityPanelCloseLabel } from "../components/RightUtilityPanel";
import { ExtensionMount } from "./ExtensionMount";
import { extensionService } from "./service";
import { UiRefreshIcon, UiZapIcon, UiPencilIcon, UiMetricsIcon, UiListChecksIcon, UiCalendarCheckIcon } from "../components/UiIcons";
import type { ExtensionContribution, PluginUiPlacement } from "./types";
import "./ExtensionSurfaces.css";

/** Compact layouts expose the same contributions through the workspace menu. */
export function ExtensionToolsDialog({ lang, onClose, onOpenSettings, onOpenMetrics, onOpenView }: { lang: Language; onClose: () => void; onOpenSettings?: (pageId: string) => void; onOpenMetrics?: () => void; onOpenView?: (view: ExtensionContribution) => void }) {
  const snapshot = useSyncExternalStore(extensionService.subscribe, extensionService.getSnapshot);
  const empty = !snapshot.headerItems.some((item) => !item.placement || item.placement === "app-header") && !snapshot.views.some((item) => !item.planningView || (onOpenMetrics && item.nativeMode === "metrics")) && !extensionService.listCommands().length;
  const title = lang === "zh" ? "插件工具" : "Plugin tools";
  return <Modal label={title} onClose={onClose} className="df-extension-view">
    <header className="df-extension-view-heading"><h2>{title}</h2><CloseButton label={lang === "zh" ? "关闭" : "Close"} onClick={onClose} /></header>
    {empty ? <p>{lang === "zh" ? "在设置 → 插件中安装并启用插件。" : "Install and enable plugins in Settings → Plugins."}</p> : <ExtensionHeader lang={lang} onActivate={onClose} onOpenSettings={onOpenSettings} onOpenMetrics={onOpenMetrics} onOpenView={onOpenView} />}
  </Modal>;
}

/** Header entry points share the plugin lifecycle and disappear when unloaded. */
export function ExtensionHeader({ lang, onActivate, onOpenSettings, onOpenMetrics, onOpenView, placement = "app-header" }: { lang: Language; onActivate?: () => void; onOpenSettings?: (pageId: string) => void; onOpenMetrics?: () => void; onOpenView?: (view: ExtensionContribution) => void; placement?: PluginUiPlacement }) {
  const snapshot = useSyncExternalStore(extensionService.subscribe, extensionService.getSnapshot);
  const commands = extensionService.listCommands();
  const [selectedPlugin, setSelectedPlugin] = useState<string | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [dragOwner, setDragOwner] = useState<string | null>(null);
  const [dropOwner, setDropOwner] = useState<string | null>(null);
  const [hasOverflow, setHasOverflow] = useState(false);
  const hasOverflowRef = useRef(false);
  const headerRef = useRef<HTMLDivElement>(null);
  const headerViewportRef = useRef<HTMLDivElement>(null);
  const headerItemsRef = useRef<HTMLDivElement>(null);
  const label = lang === "zh" ? "插件工具" : "Plugin tools";
  const close = lang === "zh" ? "关闭" : "Close";
  const metrics = placement === "app-header" && onOpenMetrics ? snapshot.views.find((item) => item.nativeMode === "metrics") : undefined;
  const metricsLabel = lang === "zh" ? "指标" : "Metrics";
  const headerItems = snapshot.headerItems.filter((item) => (item.placement || "app-header") === placement);
  if (metrics) headerItems.push(metrics);
  const headerOwners = Array.from(new Set(headerItems.map((item) => item.owner)));
  const headerOrder = [...(snapshot.preferences.headerOrder || []).filter((owner) => headerOwners.includes(owner)), ...headerOwners.filter((owner) => !snapshot.preferences.headerOrder?.includes(owner))];
  const orderedHeaderItems = [...headerItems].sort((a, b) => headerOrder.indexOf(a.owner) - headerOrder.indexOf(b.owner));
  const launcherPlugins = placement === "app-header" ? Object.values(snapshot.preferences.installed).filter((item) => item.manifest.kind === "plugin" && item.enabled && !snapshot.safeMode && !headerOwners.includes(item.key) && !snapshot.views.some((viewItem) => viewItem.owner === item.key && viewItem.planningView)) : [];
  const launcherOwnerKeys = new Set(launcherPlugins.map((item) => item.key));
  const overflowViews = placement === "app-header" ? snapshot.views.filter((item) => !item.planningView && !launcherOwnerKeys.has(item.owner)) : [];
  const launcherPlugin = Object.values(snapshot.preferences.installed).find((item) => item.key === selectedPlugin && item.manifest.kind === "plugin");
  useEffect(() => {
    const header = headerRef.current;
    const viewport = headerViewportRef.current;
    const items = headerItemsRef.current;
    if (!header || !viewport || !items) return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const disclosure = header.querySelector<HTMLElement>(".ui-action-disclosure");
        const gap = Number.parseFloat(getComputedStyle(header).columnGap) || 0;
        const reserved = hasOverflowRef.current && disclosure ? disclosure.getBoundingClientRect().width + gap : 0;
        const next = items.scrollWidth > viewport.clientWidth + reserved + 1;
        if (next !== hasOverflowRef.current) {
          hasOverflowRef.current = next;
          setHasOverflow(next);
        }
      });
    };
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(header);
    resizeObserver.observe(viewport);
    resizeObserver.observe(items);
    const mutationObserver = new MutationObserver(measure);
    mutationObserver.observe(items, { childList: true, subtree: true, attributes: true, characterData: true });
    window.addEventListener("resize", measure);
    measure();
    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [commands.length, launcherPlugins.length, orderedHeaderItems.length, overflowViews.length]);
  async function moveHeader(owner: string, direction: -1 | 1) {
    const from = headerOrder.indexOf(owner), to = Math.max(0, Math.min(headerOrder.length - 1, from + direction));
    if (from < 0 || from === to) return;
    const next = [...headerOrder]; next.splice(from, 1); next.splice(to, 0, owner);
    try { await extensionService.setPreference({ headerOrder: next }); }
    catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
  }
  async function dropHeader(target: string) {
    if (!dragOwner || dragOwner === target) { setDragOwner(null); setDropOwner(null); return; }
    const next = [...headerOrder], from = next.indexOf(dragOwner), to = next.indexOf(target);
    if (from < 0 || to < 0) { setDragOwner(null); setDropOwner(null); return; }
    next.splice(from, 1); next.splice(to, 0, dragOwner);
    setDragOwner(null); setDropOwner(null);
    try { await extensionService.setPreference({ headerOrder: next }); }
    catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
  }
  async function runCommand(id: string) {
    setRunning(id); setError("");
    try { await extensionService.executeCommand(id); }
    catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
    finally { setRunning(null); }
  }
  const visibleCommands = placement === "app-header" ? commands : [];
  if (!headerItems.length && !launcherPlugins.length && !overflowViews.length && !visibleCommands.length && !error) return null;
  const activateLauncher = (key: string) => {
    setError("");
    const entry = snapshot.views.find((candidate) => candidate.owner === key);
    const settingsPage = snapshot.settingsPages.find((candidate) => candidate.owner === key);
    if (entry?.id === metrics?.id && metrics) onOpenMetrics?.();
    else if (entry) onOpenView?.(entry);
    else if (settingsPage && onOpenSettings) onOpenSettings(settingsPage.id);
    else setSelectedPlugin(key);
    onActivate?.();
  };

  return <div ref={headerRef} className="df-extension-header" aria-busy={Boolean(running)}>
    <div ref={headerViewportRef} className="df-extension-header-viewport" role="toolbar" aria-label={lang === "zh" ? "插件入口，可横向滚动" : "Plugin entries, horizontally scrollable"}>
      <div ref={headerItemsRef} className="df-extension-header-content">
    {orderedHeaderItems.map((item) => <div
      key={item.id}
      className="df-extension-header-item"
      data-dragging={dragOwner === item.owner || undefined}
      data-drop-target={dropOwner === item.owner && dragOwner !== item.owner || undefined}
      draggable
      onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", item.owner); setDragOwner(item.owner); }}
      onDragOver={(event) => { event.preventDefault(); setDropOwner(item.owner); }}
      onDrop={(event) => { event.preventDefault(); void dropHeader(item.owner); }}
      onDragEnd={() => { setDragOwner(null); setDropOwner(null); }}
      onClickCapture={() => { if (onActivate) window.setTimeout(onActivate, 0); }}
      onKeyDown={(event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        void moveHeader(item.owner, event.key === "ArrowLeft" ? -1 : 1);
      }}
    >{item === metrics
      ? <IconButton className="df-extension-header-launcher" label={metricsLabel} onClick={onOpenMetrics}
          icon={<UiMetricsIcon size={20} />} />
      : <ExtensionMount contribution={item} />}</div>)}
    {launcherPlugins.map((item) => {
      const iconUrl = extensionService.getPluginIcon(item.key) || snapshot.catalog.find((catalogEntry) => catalogEntry.sourceId === item.sourceId && catalogEntry.manifest.id === item.manifest.id)?.iconUrl;
      const Icon = item.manifest.id === "quick-capture" ? UiPencilIcon : item.manifest.id === "daily-overview" ? UiListChecksIcon : ["class-timetable", "schedule-templates"].includes(item.manifest.id) ? UiCalendarCheckIcon : UiZapIcon;
      return <IconButton key={`launcher:${item.key}`} className="df-extension-header-launcher" label={item.manifest.name} onClick={() => activateLauncher(item.key)} icon={iconUrl ? <img src={iconUrl} alt="" aria-hidden="true" /> : <Icon size={20} />} />;
    })}
    {overflowViews.map((item) => <Button key={`view:${item.id}`} className="df-extension-header-action" variant="ghost" title={item.name} onClick={() => { setError(""); onOpenView?.(item); onActivate?.(); }}>{item.name}</Button>)}
    {visibleCommands.map((command) => {
      const label = command.name.trim();
      const Icon = /refresh|reload|更新|刷新|重载/i.test(`${command.id} ${label}`) ? UiRefreshIcon : UiZapIcon;
      return <IconButton key={`command:${command.id}`} className="df-extension-header-launcher" disabled={Boolean(running)} label={label} onClick={() => { onActivate?.(); void runCommand(command.id); }} icon={<Icon size={20} />} />;
    })}
      </div>
    </div>
    {hasOverflow && <ActionDisclosure label={label}>
      {Array.from(new Map(orderedHeaderItems.map((item) => [item.owner, item])).values()).map((item) => <Button key={`overflow-header:${item.owner}`} className="df-extension-overflow-action" variant="ghost" onClick={() => activateLauncher(item.owner)}>{item === metrics ? metricsLabel : item.name}</Button>)}
      {launcherPlugins.map((item) => <Button key={`overflow-launcher:${item.key}`} className="df-extension-overflow-action" variant="ghost" onClick={() => activateLauncher(item.key)}>{item.manifest.name}</Button>)}
      {overflowViews.map((item) => <Button key={item.id} variant="ghost" onClick={() => { setError(""); onOpenView?.(item); onActivate?.(); }}>{item.name}</Button>)}
      {visibleCommands.map((command) => <Button key={command.id} variant="ghost" disabled={Boolean(running)} onClick={() => { onActivate?.(); void runCommand(command.id); }}>{command.name}</Button>)}
    </ActionDisclosure>}
    {error && <p className="df-extension-view-error" role="alert">{error}</p>}
    {launcherPlugin && <RightUtilityPanel label={launcherPlugin.manifest.name} closeLabel={utilityPanelCloseLabel(lang)} onClose={() => setSelectedPlugin(null)}><p>{launcherPlugin.manifest.description}</p><p className="df-extension-meta">v{launcherPlugin.manifest.version} · {launcherPlugin.manifest.author}</p></RightUtilityPanel>}
  </div>;
}
