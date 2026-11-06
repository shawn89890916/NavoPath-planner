import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import type { Language } from "../types";
import { ActionDisclosure, Button, CloseButton, IconButton, Modal } from "../components/UiPrimitives";
import { RightUtilityPanel, utilityPanelCloseLabel } from "../components/RightUtilityPanel";
import { ExtensionMount } from "./ExtensionMount";
import { extensionService } from "./service";
import { UiRefreshIcon, UiZapIcon, UiPencilIcon, UiMetricsIcon, UiListChecksIcon, UiCalendarCheckIcon, UiBellIcon, UiSearchIcon, UiSettingsIcon, UiMoreIcon } from "../components/UiIcons";
import type { CatalogEntry, ExtensionContribution, InstalledExtension, PluginUiPlacement } from "./types";
import { getAppHeaderPlugins, getCompactPluginGroups } from "./compactDock";
import { useUnifiedDrag } from "../useUnifiedDrag";
import "./ExtensionSurfaces.css";

function PluginLauncherIcon({ item, catalog, size }: { item: InstalledExtension; catalog: CatalogEntry[]; size: number }) {
  const [failedUrl, setFailedUrl] = useState<string>();
  const iconUrl = extensionService.getPluginIcon(item.key) || catalog.find((entry) => entry.sourceId === item.sourceId && entry.manifest.id === item.manifest.id)?.iconUrl;
  if (iconUrl && iconUrl !== failedUrl) return <img src={iconUrl} alt="" draggable={false} onError={() => setFailedUrl(iconUrl)} />;
  const Icon = item.manifest.id === "metrics" ? UiMetricsIcon : item.manifest.id === "quick-capture" ? UiPencilIcon : item.manifest.id === "daily-overview" ? UiListChecksIcon : ["class-timetable", "schedule-templates"].includes(item.manifest.id) ? UiCalendarCheckIcon : UiZapIcon;
  return <Icon size={size} />;
}

