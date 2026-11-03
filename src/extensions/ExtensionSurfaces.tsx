import { useEffect, useState, useSyncExternalStore } from "react";
import type { Language } from "../types";
import { ActionDisclosure, Button, CloseButton, Modal } from "../components/UiPrimitives";
import { ExtensionMount } from "./ExtensionMount";
import { extensionService } from "./service";
import "./ExtensionSurfaces.css";

/** Compact layouts expose the same contributions through the workspace menu. */
export function ExtensionToolsDialog({ lang, onClose }: { lang: Language; onClose: () => void }) {
  const snapshot = useSyncExternalStore(extensionService.subscribe, extensionService.getSnapshot);
  const empty = !snapshot.headerItems.length && !snapshot.views.length && !extensionService.listCommands().length;
  const title = lang === "zh" ? "插件工具" : "Plugin tools";
  return <Modal label={title} onClose={onClose} className="df-extension-view">
    <header className="df-extension-view-heading"><h2>{title}</h2><CloseButton label={lang === "zh" ? "关闭" : "Close"} onClick={onClose} /></header>
    {empty ? <p>{lang === "zh" ? "在设置 → 插件中安装并启用插件。" : "Install and enable plugins in Settings → Plugins."}</p> : <ExtensionHeader lang={lang} />}
  </Modal>;
}

/** Header entry points share the plugin lifecycle and disappear when unloaded. */
export function ExtensionHeader({ lang }: { lang: Language }) {
  const snapshot = useSyncExternalStore(extensionService.subscribe, extensionService.getSnapshot);
  const commands = extensionService.listCommands();
  const [selectedView, setSelectedView] = useState<string | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [error, setError] = useState("");
  const view = snapshot.views.find((item) => item.id === selectedView);
  const label = lang === "zh" ? "插件工具" : "Plugin tools";
  const close = lang === "zh" ? "关闭" : "Close";
  useEffect(() => { if (selectedView && !view) setSelectedView(null); }, [selectedView, view]);
  async function runCommand(id: string) {
    setRunning(id); setError("");
    try { await extensionService.executeCommand(id); }
    catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
    finally { setRunning(null); }
  }
  if (!snapshot.headerItems.length && !snapshot.views.length && !commands.length && !error) return null;
  return <div className="df-extension-header" aria-busy={Boolean(running)}>
    {snapshot.headerItems.map((item) => <div key={item.id} className="df-extension-header-item" aria-label={item.name}><ExtensionMount contribution={item} /></div>)}
    {(commands.length > 0 || snapshot.views.length > 0) && <ActionDisclosure label={label}>
      {snapshot.views.map((item) => <Button key={item.id} variant="ghost" onClick={() => { setError(""); setSelectedView(item.id); }}>{item.name}</Button>)}
      {commands.map((command) => <Button key={command.id} variant="ghost" disabled={Boolean(running)} onClick={() => void runCommand(command.id)}>{command.name}</Button>)}
    </ActionDisclosure>}
    {(view || error) && <Modal label={view?.name ?? label} onClose={() => { setSelectedView(null); setError(""); }} className="df-extension-view" onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); setSelectedView(null); setError(""); } }}>
      <header className="df-extension-view-heading"><h2>{view?.name ?? label}</h2><CloseButton label={close} onClick={() => { setSelectedView(null); setError(""); }} /></header>
      {error && <p className="df-extension-view-error" role="alert">{error}</p>}
      {view && <ExtensionMount contribution={view} />}
    </Modal>}
  </div>;
}
