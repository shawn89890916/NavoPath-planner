import { nativeFeatureIds } from "./nativeFeatures";
import type { CatalogEntry, Dispose, ExtensionContribution, ExtensionTaskGroup, ExtensionHost, ExtensionKind, ExtensionUpdateBatch, ExtensionPackage, ExtensionPlatform, ExtensionPreferences, ExtensionSnapshot, InstalledExtension, Mount, NativeShelfViewMode, PluginLauncherStatus } from "./types";
import { compatibility, compareVersions, defaultExtensionPreferences, isRecord, MAX_PACKAGE_BYTES, normalizeExtensionPreferences, readExtensionResponse, readPackage, publicHttps, sha256 } from "./packages";
import { cacheDelete, cacheEntries, cacheGet, cachePut } from "./cache";
import { emitPluginEvent, subscribePluginEvent, loadPlugin, type LoadedPlugin } from "./runtime";
import { fetchExtensionBytes, getExtensionValue, getPrivatePackage, putPrivatePackage, removeExtensionValue, setExtensionValue, subscribeExtensionValues, versionedBackend } from "./transport";
import { applyExtensionTheme } from "./theme";
import { getAppHeaderPlugins, moveCompactPlugin } from "./compactDock";
import type { CompactPluginPlacement } from "./model";

type PendingValue = { owner: string; key: string; value: unknown; remove: boolean; id: string };
const retiredCoreIds = new Set(["tree", "activity-history"]);
const toolPageMigrations = new Set(["list", "weather", "pomodoro", "schedule-templates", "daily-overview", "quick-capture", "class-timetable"]);
const OFFICIAL_RAW = "https://raw.githubusercontent.com/shawn89890916/NavoPath-planner/main/public/extensions/";
const OFFICIAL_MIRROR = "https://navopath.com/extensions/";
const SYNC_PLUGIN_ID = "super-productivity-sync";
// Only exact hashes of previously published official packages are eligible for
// cross-source adoption. Manifest author/repository strings alone are not proof.
const trustedSyncHashes = new Set([
  "1f7a4ca92bd42f9f053c9f2a96307757c43390364dfee78201fd5114c96977e6",
  "0faed8855de1529929b5bc5e4dedf6f7b0cb8473396dc92159a6d9e06ead60e5",
  "9dfc5a9fa767994eab19d32c43e2539b8efb1400eceb31a74af6a75657676fed",
]);
const canUseOfficialUpdate = (item: InstalledExtension, entry: CatalogEntry) =>
  entry.sourceId === item.sourceId ||
  (entry.sourceId === "official" && (item.sourceId === "imported" || item.sourceId.startsWith("direct-")) &&
    item.manifest.id === SYNC_PLUGIN_ID && trustedSyncHashes.has(item.sha256));
