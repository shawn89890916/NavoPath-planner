import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ load: vi.fn(), put: vi.fn(), get: vi.fn(), setValue: vi.fn(), getValue: vi.fn(), removeValue: vi.fn(), theme: vi.fn() }));
vi.mock("./runtime", () => ({ emitPluginEvent: vi.fn(), loadPlugin: mocks.load }));
vi.mock("./theme", () => ({ applyExtensionTheme: mocks.theme }));
vi.mock("./transport", () => ({ fetchExtensionBytes: vi.fn(() => Promise.reject(new Error("offline"))), getPrivatePackage: mocks.get, putPrivatePackage: mocks.put, getExtensionValue: mocks.getValue, setExtensionValue: mocks.setValue, removeExtensionValue: mocks.removeValue, subscribeExtensionValues: () => () => {} }));
import { ExtensionService } from "./serviceCore";
import { defaultExtensionPreferences } from "./packages";
import { officialCatalog, officialPackageTexts } from "./officialPackages";
import type { CatalogEntry, ExtensionHost } from "./types";
import { cacheEntries } from "./cache";

function fixture(account = "preview", extensions = defaultExtensionPreferences()) {
  let settings: any = { language: "en", featureTemplatesEnabled: false, extensions: { ...extensions, autoCheckUpdates: false, migratedLegacy: true, migratedPlanningViews: extensions.migratedPlanningViews ?? true }, extensionConfigs: {} };
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
  mocks.load.mockImplementation(async () => ({ dispose: vi.fn(), configChanged: vi.fn(), context: {} }));
  mocks.get.mockResolvedValue(null); mocks.put.mockResolvedValue(undefined); mocks.theme.mockReturnValue(vi.fn()); mocks.getValue.mockResolvedValue(null);
  current = new ExtensionService();
});
afterEach(async () => { await current.configure(null); vi.unstubAllGlobals(); });

describe("extension installation and account reconciliation", () => {
  it("preinstalls only the Tree and Metrics planning views on a clean installation", async () => {
    const f = fixture("preview", { ...defaultExtensionPreferences(), migratedLegacy: true, migratedPlanningViews: false });
    await current.configure(f.host);
    expect(Object.keys(current.getSnapshot().preferences.installed).sort()).toEqual(["official:metrics", "official:tree"]);
    expect(current.getSnapshot().preferences.installed["official:tree"].enabled).toBe(true);
    expect(current.getSnapshot().preferences.installed["official:metrics"].enabled).toBe(true);
  });
  it("preinstalls Tree and Metrics and migrates only previously enabled legacy views", async () => {
    const prefs = { ...defaultExtensionPreferences(), migratedLegacy: true, migratedPlanningViews: false };
    const f = fixture("preview", prefs);
    await f.host.saveSettings({ featureKanbanViewEnabled: false, featureQuadrantViewEnabled: true, featureListViewEnabled: true, featureMetricsEnabled: false });
    await current.configure(f.host);
    const installed = current.getSnapshot().preferences.installed;
    expect(Object.keys(installed).sort()).toEqual(["official:list", "official:matrix", "official:metrics", "official:tree"]);
    expect(installed["official:tree"].enabled).toBe(true);
    expect(installed["official:metrics"].enabled).toBe(false);
    expect(installed["official:matrix"].enabled).toBe(true);
    expect(installed["official:list"].enabled).toBe(true);
    expect(f.settings().extensions.migratedPlanningViews).toBe(true);
  });
  it("keeps local controls available during a slow update check and shares catalog requests", async () => {
    const f = fixture(); await current.configure(f.host);
    await current.importFile(new File([officialPackageTexts.weather], "weather.navopackage.json"));
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
    expect(mocks.load).toHaveBeenCalledOnce();
    expect(current.getSnapshot().safeMode).toBe(true);
    expect(fetch).toHaveBeenCalledOnce();
    resolve(new Response(JSON.stringify(officialCatalog)));
    await Promise.all([checking, catalog]);
    expect(current.getSnapshot()).toMatchObject({ checkingUpdates: false, catalogLoading: false, busy: false });
  });
  it("discards a catalog response from a previous account", async () => {
    await current.configure(fixture("catalog-alice").host);
    let resolve!: (response: Response) => void;
    const fetch = vi.fn(() => new Promise<Response>(done => { resolve = done; }));
    vi.stubGlobal("fetch", fetch);
    const catalog = current.refreshCatalog();
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
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
    await current.toggle("official:weather", true); expect(mocks.load).toHaveBeenCalledTimes(1);
    const loaded = await mocks.load.mock.results[0].value;
    await current.uninstall("official:weather"); expect(loaded.dispose).toHaveBeenCalledTimes(1);
    expect(current.getSnapshot().preferences.removed["official:weather"]).toBeTruthy();
    expect(f.settings().extensions.installed["official:weather"]).toBeUndefined();
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
    await current.importFile(new File([officialPackageTexts.weather], "weather.navopackage.json"));
    expect((await cacheEntries("account:alice-isolation:upload:")).length).toBe(1);
    const b = fixture("bob-isolation"); await current.configure(b.host);
    expect(current.getSnapshot().preferences.installed).toEqual({});
    expect(current.getConfig("imported:weather")).toEqual({});
    expect(await cacheEntries("account:bob-isolation:upload:")).toEqual([]);
  });
  it("keeps an unsupported plugin installed and never executes it", async () => {
    const f = fixture(); await current.configure(f.host);
    const entry = officialCatalog.packages.find(e => e.manifest.id === "weather")!;
    await current.install({ ...entry, sourceId: "official" } as CatalogEntry);
    const prefs = structuredClone(current.getSnapshot().preferences); prefs.installed["official:weather"].manifest.platforms = ["desktop"]; prefs.installed["official:weather"].enabled = true;
    await f.host.saveSettings({ extensions: prefs }); await current.configure(f.host);
    expect(current.getSnapshot().status["official:weather"]).toContain("Unsupported"); expect(mocks.load).not.toHaveBeenCalled();
  });
  it("keeps the previous version installed when replacement activation fails", async () => {
    const f = fixture(); await current.configure(f.host);
    await current.importFile(new File([officialPackageTexts.weather], "weather.navopackage.json")); await current.toggle("imported:weather", true);
    const pkg = JSON.parse(officialPackageTexts.weather); const previousVersion = pkg.manifest.version; pkg.manifest.version = "2.0.0";
    mocks.load.mockRejectedValueOnce(new Error("bad update"));
    await expect(current.importFile(new File([JSON.stringify(pkg)], "weather.navopackage.json"))).rejects.toThrow("bad update");
    expect(current.getSnapshot().preferences.installed["imported:weather"].manifest.version).toBe(previousVersion);
    expect(mocks.load).toHaveBeenCalledTimes(3);
  });
  it("restricted mode unloads local code without changing synced enable preferences", async () => {
    const f = fixture(); await current.configure(f.host);
    await current.importFile(new File([officialPackageTexts.weather], "weather.navopackage.json")); await current.toggle("imported:weather", true);
    await current.setSafeMode(true);
    expect(current.getSnapshot().safeMode).toBe(true); expect(f.settings().extensions.installed["imported:weather"].enabled).toBe(true);
    expect(current.getSnapshot().status["imported:weather"]).toContain("Restricted");
  });
});
