import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ load: vi.fn(), put: vi.fn(), get: vi.fn(), setValue: vi.fn(), getValue: vi.fn(), removeValue: vi.fn(), theme: vi.fn() }));
vi.mock("./runtime", () => ({ emitPluginEvent: vi.fn(), loadPlugin: mocks.load }));
vi.mock("./theme", () => ({ applyExtensionTheme: mocks.theme }));
vi.mock("./transport", () => ({ fetchExtensionBytes: vi.fn(() => Promise.reject(new Error("offline"))), getPrivatePackage: mocks.get, putPrivatePackage: mocks.put, getExtensionValue: mocks.getValue, setExtensionValue: mocks.setValue, removeExtensionValue: mocks.removeValue, subscribeExtensionValues: () => () => {} }));
import { ExtensionService } from "./serviceCore";
import { defaultExtensionPreferences, sha256 } from "./packages";
import { getBundledExtension, officialCatalog } from "./officialCatalog";
import type { CatalogEntry, ExtensionHost } from "./types";
import { cacheDelete, cacheEntries, cachePut } from "./cache";

const bundledDirectory = new URL("../../public/extensions/packages/", import.meta.url);
const weatherPackageText = readFileSync(new URL("weather.navopackage.json", bundledDirectory), "utf8");
const weatherPackageBytes = new TextEncoder().encode(weatherPackageText);
async function fetchBundled(url: string) {
  const packageFile = /^\/extensions\/packages\/([a-z-]+\.navopackage\.json)$/.exec(url)?.[1];
  if (!packageFile) throw new Error("offline");
  return new Response(new Uint8Array(readFileSync(new URL(packageFile, bundledDirectory))));
}

function fixture(account = "preview", extensions = defaultExtensionPreferences()) {
  let settings: any = { language: "en", featureTemplatesEnabled: false, extensions: { ...extensions, autoCheckUpdates: false, migratedLegacy: true, migratedPlanningViews: extensions.migratedPlanningViews ?? true, migratedShelfViews: extensions.migratedShelfViews ?? true }, extensionConfigs: {} };
  let data: any = { tasks: [], projects: [], events: [] };
  const host: ExtensionHost = { getData: () => data, saveData: async next => { data = next; }, getSettings: () => settings, saveSettings: async patch => { settings = { ...settings, ...patch }; }, getAccountId: () => account === "preview" ? null : account, toast: vi.fn(), internal: {} };
  return { host, settings: () => settings };
}
let current: ExtensionService;
beforeEach(() => {
  vi.clearAllMocks();
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) });
  vi.stubGlobal("window", new EventTarget()); vi.stubGlobal("location", new URL("https://navopath.test/app")); vi.stubGlobal("navigator", { onLine: false });
  vi.stubGlobal("fetch", vi.fn(fetchBundled));
  mocks.load.mockImplementation(async () => ({ dispose: vi.fn(), configChanged: vi.fn(), context: {} }));
  mocks.get.mockResolvedValue(null); mocks.put.mockResolvedValue(undefined); mocks.theme.mockReturnValue(vi.fn()); mocks.getValue.mockResolvedValue(null);
  current = new ExtensionService();
});
afterEach(async () => { await current.configure(null); vi.unstubAllGlobals(); });