const errorText = (error: unknown) => error instanceof Error ? error.message : String(error);
const platform = (): ExtensionPlatform => window.desktopApi?.isDesktop?.() ? "desktop" : /^(capacitor|ionic):/.test(location.protocol) || !!(window as any).Capacitor?.isNativePlatform?.() ? "mobile" : "web";
export class ExtensionService {
  private host: ExtensionHost | null = null;
  private account = "";
  private generation = 0;
  private listeners = new Set<() => void>();
  private loaded = new Map<string, { hash: string; plugin: Pick<LoadedPlugin, "iconUrl" | "dispose" | "configChanged">; config: string }>();
  private failed = new Set<string>();
  private commands = new Map<string, { name: string; run: () => void | Promise<void>; shortcut?: string }>();
  private themeCleanup: Dispose = () => {};
  private themeSignature = "";
  private reconcileTail: Promise<void> = Promise.resolve();
  private operationTail: Promise<unknown> = Promise.resolve();
  private unbindStorage: Dispose = () => {};
  private ready = false;
  private bridgeDiscoveryChecked = false;
  private lastCheck = 0;
  private catalogRequest?: { signature: string; promise: Promise<void> };
  private updateRequest?: Promise<void>;
  private batchRequest?: Promise<void>;
  private snapshot: ExtensionSnapshot = { preferences: defaultExtensionPreferences(), catalog: [], updates: {}, status: {}, busy: false, error: "", safeMode: false, settingsPages: [], views: [], launcherStatus: {} };
  constructor() {
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => { void this.flushQueue(); void this.restorePackages(); });
      window.addEventListener("keydown", e => {
        if ((e.target as HTMLElement)?.closest("input,textarea,select,[contenteditable=true]")) return;
        const key = [e.ctrlKey || e.metaKey ? "mod" : "", e.altKey ? "alt" : "", e.shiftKey ? "shift" : "", e.key.toLowerCase()].filter(Boolean).join("+");
        for (const command of this.commands.values()) if (command.shortcut?.toLowerCase() === key) { e.preventDefault(); void Promise.resolve(command.run()).catch(error => this.setSnapshot({ error: errorText(error) })); break; }
      });
      window.addEventListener("focus", () => { void this.flushQueue(); if (this.snapshot.preferences.autoCheckUpdates && Date.now() - this.lastCheck > 86400_000) void this.checkUpdates().catch(() => {}); });
      window.setInterval?.(() => {
        if (!this.host || document.visibilityState === "hidden") return;
        void this.flushQueue();
        if (this.failed.size && navigator.onLine) void this.restorePackages();
        if (this.snapshot.preferences.autoCheckUpdates && Date.now() - this.lastCheck > 86400_000) void this.checkUpdates().catch(() => {});
      }, 30_000);
    }
  }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.snapshot;
  getPluginIcon = (key: string) => this.loaded.get(key)?.plugin.iconUrl;
  isReady = () => this.ready;
  private setSnapshot(patch: Partial<ExtensionSnapshot>) { this.snapshot = { ...this.snapshot, ...patch }; for (const listener of this.listeners) listener(); }
  private scope() { return `account:${this.account}:`; }
  private ensureHost() { if (!this.host) throw new Error("Open a workspace first / 请先打开工作区"); return this.host; }
  async configure(host: ExtensionHost | null): Promise<void> {
    const account = host ? host.getAccountId() || "preview" : "";
    if (account !== this.account) {
      const generation = ++this.generation;
      this.ready = false; this.bridgeDiscoveryChecked = false; this.account = account;
      this.catalogRequest = undefined; this.updateRequest = undefined; this.batchRequest = undefined; this.lastCheck = 0;
      for (const { plugin } of this.loaded.values()) await plugin.dispose(); this.loaded.clear();
      await this.themeCleanup(); this.themeSignature = "";
      await this.unbindStorage();
      this.failed.clear(); this.commands.clear();
      this.host = host;
      let safeMode = false;
      try { safeMode = new URLSearchParams(location.search).has("safe-mode") || localStorage.getItem(this.scope() + "safe-mode") === "true" || localStorage.getItem(this.scope() + "booting") === "true"; } catch { /* ephemeral sessions */ }
      this.setSnapshot({ preferences: normalizeExtensionPreferences(host?.getSettings().extensions), safeMode, status: {}, settingsPages: [], views: [], taskGroups: [], metricsProviders: [], nativeFeatures: [], launcherStatus: {}, catalog: [], updates: {}, catalogLoading: false, checkingUpdates: false, updateBatch: undefined, error: "" });
      if (generation !== this.generation) return;
      if (account && account !== "preview") this.unbindStorage = subscribeExtensionValues((owner, key, value) => {
        if (owner.startsWith("v2:")) {
          if (account === this.account && generation === this.generation) emitPluginEvent("v2-storage:" + JSON.stringify([account, owner.slice(3), key]));
          return;
        }
        const pendingKey = this.scope() + `pending:${owner}:${key}`;
        void cacheGet(pendingKey).then(pending => { if (!pending && account === this.account) { void cachePut(this.scope() + `value:${owner}:${key}`, value); emitPluginEvent(`storage:${owner}`, { key, value }); } });
      });
    }
    this.host = host;
    if (!host) return;
    const preferences = normalizeExtensionPreferences(host.getSettings().extensions);
    if (JSON.stringify(preferences) !== JSON.stringify(this.snapshot.preferences)) this.setSnapshot({ preferences });
    const generation = this.generation;
    this.reconcileTail = this.reconcileTail.catch(() => {}).then(() => this.reconcile(generation));
    await this.reconcileTail;
    void this.flushQueue();
  }
  private async savePreferences(next: ExtensionPreferences) {
    const host = this.ensureHost(); next.updatedAt = new Date().toISOString();
    this.setSnapshot({ preferences: normalizeExtensionPreferences(next) });
    await host.saveSettings({ extensions: this.snapshot.preferences });
    const generation = this.generation;
    this.reconcileTail = this.reconcileTail.catch(() => {}).then(() => this.reconcile(generation));
    await this.reconcileTail;
  }
  private operation<T>(action: () => Promise<T>): Promise<T> {
    const result = this.operationTail.catch(() => {}).then(async () => {
      this.setSnapshot({ busy: true, error: "" });
      try { return await action(); } catch (error) { this.setSnapshot({ error: errorText(error) }); throw error; }
      finally { this.setSnapshot({ busy: false }); }
    }); this.operationTail = result; return result;
  }
  setPreference = (patch: Partial<ExtensionPreferences>) => this.operation(async () => { await this.savePreferences({ ...this.snapshot.preferences, ...patch }); });
  setCompactPlacement = (key: string, placement: CompactPluginPlacement, replaceKey?: string) => this.operation(async () => {
    const { preferences, safeMode } = this.snapshot;
    if (safeMode) return;
    const compactPlacements = moveCompactPlugin(preferences, getAppHeaderPlugins(this.snapshot).owners, key, placement, replaceKey);
    if (compactPlacements) await this.savePreferences({ ...preferences, compactPlacements });
  });
  setSafeMode = async (safeMode: boolean) => {
    try { localStorage.setItem(this.scope() + "safe-mode", String(safeMode)); localStorage.removeItem(this.scope() + "booting"); } catch { /* local override only */ }
    this.failed.clear(); this.setSnapshot({ safeMode }); await this.reconcile(this.generation);
  };
  getConfig = (key: string): Record<string, unknown> => this.host?.getSettings().extensionConfigs?.[key] || {};
  saveConfig = async (key: string, patch: Record<string, unknown>) => {
    if (!this.snapshot.preferences.installed[key]) throw new Error("Extension is not installed");
    const host = this.ensureHost();
    const config = JSON.parse(JSON.stringify({ ...this.getConfig(key), ...patch }));
    if (JSON.stringify(config).length > 64 * 1024) throw new Error("Use plugin storage for data larger than 64 KiB");
    await host.saveSettings({ extensionConfigs: { ...host.getSettings().extensionConfigs, [key]: config }, extensionConfigUpdatedAt: { ...host.getSettings().extensionConfigUpdatedAt, [key]: new Date().toISOString() } });
    const active = this.loaded.get(key); if (active) { active.config = JSON.stringify(config); await active.plugin.configChanged(config); }
    this.setSnapshot({});
    if (key === this.snapshot.preferences.activeTheme) await this.reconcile(this.generation);
  };
  addSource = (url: string, name?: string) => this.operation(async () => {
    url = publicHttps(url);
    const id = "source-" + (await sha256(new TextEncoder().encode(url))).slice(0, 16);
    if (this.snapshot.preferences.sources.some(s => s.url === url)) return;
    await this.readCatalog(url, id);
    await this.savePreferences({ ...this.snapshot.preferences, sources: [...this.snapshot.preferences.sources, { id, url, name: name || new URL(url).hostname }] });
    await this.refreshCatalogImpl();
  });
  removeSource = (id: string) => this.operation(async () => {
    if (id === "official") throw new Error("The official source is built in / 官方来源随应用提供");
    await this.savePreferences({ ...this.snapshot.preferences, sources: this.snapshot.preferences.sources.filter(s => s.id !== id) });
    this.setSnapshot({ catalog: this.snapshot.catalog.filter(e => e.sourceId !== id) });
  });
  private async download(url: string, fresh = false): Promise<Uint8Array> {
    publicHttps(url);
    if (!window.desktopApi?.extensions) {
      try {
        return await readExtensionResponse(await fetch(url, { credentials: "omit", ...(fresh ? { cache: "no-store" } : {}), signal: AbortSignal.timeout(20_000) }));
      } catch { /* Authenticated downloader handles source CORS restrictions. */ }
    }
    return fetchExtensionBytes(url);
  }
  private async readCatalog(url: string, sourceId: string): Promise<{ entries: CatalogEntry[]; warning?: string }> {
    let raw: any;
    let warning: string | undefined;
    if (sourceId === "official") {
      const load = async (address: string) => {
        const fresh = new URL(address);
        fresh.searchParams.set("_nvp", String(Date.now()));
        const value = JSON.parse(new TextDecoder().decode(await this.download(fresh.href, true)));
        if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.packages)) throw new Error("Invalid extension catalog");
        return value;
      };
      try { raw = await load(OFFICIAL_MIRROR + "catalog.json"); }
      catch {
        try { raw = await load(OFFICIAL_RAW + "catalog.json"); }
        catch { raw = (await import("./officialCatalog")).officialCatalog; warning = "无法访问在线插件市场，当前显示离线目录，可能不是最新版。 / Online plugin catalog unavailable; showing bundled versions."; }
      }
    } else raw = JSON.parse(new TextDecoder().decode(await this.download(url, true)));
    if (!isRecord(raw) || raw.version !== 1 || !Array.isArray(raw.packages) || raw.packages.length > 1000) throw new Error("Invalid extension catalog");
    const { validateManifest } = await import("./packages");
    const entries: CatalogEntry[] = raw.packages.map((entry: any) => {
      if (!isRecord(entry) || !/^[a-f0-9]{64}$/.test(entry.sha256)) throw new Error("Catalog requires SHA-256 hashes");
      const previewUrls = entry.previewUrls === undefined ? undefined : { light: publicHttps(entry.previewUrls.light), dark: publicHttps(entry.previewUrls.dark) };
      if (entry.downloads !== undefined && (!Number.isSafeInteger(entry.downloads) || entry.downloads < 0)) throw new Error("Catalog download count must be a non-negative integer");
      if (entry.publishedAt !== undefined && (typeof entry.publishedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(entry.publishedAt) || !Number.isFinite(Date.parse(entry.publishedAt)))) throw new Error("Catalog publish date must be an ISO timestamp");
      return { manifest: validateManifest(entry.manifest), downloadUrl: publicHttps(entry.downloadUrl), sha256: entry.sha256, sourceId, ...(entry.previewUrl ? { previewUrl: publicHttps(entry.previewUrl) } : {}), ...(previewUrls ? { previewUrls } : {}), ...(entry.iconUrl ? { iconUrl: publicHttps(entry.iconUrl) } : {}), ...(entry.downloads !== undefined ? { downloads: entry.downloads } : {}), ...(entry.publishedAt ? { publishedAt: entry.publishedAt } : {}) };
    });
    if (sourceId === "official") {
      for (let i = entries.length - 1; i >= 0; i--) if (retiredCoreIds.has(entries[i].manifest.id)) entries.splice(i, 1);
      const { officialCatalog } = await import("./officialCatalog");
      for (const bundled of officialCatalog.packages) {
        if (!toolPageMigrations.has(bundled.manifest.id) && !nativeFeatureIds.includes(bundled.manifest.id)) continue;
        const index = entries.findIndex((entry) => entry.manifest.id === bundled.manifest.id);
        const current = entries[index];
        if (!current) entries.push({ ...bundled, sourceId });
        else if (compareVersions(bundled.manifest.version, current.manifest.version) > 0) entries[index] = { ...bundled, sourceId };
      }
    }
    return { entries, warning };
  }
  private refreshCatalogImpl(): Promise<void> {
    const generation = this.generation, sources = this.snapshot.preferences.sources;
    const signature = `${generation}:${JSON.stringify(sources)}`;
    if (this.catalogRequest?.signature === signature) return this.catalogRequest.promise;
    const request = { signature, promise: Promise.resolve().then(async () => {
      const catalog: CatalogEntry[] = [], errors: string[] = [];
      const results = await Promise.allSettled(sources.map(s => this.readCatalog(s.url, s.id)));
      results.forEach((result, index) => { if (result.status === "fulfilled") { catalog.push(...result.value.entries); if (result.value.warning) errors.push(result.value.warning); } else errors.push(`${sources[index].name}: ${errorText(result.reason)}`); });
      if (generation === this.generation && JSON.stringify(sources) === JSON.stringify(this.snapshot.preferences.sources)) this.setSnapshot({ catalog, error: errors.join("\n") });
    }).finally(() => {
      if (this.catalogRequest === request) { this.catalogRequest = undefined; this.setSnapshot({ catalogLoading: false }); }
    }) };
    this.catalogRequest = request; this.setSnapshot({ catalogLoading: true });
    return request.promise;
  }
  refreshCatalog = () => this.refreshCatalogImpl();
  private async packageBytes(item: Pick<InstalledExtension, "sha256" | "sourceId" | "manifest" | "downloadUrl">): Promise<Uint8Array> {
    const account = this.account;
    const cacheKey = this.scope() + "package:" + item.sha256;
    let bytes = await cacheGet<Uint8Array>(cacheKey);
    if (!bytes && (item.sourceId === "official" || (item.sourceId === "imported" && toolPageMigrations.has(item.manifest.id)))) {
      const { getBundledExtension, readBundledExtension } = await import("./officialCatalog");
      const id = item.manifest.id;
      if (getBundledExtension(id)?.sha256 === item.sha256) {
        try {
          const candidate = await readBundledExtension(id);
          if (candidate && await sha256(candidate) === item.sha256) bytes = candidate;
        } catch { /* Private storage and the public source may still restore the package. */ }
      }
    }
    if (!bytes && account !== "preview" && navigator.onLine) { try { bytes = await getPrivatePackage(item.sha256, account); } catch { /* Public sources remain available offline after caching. */ } }
    if (!bytes && item.downloadUrl) {
      const address = item.downloadUrl;
      if (address.startsWith(OFFICIAL_RAW + "packages/")) {
        try {
          const candidate = await this.download(address);
          if (await sha256(candidate) === item.sha256) bytes = candidate;
        } catch { /* Try the first-party deployment mirror. */ }
        if (!bytes) bytes = await this.download(OFFICIAL_MIRROR + address.slice(OFFICIAL_RAW.length));
      } else bytes = await this.download(address);
    }
    if (!bytes) throw new Error("Package unavailable; connect the device to restore it / 联网后重试恢复插件包");
    if (await sha256(bytes) !== item.sha256) throw new Error("Package integrity check failed / 插件包完整性校验失败");
    await cachePut(cacheKey, bytes); return bytes;
  }
  private async publishPackage(hash: string, bytes: Uint8Array) {
    const scope = this.scope(), account = this.account;
    await cachePut(scope + "package:" + hash, bytes);
    if (account === "preview") return;
    await cachePut(scope + "upload:" + hash, bytes);
    if (scope !== this.scope()) throw new Error("Account changed during installation");
    void this.flushQueue();
  }
  private async installBytes(bytes: Uint8Array, sourceId: string, downloadUrl?: string, expectedHash?: string, expectedKind?: ExtensionKind) {
    const account = this.account, pkg = await readPackage(bytes), hash = await sha256(bytes);
    if (expectedHash && hash !== expectedHash) throw new Error("Package integrity check failed");
    if (pkg.manifest.apiVersion === 2 && (sourceId !== "official" || !expectedHash)) throw new Error("Protocol 2 preview is restricted to the approved catalog / V2 预览仅支持审核目录");
    if (expectedKind && pkg.manifest.kind !== expectedKind) throw new Error(expectedKind === "theme" ? "请在插件页导入插件 / Import plugins from Plugins" : "请在外观页导入主题 / Import themes from Appearance");
    if (sourceId === "official" && retiredCoreIds.has(pkg.manifest.id)) throw new Error("This feature is built in / 此功能已内置");
    const key = `${sourceId}:${pkg.manifest.id}`, previous = this.snapshot.preferences.installed[key];
    const incompatibility = compatibility(pkg.manifest, platform());
    if (incompatibility) throw new Error(incompatibility);
    if (account !== this.account) throw new Error("Account changed during installation");
    await this.publishPackage(hash, bytes);
    if (account !== this.account) throw new Error("Account changed during installation");
    const now = new Date().toISOString();
    const installed: InstalledExtension = { key, sourceId, manifest: pkg.manifest, sha256: hash, downloadUrl, enabled: previous?.enabled ?? false, installedAt: previous?.installedAt || now, updatedAt: now, previous: previous && previous.sha256 !== hash ? { manifest: previous.manifest, sha256: previous.sha256, downloadUrl: previous.downloadUrl } : previous?.previous };
    // First load is part of the install transaction. Failed updates keep the old descriptor.
    if (previous?.enabled && pkg.manifest.kind === "plugin" && !this.snapshot.safeMode) {
      await this.unload(key);
      try { const plugin = await this.loadInstalledPlugin(pkg, key); this.loaded.set(key, { hash, plugin, config: JSON.stringify(this.getConfig(key)) }); }
      catch (error) { if (previous) await this.activate(previous); throw error; }
    }
    const removed = { ...this.snapshot.preferences.removed }; delete removed[key];
    this.failed.delete(key);
    await this.savePreferences({ ...this.snapshot.preferences, removed, installed: { ...this.snapshot.preferences.installed, [key]: installed } });
  }
  install = (entry: CatalogEntry) => this.operation(async () => {
    if (entry.manifest.apiVersion === 2 && (entry.sourceId !== "official" || !this.snapshot.catalog.some(candidate => candidate.sourceId === "official" && candidate.manifest.id === entry.manifest.id && candidate.sha256 === entry.sha256))) throw new Error("Protocol 2 preview requires a verified official catalog entry");
    const bytes = await this.packageBytes(entry); const pkg = await readPackage(bytes);
    if (pkg.manifest.id !== entry.manifest.id || pkg.manifest.version !== entry.manifest.version || pkg.manifest.kind !== entry.manifest.kind) throw new Error("Catalog manifest does not match package");
    await this.installBytes(bytes, entry.sourceId, entry.downloadUrl, entry.sha256);
  });
  importFile = (file: File, expectedKind?: ExtensionKind) => this.operation(async () => {
    if (file.size > MAX_PACKAGE_BYTES) throw new Error("Package exceeds 20 MiB");
    await this.installBytes(new Uint8Array(await file.arrayBuffer()), "imported", undefined, undefined, expectedKind);
  });
  installFromUrl = (url: string, expectedKind?: ExtensionKind) => this.operation(async () => {
    const parsed = new URL(publicHttps(url));
    const repo = parsed.hostname === "github.com" && parsed.pathname.match(/^\/([^/]+)\/([^/]+)\/?$/);
    if (repo) {
      const release = JSON.parse(new TextDecoder().decode(await this.download(`https://api.github.com/repos/${repo[1]}/${repo[2]}/releases/latest`)));
      const assets = (release.assets || []).filter((asset: any) => /\.navopackage\.json$/i.test(asset.name));
      const zipAssets = (release.assets || []).filter((asset: any) => /\.zip$/i.test(asset.name));
      const asset = assets.length === 1 ? assets[0] : assets.length === 0 && zipAssets.length === 1 ? zipAssets[0] : null;
      if (!asset) throw new Error("Paste the exact release package URL / 请粘贴具体发布包地址"); url = asset.browser_download_url;
    }
    const sourceId = "direct-" + (await sha256(new TextEncoder().encode(parsed.origin + parsed.pathname))).slice(0, 16);
    await this.installBytes(await this.download(url), sourceId, url, undefined, expectedKind);
  });
  toggle = (key: string, enabled: boolean) => this.operation(async () => {
    const item = this.snapshot.preferences.installed[key]; if (!item) return;
    if (enabled) this.failed.delete(key);
    await this.savePreferences({ ...this.snapshot.preferences, installed: { ...this.snapshot.preferences.installed, [key]: { ...item, enabled, updatedAt: new Date().toISOString() } } });
  });
  uninstall = (key: string) => this.operation(async () => {
    await this.unload(key);
    const installed = { ...this.snapshot.preferences.installed }; delete installed[key];
    await this.savePreferences({ ...this.snapshot.preferences, installed, activeTheme: this.snapshot.preferences.activeTheme === key ? null : this.snapshot.preferences.activeTheme, removed: { ...this.snapshot.preferences.removed, [key]: new Date().toISOString() } });
    this.ensureHost().toast("已卸载；直接修改内部对象的插件可能需要重新加载。 / Uninstalled. Reload if the plugin changed internal objects directly.");
  });
  rollback = (key: string) => this.operation(async () => {
    const item = this.snapshot.preferences.installed[key]; if (!item?.previous) return;
    const previous = item.previous; await this.installBytes(await this.packageBytes({ ...item, ...previous }), item.sourceId, previous.downloadUrl, previous.sha256);
  });
  selectTheme = (key: string | null) => this.operation(async () => {
    if (key && this.snapshot.preferences.installed[key]?.manifest.kind !== "theme") throw new Error("Theme is not installed");
    await this.savePreferences({ ...this.snapshot.preferences, activeTheme: key });
  });
  checkUpdates = (): Promise<void> => {
    if (this.updateRequest) return this.updateRequest;
    if (this.batchRequest) return this.batchRequest;
    const generation = this.generation;
    this.setSnapshot({ checkingUpdates: true });
    const request = Promise.resolve().then(async () => {
      if (generation !== this.generation) return;
      await this.refreshCatalogImpl();
      if (generation !== this.generation) return;
      this.lastCheck = Date.now(); const updates: Record<string, CatalogEntry> = {};
      for (const item of Object.values(this.snapshot.preferences.installed)) {
        const candidates = this.snapshot.catalog.filter(e => canUseOfficialUpdate(item, e) && e.manifest.id === item.manifest.id && e.manifest.kind === item.manifest.kind && !compatibility(e.manifest, platform()) && compareVersions(e.manifest.version, item.manifest.version) > 0);
        candidates.sort((a,b) => compareVersions(b.manifest.version, a.manifest.version)); if (candidates[0]) updates[item.key] = candidates[0];
      }
      this.setSnapshot({ updates });
      if (this.snapshot.preferences.autoUpdate) for (const key of Object.keys(updates)) {
        if (generation !== this.generation) return;
        await this.update(key);
      }
    }).catch(error => { if (generation === this.generation) this.setSnapshot({ error: errorText(error) }); throw error; }).finally(() => {
      if (this.updateRequest === request) { this.updateRequest = undefined; this.setSnapshot({ checkingUpdates: false }); }
    });
    this.updateRequest = request;
    return request;
  };
  // All installs/updates share the existing operation queue. Keep a single
  // batch alive in the service, independent of the market component's lifetime.
  updateAll = (kind: ExtensionKind = "plugin", retryFailed = false): Promise<void> => {
    if (this.batchRequest) return this.batchRequest;
    const generation = this.generation;
    const previous = this.snapshot.updateBatch;
    const retryKeys = retryFailed && previous?.kind === kind ? new Set(previous.failures.map(f => f.key)) : undefined;
    const entries = Object.entries(this.snapshot.updates).filter(([key, entry]) =>
      this.snapshot.preferences.installed[key]?.manifest.kind === kind && entry.manifest.kind === kind && (!retryKeys || retryKeys.has(key)));
    if (!entries.length) return Promise.resolve();
    let batch: ExtensionUpdateBatch = { kind, total: entries.length, processed: 0, updated: 0, skipped: 0, running: true, failures: [] };
    const publish = (patch: Partial<ExtensionUpdateBatch>) => {
      batch = { ...batch, ...patch };
      if (generation === this.generation) this.setSnapshot({ updateBatch: batch });
    };
    const request = this.operation(async () => {
      try {
        for (const [key, entry] of entries) {
          if (generation !== this.generation) return;
          publish({ current: key });
          try {
            const applied = await this.applyUpdate(key, entry, generation);
            if (generation !== this.generation) return;
            publish({ processed: batch.processed + 1, updated: batch.updated + Number(applied), skipped: batch.skipped + Number(!applied) });
          } catch (error) {
            if (generation !== this.generation) return;
            publish({ processed: batch.processed + 1, failures: [...batch.failures, { key, name: entry.manifest.name, error: errorText(error) }] });
          }
        }
      } finally { publish({ current: undefined, running: false }); }
    }).finally(() => { if (this.batchRequest === request) this.batchRequest = undefined; });
    this.batchRequest = request;
    publish({});
    return request;
  };
  update = (key: string) => {
    const generation = this.generation;
    return this.operation(async () => { await this.applyUpdate(key, this.snapshot.updates[key], generation); });
  };
  private async applyUpdate(key: string, entry: CatalogEntry | undefined, generation: number): Promise<boolean> {
    if (generation !== this.generation) return false;
    const item = this.snapshot.preferences.installed[key];
    if (!entry || !item || !canUseOfficialUpdate(item, entry) || entry.manifest.id !== item.manifest.id || entry.manifest.kind !== item.manifest.kind || compatibility(entry.manifest, platform()) || compareVersions(entry.manifest.version, item.manifest.version) <= 0) return false;
    const bytes = await this.packageBytes(entry);
    if (generation !== this.generation) return false;
    const pkg = await readPackage(bytes);
    if (generation !== this.generation) return false;
    if (pkg.manifest.id !== item.manifest.id || pkg.manifest.kind !== item.manifest.kind || pkg.manifest.version !== entry.manifest.version) throw new Error("Catalog manifest does not match package");
    // Keep the original key and therefore its settings, storage and enabled state.
    await this.installBytes(bytes, item.sourceId, entry.downloadUrl, entry.sha256);
    if (generation !== this.generation) return false;
    const updates = { ...this.snapshot.updates };
    if (updates[key] && compareVersions(updates[key].manifest.version, entry.manifest.version) <= 0) delete updates[key];
    this.setSnapshot({ updates });
    return true;
  }
  private registerContribution(kind: "settingsPages" | "views", contribution: ExtensionContribution): Dispose {
    if (this.snapshot[kind].some(item => item.id === contribution.id)) throw new Error("Duplicate plugin contribution");
    this.setSnapshot({ [kind]: [...this.snapshot[kind], contribution] });
    // Use object identity: a stale disposer cannot remove a replacement with the same stable ID.
    return () => { this.setSnapshot({ [kind]: this.snapshot[kind].filter(item => item !== contribution) }); };
  }
  private async loadInstalledPlugin(pkg: ExtensionPackage, key: string): Promise<Pick<LoadedPlugin, "iconUrl" | "dispose" | "configChanged">> {
    if (pkg.manifest.apiVersion !== 2) return loadPlugin(pkg, this.bridge(key));
    const generation = this.generation, account = this.account, host = this.ensureHost();
    const isCurrent = () => generation === this.generation && account === this.account && !!this.host && (host.getAccountId() || "preview") === account && !this.snapshot.safeMode && this.snapshot.preferences.installed[key]?.enabled === true;
    const { loadV2Preview } = await import("./runtimeV2Host");
    if (!isCurrent()) throw new Error("Extension account changed");
    const storage = pkg.manifest.permissions?.some(permission => permission === "storage.read" || permission === "storage.write")
      ? (await import("./versionedStorage")).createVersionedStorage({
        account, owner: key, current: isCurrent, backend: versionedBackend,
        notify: (owner, name) => emitPluginEvent("v2-storage:" + JSON.stringify([account, owner, name])),
        subscribe: (name, listener) => subscribePluginEvent("v2-storage:" + JSON.stringify([account, key, name]), listener),
      }) : undefined;
    if (storage) storage.readLegacy = async (name, signal) => {
      const check = () => { if (!isCurrent() || signal.aborted) throw new Error("Extension account changed"); };
      check();
      const scope = "account:" + account + ":";
      const pendingKey = scope + `pending:${key}:${name}`;
      if (await cacheGet(pendingKey)) throw new Error("Legacy edits are pending; sync them before migration");
      check();
      const value = account === "preview" ? await cacheGet(scope + `value:${key}:${name}`) : await getExtensionValue(key, name, account);
      if (await cacheGet(pendingKey)) throw new Error("Legacy edits are pending; sync them before migration");
      check();
      return value as import("./sdkV2").V2Json;
    };
    if (!isCurrent()) throw new Error("Extension account changed");
    return loadV2Preview(pkg, {
      key, host, platform: platform(), isCurrent, storage, engagementEnabled: () => this.snapshot.nativeFeatures?.includes("engagement") === true,
      registerTaskGroup: (group: ExtensionTaskGroup) => {
        if (!isCurrent()) throw new Error("Extension account changed");
        const groups = this.snapshot.taskGroups ?? [];
        if (groups.some(item => item.id === group.id)) throw new Error("Duplicate task group");
        this.setSnapshot({ taskGroups: [...groups, group] });
        return () => { this.setSnapshot({ taskGroups: (this.snapshot.taskGroups ?? []).filter(item => item !== group) }); };
      },
      registerMetricsProvider: provider => {
        if (!isCurrent()) throw new Error("Extension account changed");
        const providers = this.snapshot.metricsProviders ?? [];
        if (providers.some(item => item.id === provider.id)) throw new Error("Duplicate metrics provider");
        this.setSnapshot({ metricsProviders: [...providers, provider] });
        return () => { this.setSnapshot({ metricsProviders: (this.snapshot.metricsProviders ?? []).filter(item => item !== provider) }); };
      },
      register: (kind, contribution) => {
        if (!isCurrent()) throw new Error("Extension account changed");
        return this.registerContribution(kind, contribution);
      },
    });
  }
  private bridge(key: string) {
    const host = this.ensureHost(), generation = this.generation, account = this.account;
    const guard = () => { if (generation !== this.generation || account !== this.account) throw new Error("Extension account changed"); };
    const scopedHost: ExtensionHost = {
      getData: () => { guard(); return host.getData(); }, saveData: data => { guard(); return host.saveData(data); },
      getSettings: () => {
        guard();
        const { extensionMcpAccess: _grants, ...settings } = host.getSettings();
        return settings;
      },
      saveSettings: ({ extensionMcpAccess: _grants, ...patch }) => { guard(); return host.saveSettings(patch); },
      getAccountId: () => { guard(); return host.getAccountId(); }, toast: message => { guard(); host.toast(message); }, internal: host.internal,
      superProductivity: host.superProductivity ? { createPairingCode: () => { guard(); return host.superProductivity!.createPairingCode(); }, request: (path, method, body) => { guard(); return host.superProductivity!.request(path, method, body); }, commitBatch: key === "official:super-productivity-sync" && host.superProductivity.commitBatch ? (pairId, before, after) => { guard(); return host.superProductivity!.commitBatch!(pairId, before, after); } : undefined } : undefined,
    };
    return { host: scopedHost, key, platform: platform(), config: () => { guard(); return this.getConfig(key); }, saveConfig: async (patch: Record<string, unknown>) => { guard(); await this.saveConfig(key, patch); },
      getValue: async <T>(name: string): Promise<T | null> => { guard(); return this.getValue(key, name) as Promise<T | null>; },
      setValue: async (name: string, value: unknown) => { guard(); await this.writeValue(key, name, value, false); },
      removeValue: async (name: string) => { guard(); await this.writeValue(key, name, null, true); },
      contribute: (kind: "settingsPages" | "views", name: string, mount: Mount, options?: Pick<ExtensionContribution, "iconUrl" | "planningView" | "nativeMode" | "nativeTool">): Dispose => {
        guard(); const contribution: ExtensionContribution = { id: crypto.randomUUID(), owner: key, name, mount, ...options };
        return this.registerContribution(kind, contribution);
      }, executeCommand: this.executeCommand,
      setLauncherStatus: (status?: PluginLauncherStatus) => {
        if (generation !== this.generation) return;
        const previous = this.snapshot.launcherStatus[key];
        if (previous?.label === status?.label && previous?.weather === status?.weather && previous?.active === status?.active) return;
        const launcherStatus = { ...this.snapshot.launcherStatus };
        if (status) launcherStatus[key] = status;
        else delete launcherStatus[key];
        this.setSnapshot({ launcherStatus });
      },
      registerNativeFeature: (id: string): Dispose => {
        guard();
        if (!nativeFeatureIds.includes(id) || key !== `official:${id}`) throw new Error("Unknown native feature");
        if (this.snapshot.nativeFeatures?.includes(id)) throw new Error("Native feature already registered");
        this.setSnapshot({ nativeFeatures: [...(this.snapshot.nativeFeatures ?? []), id] });
        // The Reading shelf is host-rendered to reuse native task controls.
        const closeView = id === "reading" ? this.bridge(key).contribute("views", "Reading", () => {}, { planningView: true }) : undefined;
        return () => {
          if (generation !== this.generation) return;
          void closeView?.();
          this.setSnapshot({ nativeFeatures: (this.snapshot.nativeFeatures ?? []).filter(feature => feature !== id) });
        };
      },
      registerNativePlanningView: (mode: NativeShelfViewMode, name: string, iconUrl?: string): Dispose => {
        guard();
        const nativeModes: Record<string, NativeShelfViewMode> = { list: "list", kanban: "kanban", matrix: "eisenhower", metrics: "metrics" };
        if (!key.startsWith("official:") || nativeModes[key.slice("official:".length)] !== mode) throw new Error("Native planning views are reserved for matching official packages");
        return this.bridge(key).contribute("views", name, () => {}, { iconUrl, planningView: true, nativeMode: mode });
      },
      addCommand: (id: string, name: string, run: () => void | Promise<void>, shortcut?: string): Dispose => { guard(); if (this.commands.has(id)) throw new Error("Duplicate plugin command"); this.commands.set(id, { name, run, shortcut }); this.setSnapshot({}); emitPluginEvent("commands:changed"); return () => { this.commands.delete(id); this.setSnapshot({}); emitPluginEvent("commands:changed"); }; },
    };
  }
  executeCommand = async (id: string) => { const command = this.commands.get(id); if (!command) throw new Error("Unknown plugin command"); await command.run(); };
  getActiveThemeDescriptor = () => {
    const key = this.snapshot.preferences.activeTheme;
    const item = key && this.snapshot.preferences.installed[key];
    return item && this.themeSignature && !this.snapshot.safeMode ? { accountId: this.account, sha256: item.sha256, config: this.getConfig(item.key) } : undefined;
  };
  private requireReadingAccount(account: string) {
    if (!this.host || this.account !== account || this.snapshot.safeMode ||
      !this.snapshot.preferences.installed["official:reading"]?.enabled ||
      !this.snapshot.nativeFeatures?.includes("reading")) throw new Error("Reading is inactive or the account changed");
  }
  async readReadingLibrary(account: string): Promise<unknown | null> {
    this.requireReadingAccount(account);
    const generation = this.generation;
    const result = await this.getValue("official:reading", "library-v1", true);
    this.requireReadingAccount(account);
    if (generation !== this.generation) throw new Error("Reading account changed");
    return result;
  }
  async writeReadingLibrary(account: string, value: unknown): Promise<void> {
    this.requireReadingAccount(account);
    const generation = this.generation;
    await this.writeValue("official:reading", "library-v1", value, false);
    this.requireReadingAccount(account);
    if (generation !== this.generation) throw new Error("Reading account changed");
  }
  private async getValue(owner: string, key: string, requireKnown = false): Promise<unknown | null> {
    const scope = this.scope(), account = this.account;
    const pendingKey = scope + `pending:${owner}:${key}`, valueKey = scope + `value:${owner}:${key}`;
    const knownKey = scope + `known:${owner}:${key}`;
    const pending = await cacheGet<PendingValue>(pendingKey);
    if (scope !== this.scope()) throw new Error("Extension account changed");
    if (pending) return pending.remove ? null : pending.value;
    if (account !== "preview") {
      try {
        const value = await getExtensionValue(owner, key, account);
        if (scope !== this.scope()) throw new Error("Extension account changed");
        const queued = await cacheGet<PendingValue>(pendingKey);
        if (queued) return queued.remove ? null : queued.value;
        await cachePut(valueKey, value);
        if (requireKnown) await cachePut(knownKey, true);
        return value;
      } catch {
        if (scope !== this.scope()) throw new Error("Extension account changed");
        // A failed first read must not be mistaken for an empty cloud library.
        const cached = await cacheGet(valueKey);
        if (requireKnown && cached === null && !await cacheGet<boolean>(knownKey)) throw new Error("Connect once to load the existing library");
        return cached;
      }
    }
    return cacheGet(valueKey);
  }
  private async writeValue(owner: string, key: string, value: unknown, remove: boolean) {
    if (!key || key.length > 200 || /[\x00-\x1f]/.test(key)) throw new Error("Invalid storage key");
    const serialized = JSON.stringify(value); if (serialized === undefined || serialized.length > 1024 * 1024) throw new Error("Store JSON values smaller than 1 MiB per key");
    const scope = this.scope(), account = this.account;
    const pending: PendingValue = { owner, key, value: JSON.parse(serialized), remove, id: crypto.randomUUID() };
    await cachePut(scope + `value:${owner}:${key}`, remove ? null : pending.value);
    if (account !== "preview") await cachePut(scope + `pending:${owner}:${key}`, pending);
    if (scope !== this.scope() || account !== this.account) return;
    if (account !== "preview") void this.flushQueue();
    emitPluginEvent(`storage:${owner}`, { key, value: remove ? null : pending.value });
  }
  private flushing = false;
  private async flushQueue() {
    if (this.flushing || !this.account || this.account === "preview" || !navigator.onLine) return;
    this.flushing = true; const scope = this.scope();
    try {
      const account = this.account, generation = this.generation;
      if ((await cacheEntries(scope + "v2-storage:")).length) {
        const { flushVersionedStorage } = await import("./versionedStorage");
        await flushVersionedStorage(versionedBackend, account, () => scope === this.scope() && generation === this.generation,
          (owner, key) => emitPluginEvent("v2-storage:" + JSON.stringify([account, owner, key])));
      }
      for (const [key, bytes] of await cacheEntries<Uint8Array>(scope + "upload:")) { if (scope !== this.scope()) return; await putPrivatePackage(key.slice((scope + "upload:").length), bytes, account); await cacheDelete(key); }
      for (const [key, pending] of await cacheEntries<PendingValue>(scope + "pending:")) {
        if (scope !== this.scope()) return;
        if (pending.remove) await removeExtensionValue(pending.owner, pending.key, account); else await setExtensionValue(pending.owner, pending.key, pending.value, account);
        const current = await cacheGet<PendingValue>(key); if (current?.id === pending.id) await cacheDelete(key);
      }
    } catch (error) { console.warn("[extensions] cloud writes queued", error); this.setSnapshot({ error: "扩展同步暂未完成，本机修改已保留，将自动重试。 / Extension sync pending; local changes are saved and will retry." }); }
    finally { this.flushing = false; }
  }
  private async unload(key: string) { const active = this.loaded.get(key); if (active) { this.loaded.delete(key); await active.plugin.dispose(); } }
  private async activate(item: InstalledExtension) {
    const generation = this.generation;
    const pkg = await readPackage(await this.packageBytes(item));
    if (generation !== this.generation) return;
    const plugin = await this.loadInstalledPlugin(pkg, item.key);
    if (generation !== this.generation) { await plugin.dispose(); return; }
    this.loaded.set(item.key, { hash: item.sha256, plugin, config: JSON.stringify(this.getConfig(item.key)) });
  }
  private async restorePackages() {
    const generation = this.generation;
    if (!this.host) return;
    this.reconcileTail = this.reconcileTail.catch(() => {}).then(async () => {
      if (generation !== this.generation || !this.host) return;
      this.failed.clear(); await this.reconcile(generation);
    });
    await this.reconcileTail;
  }
  private async publishBundledMigration(entry: CatalogEntry, generation: number) {
    try {
      const bytes = await this.packageBytes(entry);
      if (generation !== this.generation) return false;
      await this.publishPackage(entry.sha256, bytes);
      return generation === this.generation;
    } catch (error) {
      if (generation === this.generation) this.setSnapshot({ error: errorText(error) });
      return false;
    }
  }
  private async migrateLegacy() {
    const host = this.ensureHost(), preferences = this.snapshot.preferences, settings = host.getSettings();
    const generation = this.generation;
    const { getBundledExtension } = await import("./officialCatalog");
    if (generation !== this.generation) return;
    const next = { ...preferences, installed: { ...preferences.installed } };
    let changed = false;
    const addDefault = (entry: CatalogEntry, enabled: boolean, downloadUrl?: string) => {
      const key = `official:${entry.manifest.id}`, now = new Date().toISOString();
      next.installed[key] = { key, sourceId: "official", manifest: entry.manifest, sha256: entry.sha256, downloadUrl, enabled, installedAt: now, updatedAt: now };
      changed = true;
    };
    for (const id of retiredCoreIds) {
      const key = `official:${id}`;
      if (!next.installed[key]) continue;
      delete next.installed[key];
      next.removed = { ...next.removed, [key]: new Date().toISOString() };
      changed = true;
    }
    if (!preferences.migratedLegacy) {
      const needed = settings.enabledPlugins?.includes("pomodoro") || settings.focusModeDefault === "pomodoro" || settings.widgetTimerPreferences?.mode === "pomodoro";
      if (needed && !next.installed["official:pomodoro"] && !next.removed["official:pomodoro"]) {
        const entry = getBundledExtension("pomodoro")!;
        if (await this.publishBundledMigration(entry, generation)) {
          addDefault(entry, true);
          const config = { ...settings.pluginConfigs?.pomodoro, ...settings.widgetTimerPreferences };
          await host.saveSettings({ extensionConfigs: { ...settings.extensionConfigs, "official:pomodoro": config } });
        } else if (generation !== this.generation) return;
      }
      if (!needed || next.installed["official:pomodoro"] || next.removed["official:pomodoro"]) { next.migratedLegacy = true; changed = true; }
    }
    if (!preferences.migratedPlanningViews || !preferences.migratedShelfViews) {
      let complete = true;
      const builtins: Array<{ id: string; enabled: boolean }> = [
        { id: "kanban", enabled: settings.featureKanbanViewEnabled === true },
        { id: "matrix", enabled: settings.featureQuadrantViewEnabled === true },
        { id: "metrics", enabled: settings.featureMetricsEnabled !== false },
      ];
      for (const { id, enabled } of builtins) {
        if (!enabled && id !== "metrics") continue;
        const key = `official:${id}`;
        if (next.installed[key] || next.removed[key]) continue;
        const entry = getBundledExtension(id);
        if (!entry || !await this.publishBundledMigration(entry, generation)) {
          if (generation !== this.generation) return;
          complete = false; continue;
        }
        addDefault(entry, enabled);
      }
      if (complete) { next.migratedPlanningViews = true; next.migratedShelfViews = true; changed = true; }
    }
    if (!preferences.migratedNativeFeatures) {
      let complete = true;
      const seeds = [
        { id: "habits", install: true, enabled: settings.featureHabitsEnabled !== false },
        { id: "navo-ai", install: true, enabled: settings.hideAi !== true },
        { id: "engagement", install: settings.featureEngagementEnabled === true, enabled: true },
        { id: "flowtime", install: settings.focusModeDefault === "flowtime", enabled: true },
        { id: "countdown", install: settings.widgetTimerPreferences?.mode === "countdown", enabled: true },
      ];
      for (const { id, install, enabled } of seeds) {
        const key = `official:${id}`;
        if (!install || next.installed[key] || next.removed[key]) continue;
        const entry = getBundledExtension(id);
        if (!entry || !await this.publishBundledMigration(entry, generation)) {
          if (generation !== this.generation) return;
          complete = false; continue;
        }
        addDefault(entry, enabled, entry.downloadUrl);
      }
      if (complete) { next.migratedNativeFeatures = true; changed = true; }
    }
    if (platform() === "desktop" && !preferences.migratedDesktopWidget) {
      const key = "official:desktop-widget";
      if (!next.installed[key] && !next.removed[key]) {
        const entry = getBundledExtension("desktop-widget");
        if (entry && await this.publishBundledMigration(entry, generation)) addDefault(entry, settings.featureWidgetEnabled !== false, entry.downloadUrl);
        else if (generation !== this.generation) return;
      }
      if (next.installed[key] || next.removed[key]) { next.migratedDesktopWidget = true; changed = true; }
    }
    const bridgeKey = "official:cloud-drive-sync";
    if (host.getAccountId() && !this.bridgeDiscoveryChecked && !next.installed[bridgeKey] && !next.removed[bridgeKey] && window.plannerApi?.listSyncBridgeStatuses) {
      // Status is account-wide. Stopped means a registered bridge, not an uninstall.
      // Revisit Beta 132's empty migration marker once per account/session.
      const statuses = await window.plannerApi.listSyncBridgeStatuses().catch(() => undefined);
      if (generation !== this.generation) return;
      if (statuses) {
        if (statuses.length) {
          const entry = getBundledExtension("cloud-drive-sync");
          if (entry && await this.publishBundledMigration(entry, generation)) {
            addDefault(entry, true, entry.downloadUrl);
            next.migratedCloudDriveSync = true;
            this.bridgeDiscoveryChecked = true;
          } else if (generation !== this.generation) return;
        } else this.bridgeDiscoveryChecked = true;
      }
    }
    if (settings.featureTemplatesEnabled === true && !next.installed["official:schedule-templates"] && !next.removed["official:schedule-templates"]) {
      const entry = getBundledExtension("schedule-templates")!;
      if (await this.publishBundledMigration(entry, generation)) addDefault(entry, true);
      else if (generation !== this.generation) return;
    }
    const legacyTools = Object.values(next.installed).filter((item) =>
      toolPageMigrations.has(item.manifest.id) && (item.sourceId === "official" ||
        (item.sourceId === "imported" && item.manifest.author === "NavoPath" && item.manifest.repository === "https://github.com/shawn89890916/NavoPath-planner")));
    for (const item of legacyTools) {
      const entry = getBundledExtension(item.manifest.id);
      if (!entry || compareVersions(entry.manifest.version, item.manifest.version) <= 0) continue;
      if (!await this.publishBundledMigration(entry, generation)) { if (generation !== this.generation) return; continue; }
      next.installed[item.key] = { ...item, manifest: entry.manifest, sha256: entry.sha256, downloadUrl: entry.downloadUrl, updatedAt: new Date().toISOString(), previous: undefined };
      this.failed.delete(item.key);
      changed = true;
    }
    if (generation !== this.generation || !changed) return;
    // An explicit install/uninstall or fresher account settings arriving during
    // migration win; the already queued reconciliation retries the migration.
    if (this.snapshot.preferences !== preferences) { this.bridgeDiscoveryChecked = false; return; }
    next.updatedAt = new Date().toISOString(); this.setSnapshot({ preferences: next }); await host.saveSettings({ extensions: next });
  }
  private async reconcile(generation: number) {
    if (!this.host || generation !== this.generation) return;
    await this.migrateLegacy();
    if (generation !== this.generation) return;
    const prefs = this.snapshot.preferences, statuses: Record<string,string> = {};
    for (const [key, active] of this.loaded) if (this.snapshot.safeMode || !prefs.installed[key]?.enabled || prefs.installed[key]?.sha256 !== active.hash) await this.unload(key);
    try { localStorage.setItem(this.scope() + "booting", "true"); } catch { /* recovery remains available via URL */ }
    try {
      for (const item of Object.values(prefs.installed)) {
        if (generation !== this.generation) return;
        const incompatible = compatibility(item.manifest, platform());
        if (incompatible) { statuses[item.key] = incompatible; continue; }
        if (this.snapshot.safeMode) { statuses[item.key] = "受限模式 / Restricted mode"; continue; }
        if (item.manifest.kind === "theme") continue;
        if (!item.enabled) { statuses[item.key] = "已停用 / Disabled"; continue; }
        if (!this.loaded.has(item.key) && !this.failed.has(item.key)) {
          try { await this.activate(item); } catch (error) { this.failed.add(item.key); statuses[item.key] = errorText(error); }
        }
        const active = this.loaded.get(item.key);
        if (active) { const config = JSON.stringify(this.getConfig(item.key)); if (config !== active.config) { active.config = config; try { await active.plugin.configChanged(this.getConfig(item.key)); } catch (error) { statuses[item.key] = errorText(error); } } }
        statuses[item.key] ||= active ? "运行中 / Running" : this.snapshot.status[item.key] || "加载失败，请重新启用 / Load failed; re-enable to retry";
      }
      const selected = !this.snapshot.safeMode && prefs.activeTheme ? prefs.installed[prefs.activeTheme] : undefined;
      const signature = selected && !compatibility(selected.manifest, platform()) ? `${selected.key}:${selected.sha256}:${JSON.stringify(this.getConfig(selected.key))}` : "";
      if (signature !== this.themeSignature) {
        await this.themeCleanup(); this.themeCleanup = () => {}; this.themeSignature = "";
        if (selected && signature) { try { this.themeCleanup = applyExtensionTheme(await readPackage(await this.packageBytes(selected)), this.getConfig(selected.key)); this.themeSignature = signature; statuses[selected.key] = "当前主题 / Active theme"; } catch (error) { statuses[selected.key] = errorText(error); } }
      }
      this.setSnapshot({ status: statuses });
    } finally {
      try { localStorage.removeItem(this.scope() + "booting"); } catch { /* no persistence */ }
      if (generation === this.generation) {
        const firstReady = !this.ready; this.ready = true;
        window.dispatchEvent(new CustomEvent("navopath:extensions-ready"));
        if (firstReady && prefs.autoCheckUpdates) void this.checkUpdates().catch(() => {});
      }
    }
  }
}
