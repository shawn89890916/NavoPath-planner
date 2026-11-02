import type { CalendarEvent, Language, PlannerData, Project, Settings, Task } from "../types";
import type { TimerModeProvider } from "./timers";

export type ExtensionKind = "plugin" | "theme";
export type ExtensionPlatform = "desktop" | "web" | "mobile";
export type Dispose = () => void | Promise<void>;
export type Mount = (container: HTMLElement) => void | Dispose;
export interface ThemeOption { key: string; label: string; type: "color" | "number" | "string" | "boolean"; variable: string; default: string | number | boolean; min?: number; max?: number }
export interface ExtensionManifest {
  id: string; name: string; description: string; author: string; version: string;
  kind: ExtensionKind; apiVersion: number; minAppVersion: string; platforms: ExtensionPlatform[];
  main?: string; desktop?: string; styles?: string; options?: ThemeOption[];
  repository?: string; license?: string;
}
export interface PackageFile { encoding: "utf8" | "base64"; data: string }
export interface ExtensionPackage { manifest: ExtensionManifest; files: Record<string, PackageFile> }
export interface ExtensionSource { id: string; name: string; url: string }
export interface CatalogEntry { manifest: ExtensionManifest; downloadUrl: string; sha256: string; sourceId: string }
export interface InstalledExtension {
  key: string; sourceId: string; manifest: ExtensionManifest; sha256: string; downloadUrl?: string;
  enabled: boolean; installedAt: string; updatedAt?: string; previous?: { manifest: ExtensionManifest; sha256: string; downloadUrl?: string };
}
export interface ExtensionPreferences {
  version: 1; sources: ExtensionSource[]; installed: Record<string, InstalledExtension>;
  removed: Record<string, string>; activeTheme: string | null; autoCheckUpdates: boolean; autoUpdate: boolean;
  migratedLegacy?: boolean; updatedAt?: string;
}
export interface ExtensionContribution { id: string; owner: string; name: string; mount: Mount }
export interface ExtensionSnapshot {
  preferences: ExtensionPreferences; catalog: CatalogEntry[]; updates: Record<string, CatalogEntry>;
  status: Record<string, string>; busy: boolean; error: string; safeMode: boolean;
  settingsPages: ExtensionContribution[]; headerItems: ExtensionContribution[]; views: ExtensionContribution[];
}
export interface ExtensionHost {
  getData(): PlannerData; saveData(data: PlannerData): void | Promise<void>;
  getSettings(): Settings; saveSettings(patch: Partial<Settings>): void | Promise<void>;
  toast(message: string): void; getAccountId(): string | null;
  internal: Record<string, any>;
}
export interface PluginContext {
  apiVersion: 1; id: string; manifest: ExtensionManifest; platform: ExtensionPlatform;
  window: "main" | "compact" | "widget" | "popover"; language: Language; app: ExtensionHost;
  tasks: CollectionApi<Task>; projects: CollectionApi<Project>; calendar: CollectionApi<CalendarEvent>;
  register(dispose: Dispose): Dispose;
  on(target: EventTarget, event: string, listener: EventListener): Dispose;
  interval(callback: () => void, ms: number): Dispose;
  events: { on(event: string, listener: (payload: unknown) => void): Dispose; emit(event: string, payload?: unknown): void };
  settings: { get<T extends Record<string, unknown> = Record<string, unknown>>(): T; save(patch: Record<string, unknown>): Promise<void>; registerPage(name: string, mount: Mount): Dispose };
  storage: { get<T>(key: string): Promise<T | null>; set(key: string, value: unknown): Promise<void>; remove(key: string): Promise<void> };
  localStorage: { get<T>(key: string): T | null; set(key: string, value: unknown): void };
  ui: { addHeaderItem(name: string, mount: Mount): Dispose; registerView(name: string, mount: Mount): Dispose; toast(message: string): void };
  commands: { register(id: string, name: string, run: () => void | Promise<void>, shortcut?: string): Dispose; execute(id: string): Promise<void> };
  timers: { registerMode(provider: TimerModeProvider): Dispose };
  patch(target: Record<string, any>, key: string, wrapper: (original: any) => any): Dispose;
  resourceUrl(path: string): string;
  desktop: { invoke(method: string, payload?: unknown): Promise<unknown> } | null;
}
export interface PluginModule { onload(context: PluginContext): void | Dispose | Promise<void | Dispose>; onunload?(): void | Promise<void>; onSettingsChange?(settings: Record<string, unknown>): void | Promise<void> }
export interface CollectionApi<T extends { id: string }> { list(): T[]; get(id: string): T | undefined; create(value: Omit<T, "id">): Promise<T>; update(id: string, patch: Partial<T>): Promise<void>; remove(id: string): Promise<void> }