describe("official plugin update recovery", () => {
  // These tests create packages under the shared preview account. Clear the
  // test-only in-memory cache so the subsequent clean-install test starts cold.
  afterEach(async () => {
    await current.configure(null);
    for (const [key] of await cacheEntries("account:preview:")) await cacheDelete(key);
  });
  it("discovers an update through the website when a verified official sync plugin was imported and keeps its original key", async () => {
    const bundled = getBundledExtension("super-productivity-sync")!;
    const old = { ...bundled, manifest: { ...bundled.manifest, version: "1.0.0" }, sha256: "1f7a4ca92bd42f9f053c9f2a96307757c43390364dfee78201fd5114c96977e6" };
    const key = "imported:super-productivity-sync";
    const pkg = JSON.parse(readFileSync(new URL("super-productivity-sync.navopackage.json", bundledDirectory), "utf8"));
    pkg.manifest.version = "1.0.2";
    const bytes = new TextEncoder().encode(JSON.stringify(pkg));
    const entry = { ...old, manifest: pkg.manifest, sha256: await sha256(bytes) };
    const f = fixture("preview", { ...defaultExtensionPreferences(), installed: { [key]: { ...old, key, sourceId: "imported", enabled: false, installedAt: "2026-11-24T00:00:00Z" } } });
    await current.configure(f.host);
    await f.host.saveSettings({ extensionConfigs: { [key]: { preserved: true } } });
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.startsWith("https://navopath.com/extensions/catalog.json?")) return new Response(JSON.stringify({ version: 1, packages: [entry] }));
      if (url.startsWith("https://navopath.com/extensions/packages/")) return new Response(bytes);
      throw new Error("GitHub Raw unavailable");
    }));
    await current.checkUpdates();
    expect(current.getSnapshot().updates[key]?.manifest.version).toBe("1.0.2");
    await current.update(key);
    const installed = current.getSnapshot().preferences.installed;
    expect(installed[key].manifest.version).toBe("1.0.2");
    expect(installed[key].enabled).toBe(false);
    expect(installed["official:super-productivity-sync"]).toBeUndefined();
    expect(f.settings().extensionConfigs[key]).toEqual({ preserved: true });
  });
  it("does not adopt a modified imported package solely on its manifest identity", async () => {
    const bundled = getBundledExtension("super-productivity-sync")!;
    const old = { ...bundled, manifest: { ...bundled.manifest, version: "1.0.0" }, sha256: "1f7a4ca92bd42f9f053c9f2a96307757c43390364dfee78201fd5114c96977e6" };
    const key = "imported:super-productivity-sync";
    const f = fixture("preview", { ...defaultExtensionPreferences(), installed: { [key]: { ...old, key, sourceId: "imported", sha256: "a".repeat(64), enabled: false, installedAt: "2026-11-24T00:00:00Z" } } });
    await current.configure(f.host);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ version: 1, packages: [{ ...old, manifest: { ...old.manifest, version: "1.0.2" } }] }))));
    await current.checkUpdates();
    expect(current.getSnapshot().updates[key]).toBeUndefined();
  });
  it("reports the offline catalog instead of claiming a successful online check", async () => {
    await current.configure(fixture().host);
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    await current.checkUpdates();
    expect(current.getSnapshot().error).toContain("Online plugin catalog unavailable");
  });
});

describe("batch extension updates", () => {
  it("serializes updates, continues after a failed package and retries only failures", async () => {
    const ids = ["weather", "metrics", "kanban"];
    const entries = ids.map(id => getBundledExtension(id)!);
    const f = fixture("preview", { ...defaultExtensionPreferences(), installed: Object.fromEntries(entries.map(entry => [`official:${entry.manifest.id}`, { ...entry, key: `official:${entry.manifest.id}`, manifest: { ...entry.manifest, version: "0.0.1" }, enabled: false, installedAt: "2026-11-24T00:00:00Z" }])) });
    await current.configure(f.host);
    const updatedEntries = await Promise.all(entries.map(async entry => {
      const pkg = JSON.parse(readFileSync(new URL(entry.manifest.id + ".navopackage.json", bundledDirectory), "utf8"));
      pkg.manifest.version = "9.0.0";
      const bytes = new TextEncoder().encode(JSON.stringify(pkg));
      return { entry: { ...entry, manifest: pkg.manifest, sha256: await sha256(bytes) }, bytes };
    }));
    let fail = true;
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("catalog.json")) return new Response(JSON.stringify({ version: 1, packages: updatedEntries.map(x => x.entry) }));
      const target = updatedEntries.find(x => url.includes(x.entry.manifest.id + ".navopackage.json"));
      if (!target || (fail && target.entry.manifest.id === "metrics")) throw new Error("unavailable");
      return new Response(target.bytes);
    }));
    await current.checkUpdates();
    const batch = current.updateAll("plugin");
    expect(current.updateAll("plugin")).toBe(batch);
    await batch;
    expect(current.getSnapshot().updateBatch).toMatchObject({ total: 3, processed: 3, updated: 2, running: false, failures: [{ key: "official:metrics" }] });
    expect(Object.keys(current.getSnapshot().updates)).toEqual(["official:metrics"]);
    fail = false;
    await current.updateAll("plugin", true);
    expect(current.getSnapshot().updateBatch).toMatchObject({ total: 1, updated: 1, failures: [], running: false });
    expect(current.getSnapshot().updates).toEqual({});
    expect(Object.values(current.getSnapshot().preferences.installed).every(item => item.enabled === false)).toBe(true);
  });
});

