import { registerCalendarBackground } from "./calendarBackgrounds";
import type { Dispose, ExtensionHost, ExtensionManifest, ExtensionPackage, ExtensionPlatform, Mount, PluginContext, PluginModule, CollectionApi, NativePlanningViewMode, PluginUiPlacement } from "./types";
import { registerTimerMode, openTimerMode } from "./timers";
import type { CalendarEvent, Project, Task } from "../types";

export interface RuntimeBridge {
  host: ExtensionHost; platform: ExtensionPlatform; key: string;
  config(): Record<string, unknown>; saveConfig(patch: Record<string, unknown>): Promise<void>;
  getValue<T>(key: string): Promise<T | null>; setValue(key: string, value: unknown): Promise<void>; removeValue(key: string): Promise<void>;
  contribute(kind: "settingsPages" | "headerItems" | "views", name: string, mount: Mount, options?: { placement?: PluginUiPlacement; iconUrl?: string; planningView?: boolean; nativeMode?: NativePlanningViewMode }): Dispose;
  registerNativePlanningView(mode: NativePlanningViewMode, name: string, iconUrl?: string): Dispose;
  executeCommand(id: string): Promise<void>; addCommand(id: string, name: string, run: () => void | Promise<void>, shortcut?: string): Dispose;
}
export type LoadedPlugin = { iconUrl?: string; module: PluginModule; context: PluginContext; dispose: Dispose; configChanged(config: Record<string, unknown>): Promise<void> };
const eventBus = new EventTarget();
// A patch stack can safely remove an older plugin while a later wrapper is active.
const patches = new WeakMap<object, Map<string, { original: any; entries: Array<{ token: symbol; wrapper: (original: any) => any }> }>>();
export function patchMethod(target: Record<string, any>, key: string, wrapper: (original: any) => any): Dispose {
  let keys = patches.get(target); if (!keys) { keys = new Map(); patches.set(target, keys); }
  let stack = keys.get(key); if (!stack) { stack = { original: target[key], entries: [] }; keys.set(key, stack); }
  const token = Symbol(key); stack.entries.push({ token, wrapper });
  const rebuild = () => { target[key] = stack!.entries.reduce((value, item) => item.wrapper(value), stack!.original); };
  rebuild();
  let removed = false;
  return () => { if (removed) return; removed = true; stack!.entries = stack!.entries.filter(item => item.token !== token); rebuild(); if (!stack!.entries.length) keys!.delete(key); };
}
function mime(path: string): string { const ext = path.split(".").pop()?.toLowerCase(); return ({ css: "text/css", js: "text/javascript", svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", woff: "font/woff", woff2: "font/woff2", ttf: "font/ttf", json: "application/json" } as Record<string,string>)[ext || ""] || "application/octet-stream"; }
export function createResourceUrls(pkg: ExtensionPackage): { get(path: string): string; dispose(): void } {
  const urls = new Map<string, string>();
  return { get(path) {
    if (urls.has(path)) return urls.get(path)!;
    const file = pkg.files[path]; if (!file) throw new Error(`Missing resource ${path}`);
    const content = file.encoding === "base64" ? Uint8Array.from(atob(file.data), c => c.charCodeAt(0)) : file.data;
    const url = URL.createObjectURL(new Blob([content], { type: mime(path) })); urls.set(path, url); return url;
  }, dispose() { for (const url of urls.values()) URL.revokeObjectURL(url); urls.clear(); } };
}
export function emitPluginEvent(event: string, payload?: unknown): void { eventBus.dispatchEvent(new CustomEvent(event, { detail: payload })); }
export function subscribePluginEvent(event: string, listener: (payload: unknown) => void): Dispose {
  const handler = (value: Event) => listener((value as CustomEvent).detail);
  eventBus.addEventListener(event, handler);
  return () => eventBus.removeEventListener(event, handler);
}
export async function loadPlugin(pkg: ExtensionPackage, bridge: RuntimeBridge, importer: (url: string) => Promise<{ default?: PluginModule }> = url => import(/* @vite-ignore */ url)): Promise<LoadedPlugin> {
  const cleanups: Dispose[] = [];
  const resources = createResourceUrls(pkg);
  let disposed = false;
  const register = (dispose: Dispose) => {
    let called = false;
    const once: Dispose = () => { if (called) return; called = true; return dispose(); };
    if (disposed) { void once(); return once; } cleanups.push(once); return once;
  };
  const ownLocal = `navopath-extension-local:${bridge.host.getAccountId() || "preview"}:${bridge.key}:`;
  const collection = <T extends { id: string }>(name: "tasks" | "projects" | "events"): CollectionApi<T> => ({
    list: () => bridge.host.getData()[name] as unknown as T[],
    get: id => (bridge.host.getData()[name] as unknown as T[]).find(item => item.id === id),
    create: async value => { const item = { ...value, id: crypto.randomUUID(), updatedAt: new Date().toISOString() } as unknown as T; const data = bridge.host.getData(); await bridge.host.saveData({ ...data, [name]: [...data[name], item] }); return item; },
    update: async (id, patch) => { const data = bridge.host.getData(); await bridge.host.saveData({ ...data, [name]: data[name].map(item => item.id === id ? { ...item, ...patch, id, updatedAt: new Date().toISOString() } : item) }); },
    remove: async id => { const data = bridge.host.getData(); await bridge.host.saveData({ ...data, [name]: data[name].filter(item => item.id !== id) }); },
  });
  const context: PluginContext = {
    apiVersion: 1, id: bridge.key, manifest: pkg.manifest, platform: bridge.platform, window: typeof location !== "undefined" && new URLSearchParams(location.search).get("compactWindow") === "1" ? "compact" : "main", language: bridge.host.getSettings().language,
    app: { ...bridge.host, internal: { ...bridge.host.internal, registerNativePlanningView: (mode: NativePlanningViewMode, name: string) => bridge.registerNativePlanningView(mode, name, pkg.manifest.icon ? resources.get(pkg.manifest.icon) : undefined) } },
    tasks: collection<Task>("tasks"), projects: collection<Project>("projects"), calendar: { ...collection<CalendarEvent>("events"), registerBackground: predicate => { const off=registerCalendarBackground(predicate); emitPluginEvent("calendar:backgrounds-changed"); return register(()=>{ off(); emitPluginEvent("calendar:backgrounds-changed"); }); } }, register,
    on(target, event, listener) { target.addEventListener(event, listener); return register(() => target.removeEventListener(event, listener)); },
    interval(callback, ms) { const timer = window.setInterval(callback, ms); return register(() => window.clearInterval(timer)); },
      events: { on(event, listener) { return register(subscribePluginEvent(event, listener)); }, emit: emitPluginEvent },
    settings: { get: () => bridge.config() as any, save: bridge.saveConfig, registerPage: (name, mount) => register(bridge.contribute("settingsPages", name, mount)) },
    storage: { get: bridge.getValue, set: bridge.setValue, remove: bridge.removeValue },
    localStorage: { get<T>(key: string) { try { return JSON.parse(localStorage.getItem(ownLocal + key) || "null") as T | null; } catch { return null; } }, set(key, value) { localStorage.setItem(ownLocal + key, JSON.stringify(value)); } },
    ui: {
      addHeaderItem: (name, mount, options) => register(bridge.contribute("headerItems", name, mount, { placement: options?.placement || "app-header" })),
      registerView: (name, mount) => register(bridge.contribute("views", name, mount)),
      registerPlanningView: (name, mount) => register(bridge.contribute("views", name, mount, { iconUrl: pkg.manifest.icon ? resources.get(pkg.manifest.icon) : undefined, planningView: true })),
      openView: (name) => { if (disposed) throw new Error("Plugin is unloaded"); emitPluginEvent("ui:open-view", { owner: bridge.key, name }); },
      toast: bridge.host.toast,
    },
    commands: { register: (id, name, run, shortcut) => register(bridge.addCommand(`${bridge.key}:${id}`, name, run, shortcut)), execute: id => bridge.executeCommand(id.includes(":") ? id : `${bridge.key}:${id}`) },
    timers: { registerMode: provider => register(registerTimerMode(provider)), open: mode => { if (disposed) throw new Error("Plugin is unloaded"); openTimerMode(mode); } },
    patch: (target, key, wrapper) => register(patchMethod(target, key, wrapper)),
    resourceUrl: resources.get,
    desktop: bridge.platform === "desktop" && window.desktopApi?.extensions ? { invoke: (method, payload) => window.desktopApi!.extensions!.invoke(bridge.key, method, payload) } : null,
  };
  let module: PluginModule | undefined;
  const dispose = async () => {
    if (disposed) return; disposed = true;
    const errors: unknown[] = [];
    try { await module?.onunload?.(); } catch (error) { errors.push(error); }
    for (const cleanup of cleanups.reverse()) { try { await cleanup(); } catch (error) { errors.push(error); } }
    resources.dispose();
    try { await window.desktopApi?.extensions?.stop(bridge.key); } catch (error) { errors.push(error); }
    if (errors.length) console.warn(`[extensions] ${bridge.key} cleanup`, errors);
  };
  try {
    if (pkg.manifest.styles) {
      const style = document.createElement("style"); style.dataset.extension = bridge.key;
      style.textContent = pkg.files[pkg.manifest.styles].data.replace(/url\(["']?([^)'"\s]+)["']?\)/g, (original, path: string) => pkg.files[path] ? `url("${resources.get(path)}")` : original);
      document.head.append(style); register(() => style.remove());
    }
    if (pkg.manifest.desktop && context.desktop) await window.desktopApi!.extensions!.start(bridge.key, await import("./packages").then(m => m.sha256(new TextEncoder().encode(JSON.stringify(pkg.files)))), pkg.files, pkg.manifest.desktop);
    module = (await importer(resources.get(pkg.manifest.main!))).default;
    if (!module || typeof module.onload !== "function") throw new Error("Plugin must export default { onload(context) }");
    const cleanup = await module.onload(context); if (typeof cleanup === "function") register(cleanup);
    return { iconUrl: pkg.manifest.icon ? resources.get(pkg.manifest.icon) : undefined, module, context, dispose, async configChanged(config) { await module!.onSettingsChange?.(config); emitPluginEvent(`config:${bridge.key}`, config); } };
  } catch (error) { await dispose(); throw error; }
}
