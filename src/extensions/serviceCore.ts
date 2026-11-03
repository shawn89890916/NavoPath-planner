import type { CatalogEntry, Dispose, ExtensionContribution, ExtensionHost, ExtensionKind, ExtensionPackage, ExtensionPlatform, ExtensionPreferences, ExtensionSnapshot, InstalledExtension, Mount } from "./types";
import { compatibility, compareVersions, defaultExtensionPreferences, isRecord, MAX_PACKAGE_BYTES, normalizeExtensionPreferences, readPackage, publicHttps, sha256 } from "./packages";
import { cacheDelete, cacheEntries, cacheGet, cachePut } from "./cache";
import { emitPluginEvent, loadPlugin, type LoadedPlugin } from "./runtime";
import { fetchExtensionBytes, getExtensionValue, getPrivatePackage, putPrivatePackage, removeExtensionValue, setExtensionValue, subscribeExtensionValues } from "./transport";
import { applyExtensionTheme } from "./theme";

type PendingValue = { owner: string; key: string; value: unknown; remove: boolean; id: string };
const errorText = (error: unknown) => error instanceof Error ? error.message : String(error);
const platform = (): ExtensionPlatform => window.desktopApi?.isDesktop?.() ? "desktop" : /^(capacitor|ionic):/.test(location.protocol) || !!(window as any).Capacitor?.isNativePlatform?.() ? "mobile" : "web";
export class ExtensionService {
  private host: ExtensionHost | null = null;
  private account = "";
  private generation = 0;
  private listeners = new Set<() => void>();
  private loaded = new Map<string, { hash: string; plugin: LoadedPlugin; config: string }>();
  private failed = new Set<string>();
  private commands = new Map<string, { name: string; run: () => void | Promise<void>; shortcut?: string }>();
  private themeCleanup: Dispose = () => {};
  private themeSignature = "";
  private reconcileTail: Promise<void> = Promise.resolve();
  private operationTail: Promise<unknown> = Promise.resolve();
  private unbindStorage: Dispose = () => {};
  private ready = false;
  private lastCheck = 0;
  private catalogRequest?: { signature: string; promise: Promise<void> };
  private updateRequest?: Promise<void>;
  private snapshot: ExtensionSnapshot = { preferences: defaultExtensionPreferences(), catalog: [], updates: {}, status: {}, busy: false, error: "", safeMode: false, settingsPages: [], headerItems: [], views: [] };
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
  isReady = () => this.ready;
  private setSnapshot(patch: Partial<ExtensionSnapshot>) { this.snapshot = { ...this.snapshot, ...patch }; for (const listener of this.listeners) listener(); }
  private scope() { return `account:${this.account}:`; }
  private ensureHost() { if (!this.host) throw new Error("Open a workspace first / 请先打开工作区"); return this.host; }
  async configure(host: ExtensionHost | null): Promise<void> {
    const account = host ? host.getAccountId() || "preview" : "";
    if (account !== this.account) {
      const generation = ++this.generation;
      this.ready = false; this.account = account;
      this.catalogRequest = undefined; this.updateRequest = undefined; this.lastCheck = 0;
      for (const { plugin } of this.loaded.values()) await plugin.dispose(); this.loaded.clear();
      await this.themeCleanup(); this.themeSignature = "";
      await this.unbindStorage();
      this.failed.clear(); this.commands.clear();
      this.host = host;
      let safeMode = false;
      try { safeMode = new URLSearchParams(location.search).has("safe-mode") || localStorage.getItem(this.scope() + "safe-mode") === "true" || localStorage.getItem(this.scope() + "booting") === "true"; } catch { /* ephemeral sessions */ }
      this.setSnapshot({ preferences: normalizeExtensionPreferences(host?.getSettings().extensions), safeMode, status: {}, settingsPages: [], headerItems: [], views: [], catalog: [], updates: {}, catalogLoading: false, checkingUpdates: false, error: "" });
      if (generation !== this.generation) return;
      if (account && account !== "preview") this.unbindStorage = subscribeExtensionValues((owner, key, value) => {
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
  private async download(url: string): Promise<Uint8Array> {
    publicHttps(url);
    if (!window.desktopApi?.extensions) {
      try {
        const response = await fetch(url, { credentials: "omit", signal: AbortSignal.timeout(20_000) });
        if (!response.ok) throw new Error(`Download failed: ${response.status}`);
        const contentLength = Number(response.headers.get("content-length")); if (contentLength > MAX_PACKAGE_BYTES) throw new Error("Package exceeds 20 MiB");
        const reader = response.body?.getReader(); if (!reader) throw new Error("Empty download");
        const chunks: Uint8Array[] = []; let size = 0;
        while (true) { const chunk = await reader.read(); if (chunk.done) break; size += chunk.value.length; if (size > MAX_PACKAGE_BYTES) { await reader.cancel(); throw new Error("Package exceeds 20 MiB"); } chunks.push(chunk.value); }
        const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; } return bytes;
      } catch { /* Authenticated downloader handles source CORS restrictions. */ }
    }
    return fetchExtensionBytes(url);
  }
  private async readCatalog(url: string, sourceId: string): Promise<CatalogEntry[]> {
    let raw: any;
    try { raw = JSON.parse(new TextDecoder().decode(await this.download(url))); }
    catch (error) { if (sourceId !== "official") throw error; raw = (await import("./officialPackages")).officialCatalog; }
    if (!isRecord(raw) || raw.version !== 1 || !Array.isArray(raw.packages) || raw.packages.length > 1000) throw new Error("Invalid extension catalog");
    const { validateManifest } = await import("./packages");
    return raw.packages.map((entry: any) => {
      if (!isRecord(entry) || !/^[a-f0-9]{64}$/.test(entry.sha256)) throw new Error("Catalog requires SHA-256 hashes");
      const previewUrls = entry.previewUrls === undefined ? undefined : { light: publicHttps(entry.previewUrls.light), dark: publicHttps(entry.previewUrls.dark) };
      return { manifest: validateManifest(entry.manifest), downloadUrl: publicHttps(entry.downloadUrl), sha256: entry.sha256, sourceId, ...(entry.previewUrl ? { previewUrl: publicHttps(entry.previewUrl) } : {}), ...(previewUrls ? { previewUrls } : {}) };
    });
  }
  private refreshCatalogImpl(): Promise<void> {
    const generation = this.generation, sources = this.snapshot.preferences.sources;
    const signature = `${generation}:${JSON.stringify(sources)}`;
    if (this.catalogRequest?.signature === signature) return this.catalogRequest.promise;
    const request = { signature, promise: Promise.resolve().then(async () => {
      const catalog: CatalogEntry[] = [], errors: string[] = [];
      const results = await Promise.allSettled(sources.map(s => this.readCatalog(s.url, s.id)));
      results.forEach((result, index) => { if (result.status === "fulfilled") catalog.push(...result.value); else errors.push(`${sources[index].name}: ${errorText(result.reason)}`); });
      if (generation === this.generation && JSON.stringify(sources) === JSON.stringify(this.snapshot.preferences.sources)) this.setSnapshot({ catalog, error: errors.join("\n") });
    }).finally(() => {
      if (this.catalogRequest === request) { this.catalogRequest = undefined; this.setSnapshot({ catalogLoading: false }); }
    }) };
    this.catalogRequest = request; this.setSnapshot({ catalogLoading: true });
    return request.promise;
  }
  refreshCatalog = () => this.refreshCatalogImpl();
  private async packageBytes(item: Pick<InstalledExtension, "sha256" | "sourceId" | "manifest" | "downloadUrl">): Promise<Uint8Array> {
    const cacheKey = this.scope() + "package:" + item.sha256;
    let bytes = await cacheGet<Uint8Array>(cacheKey);
    if (!bytes && this.account !== "preview" && navigator.onLine) { try { bytes = await getPrivatePackage(item.sha256, this.account); } catch { /* Public sources remain available offline after caching. */ } }
    if (!bytes && item.sourceId === "official") {
      const official = (await import("./officialPackages")).officialPackageTexts[item.manifest.id];
      if (official) { const candidate = new TextEncoder().encode(official); if (await sha256(candidate) === item.sha256) bytes = candidate; }
    }
    if (!bytes && item.downloadUrl) bytes = await this.download(item.downloadUrl);
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
    if (expectedKind && pkg.manifest.kind !== expectedKind) throw new Error(expectedKind === "theme" ? "请在插件页导入插件 / Import plugins from Plugins" : "请在外观页导入主题 / Import themes from Appearance");
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
      try { const plugin = await loadPlugin(pkg, this.bridge(key)); this.loaded.set(key, { hash, plugin, config: JSON.stringify(this.getConfig(key)) }); }
      catch (error) { if (previous) await this.activate(previous); throw error; }
    }
    const removed = { ...this.snapshot.preferences.removed }; delete removed[key];
    this.failed.delete(key);
    await this.savePreferences({ ...this.snapshot.preferences, removed, installed: { ...this.snapshot.preferences.installed, [key]: installed } });
  }
  install = (entry: CatalogEntry) => this.operation(async () => {
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
    const generation = this.generation;
    this.setSnapshot({ checkingUpdates: true });
    const request = Promise.resolve().then(async () => {
      if (generation !== this.generation) return;
      await this.refreshCatalogImpl();
      if (generation !== this.generation) return;
      this.lastCheck = Date.now(); const updates: Record<string, CatalogEntry> = {};
      for (const item of Object.values(this.snapshot.preferences.installed)) {
        const candidates = this.snapshot.catalog.filter(e => e.sourceId === item.sourceId && e.manifest.id === item.manifest.id && e.manifest.kind === item.manifest.kind && !compatibility(e.manifest, platform()) && compareVersions(e.manifest.version, item.manifest.version) > 0);
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
  update = (key: string) => this.operation(async () => {
    const entry = this.snapshot.updates[key]; if (!entry) return;
    await this.installBytes(await this.packageBytes(entry), entry.sourceId, entry.downloadUrl, entry.sha256);
    const updates = { ...this.snapshot.updates }; delete updates[key]; this.setSnapshot({ updates });
  });
  private bridge(key: string) {
    const host = this.ensureHost(), generation = this.generation, account = this.account;
    const guard = () => { if (generation !== this.generation || account !== this.account) throw new Error("Extension account changed"); };
    const scopedHost: ExtensionHost = {
      getData: () => { guard(); return host.getData(); }, saveData: data => { guard(); return host.saveData(data); },
      getSettings: () => { guard(); return host.getSettings(); }, saveSettings: patch => { guard(); return host.saveSettings(patch); },
      getAccountId: () => { guard(); return host.getAccountId(); }, toast: message => { guard(); host.toast(message); }, internal: host.internal,
    };
    return { host: scopedHost, key, platform: platform(), config: () => { guard(); return this.getConfig(key); }, saveConfig: async (patch: Record<string, unknown>) => { guard(); await this.saveConfig(key, patch); },
      getValue: async <T>(name: string): Promise<T | null> => { guard(); return this.getValue(key, name) as Promise<T | null>; },
      setValue: async (name: string, value: unknown) => { guard(); await this.writeValue(key, name, value, false); },
      removeValue: async (name: string) => { guard(); await this.writeValue(key, name, null, true); },
      contribute: (kind: "settingsPages" | "headerItems" | "views", name: string, mount: Mount): Dispose => {
        guard(); const contribution: ExtensionContribution = { id: crypto.randomUUID(), owner: key, name, mount };
        this.setSnapshot({ [kind]: [...this.snapshot[kind], contribution] }); return () => { this.setSnapshot({ [kind]: this.snapshot[kind].filter(item => item.id !== contribution.id) }); };
      }, executeCommand: this.executeCommand,
      addCommand: (id: string, name: string, run: () => void | Promise<void>, shortcut?: string): Dispose => { guard(); if (this.commands.has(id)) throw new Error("Duplicate plugin command"); this.commands.set(id, { name, run, shortcut }); this.setSnapshot({}); emitPluginEvent("commands:changed"); return () => { this.commands.delete(id); this.setSnapshot({}); emitPluginEvent("commands:changed"); }; },
    };
  }
  executeCommand = async (id: string) => { const command = this.commands.get(id); if (!command) throw new Error("Unknown plugin command"); await command.run(); };
  listCommands = () => Array.from(this.commands, ([id, command]) => ({ id, name: command.name }));
  getActiveThemeDescriptor = () => {
    const key = this.snapshot.preferences.activeTheme;
    const item = key && this.snapshot.preferences.installed[key];
    return item && this.themeSignature && !this.snapshot.safeMode ? { accountId: this.account, sha256: item.sha256, config: this.getConfig(item.key) } : undefined;
  };
  private async getValue(owner: string, key: string): Promise<unknown | null> {
    const scope = this.scope(), pending = await cacheGet<PendingValue>(scope + `pending:${owner}:${key}`);
    if (pending) return pending.remove ? null : pending.value;
    const account = this.account;
    if (account !== "preview") { try { const value = await getExtensionValue(owner, key, account); if (scope !== this.scope()) throw new Error("Extension account changed"); await cachePut(scope + `value:${owner}:${key}`, value); return value; } catch { /* Cached values work offline. */ } }
    return cacheGet(scope + `value:${owner}:${key}`);
  }
  private async writeValue(owner: string, key: string, value: unknown, remove: boolean) {
    if (!key || key.length > 200 || /[\x00-\x1f]/.test(key)) throw new Error("Invalid storage key");
    const serialized = JSON.stringify(value); if (serialized === undefined || serialized.length > 1024 * 1024) throw new Error("Store JSON values smaller than 1 MiB per key");
    const scope = this.scope(); const pending: PendingValue = { owner, key, value: JSON.parse(serialized), remove, id: crypto.randomUUID() };
    await cachePut(scope + `value:${owner}:${key}`, remove ? null : pending.value);
    if (this.account !== "preview") { await cachePut(scope + `pending:${owner}:${key}`, pending); void this.flushQueue(); }
    emitPluginEvent(`storage:${owner}`, { key, value: remove ? null : pending.value });
  }
  private flushing = false;
  private async flushQueue() {
    if (this.flushing || !this.account || this.account === "preview" || !navigator.onLine) return;
    this.flushing = true; const scope = this.scope();
    try {
      const account = this.account;
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
    const plugin = await loadPlugin(pkg, this.bridge(item.key));
    if (generation !== this.generation) { await plugin.dispose(); return; }
    this.loaded.set(item.key, { hash: item.sha256, plugin, config: JSON.stringify(this.getConfig(item.key)) });
  }
  private async restorePackages() { if (this.host) { this.failed.clear(); await this.reconcile(this.generation); } }
  private async migrateLegacy() {
    const host = this.ensureHost(), preferences = this.snapshot.preferences;
    if (preferences.migratedLegacy) return;
    const settings = host.getSettings();
    const needed = settings.enabledPlugins?.includes("pomodoro") || settings.focusModeDefault === "pomodoro" || settings.widgetTimerPreferences?.mode === "pomodoro";
    const next = { ...preferences, migratedLegacy: true, installed: { ...preferences.installed } };
    if (needed && !next.installed["official:pomodoro"] && !next.removed["official:pomodoro"]) {
      const { officialPackages, officialPackageTexts } = await import("./officialPackages"); const pkg = officialPackages.pomodoro;
      const bytes = new TextEncoder().encode(officialPackageTexts.pomodoro), hash = await sha256(bytes), now = new Date().toISOString();
      await this.publishPackage(hash, bytes);
      next.installed["official:pomodoro"] = { key: "official:pomodoro", sourceId: "official", manifest: pkg.manifest, sha256: hash, enabled: true, installedAt: now, updatedAt: now };
      const config = { ...settings.pluginConfigs?.pomodoro, ...settings.widgetTimerPreferences };
      await host.saveSettings({ extensionConfigs: { ...settings.extensionConfigs, "official:pomodoro": config } });
    }
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
