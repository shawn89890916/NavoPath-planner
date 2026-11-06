import { registerCalendarBackground } from "./calendarBackgrounds";
import type { Dispose, ExtensionContribution, ExtensionHost, ExtensionPackage, ExtensionPlatform, Mount, PluginContext, PluginModule, CollectionApi, NativePlanningViewMode, NativeToolPage, PluginLauncherStatus } from "./types";
import { registerTimerMode } from "./timers";
import type { CalendarEvent, Project, Task } from "../types";

export interface RuntimeBridge {
  host: ExtensionHost; platform: ExtensionPlatform; key: string;
  config(): Record<string, unknown>; saveConfig(patch: Record<string, unknown>): Promise<void>;
  getValue<T>(key: string): Promise<T | null>; setValue(key: string, value: unknown): Promise<void>; removeValue(key: string): Promise<void>;
  contribute(kind: "settingsPages" | "views", name: string, mount: Mount, options?: Pick<ExtensionContribution, "iconUrl" | "planningView" | "nativeMode" | "nativeTool">): Dispose;
  setLauncherStatus(status?: PluginLauncherStatus): void;
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
    const content = file.encoding === "base64" ? Uint8Array.from(atob(file.data), c => c.charCodeAt(0)) : path === pkg.manifest.icon
      ? file.data.replace(/^(\s*<svg\b)([^>]*>)/i, (tag, start: string, attributes: string) =>
        /\sxmlns\s*=/.test(attributes) ? tag : `${start} xmlns="http://www.w3.org/2000/svg"${attributes}`)
      : file.data;
    const url = URL.createObjectURL(new Blob([content], { type: mime(path) })); urls.set(path, url); return url;
  }, dispose() { for (const url of urls.values()) URL.revokeObjectURL(url); urls.clear(); } };
}
export function emitPluginEvent(event: string, payload?: unknown, owner?: string): void {
  eventBus.dispatchEvent(Object.assign(new CustomEvent(event, { detail: payload }), { owner }));
}
export function subscribePluginEvent(event: string, listener: (payload: unknown, owner?: string) => void): Dispose {
  const handler = (value: Event) => {
    const event = value as CustomEvent & { owner?: string };
    if (event.owner) listener(event.detail, event.owner);
    else listener(event.detail);
  };
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
  let pageRegistered = false;
  const registerPage = (name: string, mount: Mount, nativeTool?: NativeToolPage) => {
    if (disposed || pageRegistered) throw new Error("A plugin may register only one workspace page");
    const remove = bridge.contribute("views", name, mount, { nativeTool });
    pageRegistered = true;
    return register(() => {
      pageRegistered = false;
      bridge.setLauncherStatus();
      return remove();
    });
  };
  const collection = <T extends { id: string }>(name: "tasks" | "projects" | "events"): CollectionApi<T> => ({
    list: () => bridge.host.getData()[name] as unknown as T[],
    get: id => (bridge.host.getData()[name] as unknown as T[]).find(item => item.id === id),
    create: async value => { const item = { ...value, id: crypto.randomUUID(), updatedAt: new Date().toISOString() } as unknown as T; const data = bridge.host.getData(); await bridge.host.saveData({ ...data, [name]: [...data[name], item] }); return item; },
    update: async (id, patch) => { const data = bridge.host.getData(); await bridge.host.saveData({ ...data, [name]: data[name].map(item => item.id === id ? { ...item, ...patch, id, updatedAt: new Date().toISOString() } : item) }); },
    remove: async id => { const data = bridge.host.getData(); await bridge.host.saveData({ ...data, [name]: data[name].filter(item => item.id !== id) }); },
  });
  const context: PluginContext = {
    apiVersion: 1, id: bridge.key, manifest: pkg.manifest, platform: bridge.platform, window: typeof location !== "undefined" && new URLSearchParams(location.search).get("compactWindow") === "1" ? "compact" : "main", language: bridge.host.getSettings().language,
    app: { ...bridge.host, internal: { ...bridge.host.internal,
      registerNativePlanningView: (mode: NativePlanningViewMode, name: string) => bridge.registerNativePlanningView(mode, name, pkg.manifest.icon ? resources.get(pkg.manifest.icon) : undefined),
      registerNativeToolPage: (tool: NativeToolPage, name: string) => {
        if ((tool !== "pomodoro" && tool !== "schedule-templates") || pkg.manifest.id !== tool ||
          (bridge.key !== `official:${tool}` && bridge.key !== `imported:${tool}`)) throw new Error("Native tool pages are reserved for bundled plugins");
        return registerPage(name, () => {}, tool);
      },
    } },
    tasks: collection<Task>("tasks"), projects: collection<Project>("projects"), calendar: { ...collection<CalendarEvent>("events"), registerBackground: predicate => { const off=registerCalendarBackground(predicate); emitPluginEvent("calendar:backgrounds-changed"); return register(()=>{ off(); emitPluginEvent("calendar:backgrounds-changed"); }); } }, register,
    on(target, event, listener) { target.addEventListener(event, listener); return register(() => target.removeEventListener(event, listener)); },
    interval(callback, ms) { const timer = window.setInterval(callback, ms); return register(() => window.clearInterval(timer)); },
      events: { on(event, listener) { return register(subscribePluginEvent(event, (payload) => listener(payload))); }, emit: (event, payload) => emitPluginEvent(event, payload, bridge.key) },
    settings: { get: () => bridge.config() as any, save: bridge.saveConfig, registerPage: (name, mount) => register(bridge.contribute("settingsPages", name, mount)) },
    storage: { get: bridge.getValue, set: bridge.setValue, remove: bridge.removeValue },
    localStorage: { get<T>(key: string) { try { return JSON.parse(localStorage.getItem(ownLocal + key) || "null") as T | null; } catch { return null; } }, set(key, value) { localStorage.setItem(ownLocal + key, JSON.stringify(value)); } },
    ui: {
      registerPage: (name, mount) => registerPage(name, mount),
      setLauncherStatus: (status) => {
        if (disposed || !pageRegistered || typeof status?.label !== "string") throw new Error("Register a workspace page before setting its launcher status");
        bridge.setLauncherStatus({ label: status.label.slice(0, 240), weather: status.weather, active: status.active === true });
      },
      registerPlanningView: (name, mount) => register(bridge.contribute("views", name, mount, { iconUrl: pkg.manifest.icon ? resources.get(pkg.manifest.icon) : undefined, planningView: true })),
      toast: bridge.host.toast,
    },
    commands: { register: (id, name, run, shortcut) => register(bridge.addCommand(`${bridge.key}:${id}`, name, run, shortcut)), execute: id => bridge.executeCommand(id.includes(":") ? id : `${bridge.key}:${id}`) },
    timers: { registerMode: provider => register(registerTimerMode(provider)) },
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