describe("extension installation and account reconciliation", () => {
  it("preinstalls Activity history, Matrix, Kanban and Metrics on a clean installation", async () => {
    const f = fixture("preview", { ...defaultExtensionPreferences(), migratedPlanningViews: false, migratedShelfViews: false });
    await current.configure(f.host);
    const installed = current.getSnapshot().preferences.installed;
    expect(Object.keys(installed).sort()).toEqual(["official:activity-history", "official:kanban", "official:matrix", "official:metrics"]);
    expect(Object.values(installed).every((item) => item.enabled)).toBe(true);
    expect(vi.mocked(fetch).mock.calls.map(([url]) => url).sort()).toEqual(
      ["activity-history", "kanban", "matrix", "metrics"].map(id => `/extensions/packages/${id}.navopackage.json`),
    );
  });

  it("migrates existing profiles while respecting explicit disabled and removed views", async () => {
    const matrix = officialCatalog.packages.find((entry) => entry.manifest.id === "matrix") as CatalogEntry;
    const now = "2026-11-05T00:00:00.000Z";
    const f = fixture("preview", {
      ...defaultExtensionPreferences(), migratedPlanningViews: true, migratedShelfViews: false,
      installed: { "official:matrix": { ...matrix, key: "official:matrix", sourceId: "official", enabled: false, installedAt: now } },
      removed: { "official:kanban": now },
    });
    await f.host.saveSettings({ featureMetricsEnabled: false });
    await current.configure(f.host);
    const installed = current.getSnapshot().preferences.installed;
    expect(Object.keys(installed).sort()).toEqual(["official:activity-history", "official:matrix", "official:metrics"]);
    expect(installed["official:metrics"].enabled).toBe(false);
    expect(installed["official:matrix"].enabled).toBe(false);
    expect(f.settings().extensions.migratedShelfViews).toBe(true);
  });

  it("retires the installed official List once without changing other views or planner data", async () => {
    const matrix = officialCatalog.packages.find((entry) => entry.manifest.id === "matrix") as CatalogEntry;
    const now = "2026-11-16T00:00:00.000Z";
    const key = "official:list";
    const f = fixture("preview", {
      ...defaultExtensionPreferences(),
      installed: {
        [key]: { ...matrix, manifest: { ...matrix.manifest, id: "list", name: "List" }, key, sourceId: "official", enabled: true, installedAt: now },
        "official:matrix": { ...matrix, key: "official:matrix", sourceId: "official", enabled: false, installedAt: now },
      },
    });
    const data = f.host.getData();
    await current.configure(f.host);
    const preferences = current.getSnapshot().preferences;
    expect(preferences.installed[key]).toBeUndefined();
    expect(preferences.removed[key]).toBeTruthy();
    expect(preferences.installed["official:matrix"]?.enabled).toBe(false);
    expect(f.host.getData()).toBe(data);
    await current.configure(null);
    await current.configure(f.host);
    expect(current.getSnapshot().preferences.removed[key]).toBe(preferences.removed[key]);
    expect(officialCatalog.packages.some((entry) => entry.manifest.id === "list")).toBe(false);
  });

  it("adds Activity history to an already migrated profile and remembers uninstall after restarting", async () => {
    const key = "official:activity-history";
    const f = fixture();
    await current.configure(f.host);
    expect(current.getSnapshot().preferences.installed[key]?.enabled).toBe(true);
    await current.uninstall(key);
    await current.configure(null);
    await current.configure(f.host);
    expect(current.getSnapshot().preferences.installed[key]).toBeUndefined();
    expect(f.settings().extensions.removed[key]).toBeTruthy();
  });
  it("keeps local controls available during a slow update check and shares catalog requests", async () => {
    const f = fixture(); await current.configure(f.host);
    await current.importFile(new File([weatherPackageText], "weather.navopackage.json"));
    let resolve!: (response: Response) => void;
    const fetch = vi.fn(() => new Promise<Response>(done => { resolve = done; }));
    vi.stubGlobal("fetch", fetch);
    const checking = current.checkUpdates();
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    const catalog = current.refreshCatalog();
    expect(current.checkUpdates()).toBe(checking);
    expect(current.getSnapshot()).toMatchObject({ checkingUpdates: true, catalogLoading: true, busy: false });
    await current.toggle("imported:weather", true);
    await current.setPreference({ autoCheckUpdates: false });
    await current.setSafeMode(true);
    expect(mocks.load.mock.calls.filter(([pkg]) => pkg.manifest.id === "weather")).toHaveLength(1);
    expect(current.getSnapshot().safeMode).toBe(true);
    expect(fetch).toHaveBeenCalledOnce();
    resolve(new Response(JSON.stringify(officialCatalog)));
    await Promise.all([checking, catalog]);
    expect(current.getSnapshot()).toMatchObject({ checkingUpdates: false, catalogLoading: false, busy: false });
  });
  it("discards a catalog response from a previous account", async () => {
    await current.configure(fixture("catalog-alice").host);
    let resolve!: (response: Response) => void;
    const fetchCatalog = vi.fn(() => new Promise<Response>(done => { resolve = done; }));
    vi.stubGlobal("fetch", (url: string) => url.startsWith("/") ? fetchBundled(url) : fetchCatalog());
    const catalog = current.refreshCatalog();
    await vi.waitFor(() => expect(fetchCatalog).toHaveBeenCalledOnce());
    await current.configure(fixture("catalog-bob").host);
    resolve(new Response(JSON.stringify(officialCatalog)));
    await catalog;
    expect(current.getSnapshot()).toMatchObject({ catalog: [], catalogLoading: false, checkingUpdates: false });
  });
  it("keeps validated theme preview URLs in the catalog", async () => {
    await current.configure(fixture().host);
    const catalog = { ...officialCatalog, packages: officialCatalog.packages.map(entry => ({ ...entry, previewUrl: "https://example.com/preview.png" })) };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(catalog))));
    await current.refreshCatalog();
    expect(current.getSnapshot().catalog[0].previewUrl).toBe("https://example.com/preview.png");
    catalog.packages[0].previewUrl = "javascript:alert(1)";
    await current.refreshCatalog();
    expect(current.getSnapshot().error).toBeTruthy();
    expect(current.getSnapshot().catalog).toEqual([]);
  });
  it("keeps only validated marketplace metrics and icon URLs", async () => {
    await current.configure(fixture().host);
    const entry = officialCatalog.packages[0];
    const catalog = { ...officialCatalog, packages: [{ ...entry, iconUrl: "https://example.com/icon.svg", downloads: 1234, publishedAt: "2026-11-03T12:00:00Z" }] };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(catalog))));
    await current.refreshCatalog();
    expect(current.getSnapshot().catalog[0]).toMatchObject({ iconUrl: "https://example.com/icon.svg", downloads: 1234, publishedAt: "2026-11-03T12:00:00Z" });
    catalog.packages[0].downloads = -1;
    await current.refreshCatalog();
    expect(current.getSnapshot().catalog).toEqual([]);
    expect(current.getSnapshot().error).toBeTruthy();
    catalog.packages[0].downloads = 1234;
    catalog.packages[0].publishedAt = "Nov 3, 2026";
    await current.refreshCatalog();
    expect(current.getSnapshot().catalog).toEqual([]);
    expect(current.getSnapshot().error).toBeTruthy();
  });
  it("installs an offline bundled package with verified bytes, then enables and unloads it", async () => {
    const f = fixture(); await current.configure(f.host);
    const entry = officialCatalog.packages.find(e => e.manifest.id === "weather")!;
    await current.install({ ...entry, sourceId: "official" } as CatalogEntry);
    expect(current.getSnapshot().preferences.installed["official:weather"].enabled).toBe(false);
    await current.toggle("official:weather", true);
    expect(mocks.load.mock.calls.filter(([pkg]) => pkg.manifest.id === "weather")).toHaveLength(1);
    const weatherIndex = mocks.load.mock.calls.findIndex(([pkg]) => pkg.manifest.id === "weather");
    const loaded = await mocks.load.mock.results[weatherIndex].value;
    await current.uninstall("official:weather"); expect(loaded.dispose).toHaveBeenCalledTimes(1);
    expect(current.getSnapshot().preferences.removed["official:weather"]).toBeTruthy();
    expect(f.settings().extensions.installed["official:weather"]).toBeUndefined();
  });
  it("reads offline desktop packages through the ID-only bridge", async () => {
    const entry = getBundledExtension("weather")!;
    const readOfficialPackage = vi.fn(async (id: string) =>
      new Uint8Array(readFileSync(new URL(`${id}.navopackage.json`, bundledDirectory))));
    Object.assign(window, { desktopApi: { isDesktop: () => true, extensions: { readOfficialPackage } } });
    await current.configure(fixture("desktop-offline").host);
    await current.install(entry);
    expect(readOfficialPackage.mock.calls).toEqual([["activity-history"], ["weather"]]);
    expect(fetch).not.toHaveBeenCalled();
    expect(mocks.get).not.toHaveBeenCalled();
  });
  it("uses the verified account cache before requesting the bundled asset", async () => {
    await current.configure(fixture("already-cached").host);
    const entry = getBundledExtension("weather")!;
    await cachePut(`account:already-cached:package:${entry.sha256}`, weatherPackageBytes);
    vi.mocked(fetch).mockClear();
    await current.install(entry);
    expect(fetch).not.toHaveBeenCalled();
    expect(mocks.get).not.toHaveBeenCalled();
  });
  it("falls back from altered bundled bytes to private storage and then the public download", async () => {
    await current.configure(fixture("missing-bundle").host);
    vi.stubGlobal("navigator", { onLine: true });
    const entry = getBundledExtension("weather")!;
    const fetch = vi.fn(async (url: string) =>
      new Response(url === entry.downloadUrl ? weatherPackageBytes : "altered bundled bytes"));
    vi.stubGlobal("fetch", fetch);
    await current.install(entry);
    expect(fetch.mock.calls).toEqual([["/extensions/packages/weather.navopackage.json", expect.anything()], [entry.downloadUrl, expect.anything()]]);
    expect(mocks.get).toHaveBeenCalledWith(entry.sha256, "missing-bundle");
    expect(mocks.get.mock.invocationCallOrder[0]).toBeGreaterThan(fetch.mock.invocationCallOrder[0]);
    expect(mocks.get.mock.invocationCallOrder[0]).toBeLessThan(fetch.mock.invocationCallOrder[1]);
    expect(current.getSnapshot().preferences.installed["official:weather"].sha256).toBe(entry.sha256);
  });
  it("rolls back through private storage when the previous hash is not bundled", async () => {
    const entry = getBundledExtension("tree")!;
    const oldPackage = JSON.parse(readFileSync(new URL("tree.navopackage.json", bundledDirectory), "utf8"));
    oldPackage.manifest.version = "0.0.1";
    const previousBytes = new TextEncoder().encode(JSON.stringify(oldPackage));
    const previous = { manifest: oldPackage.manifest, sha256: await sha256(previousBytes), downloadUrl: entry.downloadUrl };
    const key = "official:tree", account = "rollback";
    const f = fixture(account, {
      ...defaultExtensionPreferences(),
      installed: { [key]: { ...entry, key, enabled: false, installedAt: "2026-11-10T00:00:00Z", previous } },
    });
    await cacheDelete(`account:${account}:package:${previous.sha256}`);
    await current.configure(f.host);
    vi.mocked(fetch).mockClear();
    vi.stubGlobal("navigator", { onLine: true });
    mocks.get.mockResolvedValueOnce(previousBytes);
    await current.rollback(key);
    expect(fetch).not.toHaveBeenCalled();
    expect(mocks.get).toHaveBeenCalledWith(previous.sha256, account);
    expect(current.getSnapshot().preferences.installed[key]?.manifest.version).toBe(previous.manifest.version);
  });
  it("keeps startup ready and retries a default migration after an asset becomes available", async () => {
    const f = fixture("migration-retry", { ...defaultExtensionPreferences(), migratedPlanningViews: false, migratedShelfViews: false });
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
    await current.configure(f.host);
    expect(current.isReady()).toBe(true);
    expect(current.getSnapshot().preferences.migratedPlanningViews).toBe(false);
    vi.stubGlobal("fetch", vi.fn(fetchBundled));
    window.dispatchEvent(new Event("online"));
    await vi.waitFor(() => expect(current.getSnapshot().preferences.migratedPlanningViews).toBe(true));
  });
  it("restores installation, enable state, version and configuration on another device", async () => {
    const a = fixture("alice"); await current.configure(a.host);
    const entry = officialCatalog.packages.find(e => e.manifest.id === "weather")!;
    await current.install({ ...entry, sourceId: "official" } as CatalogEntry); await current.toggle("official:weather", true);
    await current.saveConfig("official:weather", { city: "Shanghai" });
    const b = fixture("alice", structuredClone(a.settings().extensions));
    await b.host.saveSettings({ extensionConfigs: structuredClone(a.settings().extensionConfigs) });
    const second = new ExtensionService(); await second.configure(b.host);
    expect(second.getSnapshot().status["official:weather"]).toContain("Running");
    expect(second.getConfig("official:weather").city).toBe("Shanghai"); await second.configure(null);
  });
  it("queues offline imported packages and values under the initiating account only", async () => {
    const a = fixture("alice-isolation"); await current.configure(a.host); mocks.put.mockRejectedValue(new Error("offline"));
    await current.importFile(new File([weatherPackageText], "weather.navopackage.json"));
    expect((await cacheEntries("account:alice-isolation:upload:")).length).toBe(1);
    const b = fixture("bob-isolation"); await current.configure(b.host);
    expect(current.getSnapshot().preferences.installed["imported:weather"]).toBeUndefined();
    expect(current.getConfig("imported:weather")).toEqual({});
    expect(await cacheEntries("account:bob-isolation:upload:")).toEqual([]);
  });
  it("keeps an unsupported plugin installed and never executes it", async () => {
    const f = fixture(); await current.configure(f.host);
    const entry = officialCatalog.packages.find(e => e.manifest.id === "weather")!;
    await current.install({ ...entry, sourceId: "official" } as CatalogEntry);
    const prefs = structuredClone(current.getSnapshot().preferences); prefs.installed["official:weather"].manifest.platforms = ["desktop"]; prefs.installed["official:weather"].enabled = true;
    await f.host.saveSettings({ extensions: prefs }); await current.configure(f.host);
    expect(current.getSnapshot().status["official:weather"]).toContain("Unsupported");
    expect(mocks.load.mock.calls.some(([pkg]) => pkg.manifest.id === "weather")).toBe(false);
  });
  it("keeps the previous version installed when replacement activation fails", async () => {
    const f = fixture(); await current.configure(f.host);
    await current.importFile(new File([weatherPackageText], "weather.navopackage.json")); await current.toggle("imported:weather", true);
    const pkg = JSON.parse(weatherPackageText); const previousVersion = pkg.manifest.version; pkg.manifest.version = "2.0.0";
    mocks.load.mockRejectedValueOnce(new Error("bad update"));
    await expect(current.importFile(new File([JSON.stringify(pkg)], "weather.navopackage.json"))).rejects.toThrow("bad update");
    expect(current.getSnapshot().preferences.installed["imported:weather"].manifest.version).toBe(previousVersion);
    expect(mocks.load.mock.calls.filter(([pkg]) => pkg.manifest.id === "weather")).toHaveLength(3);
  });
  it("restricted mode unloads local code without changing synced enable preferences", async () => {
    const f = fixture(); await current.configure(f.host);
    await current.importFile(new File([weatherPackageText], "weather.navopackage.json")); await current.toggle("imported:weather", true);
    await current.setSafeMode(true);
    expect(current.getSnapshot().safeMode).toBe(true); expect(f.settings().extensions.installed["imported:weather"].enabled).toBe(true);
    expect(current.getSnapshot().status["imported:weather"]).toContain("Restricted");
  });
});