export function CompactPluginDock({ lang, chat, onNotifications, onSearch, onMetrics, onSettings, onOpenSettings, onOpenView, onOpenPluginTools, notificationCount = 0 }: { lang: Language; chat: ReactNode; onNotifications: () => void; onSearch: () => void; onMetrics: () => void; onSettings: () => void; onOpenSettings?: (pageId: string) => void; onOpenView?: (view: ExtensionContribution) => void; onOpenPluginTools: () => void; notificationCount?: number }) {
  const snapshot = useSyncExternalStore(extensionService.subscribe, extensionService.getSnapshot);
  const [moreOpen, setMoreOpen] = useState(false);
  const [dropZone, setDropZone] = useState<"bottom" | "more">();
  const [error, setError] = useState("");
  const dockRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const suppressClick = useRef(false);
  const drag = useUnifiedDrag();
  const toolbar = getAppHeaderPlugins(snapshot);
  const { dock, more } = snapshot.safeMode ? { dock: [], more: [] } : getCompactPluginGroups(snapshot.preferences, toolbar.owners);
  const zh = lang === "zh";
  const moreLabel = zh ? "更多" : "More";

  function reportError(caught: unknown) {
    setError(caught instanceof Error ? caught.message : String(caught));
  }

  function activate(key: string) {
    setMoreOpen(false);
    setError("");
    if (toolbar.metrics?.owner === key) { onMetrics(); return; }
    const view = snapshot.views.find((item) => item.owner === key && !item.planningView)
      ?? toolbar.headerItems.find((item) => item.owner === key);
    const settingsPage = snapshot.settingsPages.find((item) => item.owner === key);
    const commands = extensionService.listCommands().filter((item) => item.id.startsWith(key + ":"));
    if (view) onOpenView?.(view);
    else if (settingsPage && onOpenSettings) onOpenSettings(settingsPage.id);
    else if (commands.length === 1) void extensionService.executeCommand(commands[0].id).catch(reportError);
    else onOpenPluginTools();
  }

  function beginDrag(event: PointerEvent<HTMLElement>, key: string, fromMore: boolean) {
    suppressClick.current = false;
    if (!event.isPrimary || snapshot.busy) return;
    const destination = fromMore ? "bottom" : "more";
    const targetAt = ({ x, y }: { x: number; y: number }) => {
      const target = document.elementFromPoint(x, y);
      const targetZone = fromMore ? dockRef.current?.contains(target) : moreRef.current?.contains(target) || moreButtonRef.current?.contains(target);
      return targetZone ? target : null;
    };
    drag.beginDrag(event, {
      taskId: key,
      requireHoldMs: 180,
      onActivate: () => { suppressClick.current = true; setError(""); },
      onMove: (pointer) => setDropZone(targetAt(pointer) ? destination : undefined),
      onCancel: () => setDropZone(undefined),
      onDrop: (pointer) => {
        setDropZone(undefined);
        const target = targetAt(pointer);
        if (!target) return;
        const replaceKey = fromMore ? target.closest<HTMLElement>("[data-compact-plugin]")?.dataset.compactPlugin : undefined;
        void extensionService.setCompactPlacement(key, destination, replaceKey).catch(reportError);
      },
    });
  }

  function pluginButton(item: InstalledExtension, inMenu: boolean) {
    const className = inMenu ? "df-mobile-menu-item" : "df-mobile-dock-action df-mobile-plugin-action";
    const live = toolbar.headerItems.find((entry) => entry.owner === item.key && entry !== toolbar.metrics);
    if (live) return <div
      key={item.key}
      className={`${className} df-compact-extension`}
      data-compact-plugin={item.key}
      onPointerDownCapture={(event) => beginDrag(event, item.key, inMenu)}
      onClickCapture={(event) => {
        const dragged = suppressClick.current && event.detail !== 0;
        suppressClick.current = false;
        if (dragged) { event.preventDefault(); event.stopPropagation(); }
        else if (inMenu && (event.target as Element).closest("button, [role=button], a[href]")) setMoreOpen(false);
      }}
    >
      <ExtensionMount contribution={live} />
      {inMenu && <span aria-hidden="true">{item.manifest.name}</span>}
    </div>;
    return <button
      key={item.key}
      type="button"
      className={className}
      role={inMenu ? "menuitem" : undefined}
      aria-label={item.manifest.name}
      title={item.manifest.name}
      data-compact-plugin={item.key}
      onPointerDown={(event) => beginDrag(event, item.key, inMenu)}
      onClick={(event) => {
        if (!suppressClick.current || event.detail === 0) activate(item.key);
        suppressClick.current = false;
      }}
    >
      <PluginLauncherIcon item={item} catalog={snapshot.catalog} size={inMenu ? 20 : 19} />
      {inMenu && <span>{item.manifest.name}</span>}
    </button>;
  }

  return <div className="df-mobile-dock-slots" style={{ "--df-compact-dock-columns": Math.max(4, dock.length) + 2 } as CSSProperties}>
    {chat}
    <div ref={dockRef} className="df-mobile-plugin-dock-center" data-drop-active={dropZone === "bottom" || undefined}>
      <div className="df-mobile-plugin-actions">{dock.map((item) => pluginButton(item, false))}</div>
    </div>
    <div className="df-mobile-more-wrap">
      <IconButton
        ref={moreButtonRef}
        className={`df-mobile-dock-action df-mobile-more-button${moreOpen ? " active" : ""}`}
        label={notificationCount ? `${moreLabel}${zh ? `，${notificationCount} 条未读通知` : `, ${notificationCount} unread notifications`}` : moreLabel}
        icon={<><UiMoreIcon />{notificationCount > 0 && <span className="df-proactive-notification-count">{notificationCount > 99 ? "99+" : notificationCount}</span>}</>}
        aria-expanded={moreOpen}
        aria-haspopup="menu"
        data-drop-active={dropZone === "more" || undefined}
        onClick={() => setMoreOpen((open) => !open)}
      />
      {moreOpen && <>
        <button type="button" className="df-mobile-menu-scrim" aria-label={zh ? "关闭更多菜单" : "Close More menu"} onClick={() => setMoreOpen(false)} />
        <div ref={moreRef} className="df-mobile-more-menu" role="menu" aria-label={moreLabel} data-drop-active={dropZone === "more" || undefined}>
          <button type="button" className="df-mobile-menu-item" role="menuitem" onClick={() => { setMoreOpen(false); onNotifications(); }}><UiBellIcon size={18} /><span>{zh ? "通知" : "Notifications"}{notificationCount > 0 ? ` · ${notificationCount}` : ""}</span></button>
          <button type="button" className="df-mobile-menu-item" role="menuitem" onClick={() => { setMoreOpen(false); onSearch(); }}><UiSearchIcon size={18} /><span>{zh ? "搜索" : "Search"}</span></button>
          {more.length > 0 && <div className="df-mobile-menu-plugins" role="group" aria-label={zh ? "插件" : "Plugins"}>
            {more.map((item) => pluginButton(item, true))}
          </div>}
          <button type="button" className="df-mobile-menu-item" role="menuitem" onClick={() => { setMoreOpen(false); onSettings(); }}><UiSettingsIcon size={18} /><span>{zh ? "设置" : "Settings"}</span></button>
        </div>
      </>}
    </div>
    {error && <span className="df-mobile-plugin-error" role="alert">{error}</span>}
    {drag.overlay}
  </div>;
}

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
  const toolbar = placement === "app-header" ? getAppHeaderPlugins(snapshot, Boolean(onOpenMetrics)) : undefined;
  const metrics = toolbar?.metrics;
  const metricsLabel = lang === "zh" ? "指标" : "Metrics";
  const headerItems = toolbar?.headerItems ?? snapshot.headerItems.filter((item) => item.placement === placement);
  const headerOwners = Array.from(new Set(headerItems.map((item) => item.owner)));
  const headerOrder = [...(snapshot.preferences.headerOrder || []).filter((owner) => headerOwners.includes(owner)), ...headerOwners.filter((owner) => !snapshot.preferences.headerOrder?.includes(owner))];
  const orderedHeaderItems = [...headerItems].sort((a, b) => headerOrder.indexOf(a.owner) - headerOrder.indexOf(b.owner));
  const launcherPlugins = toolbar?.launcherPlugins ?? [];
  const overflowViews = toolbar?.overflowViews ?? [];
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
    {launcherPlugins.map((item) => <IconButton key={`launcher:${item.key}`} className="df-extension-header-launcher" label={item.manifest.name} onClick={() => activateLauncher(item.key)} icon={<PluginLauncherIcon item={item} catalog={snapshot.catalog} size={20} />} />)}
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
