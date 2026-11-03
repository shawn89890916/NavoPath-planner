import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtensionContribution, ExtensionManifest, ExtensionSnapshot } from "./types";

const state = vi.hoisted(() => ({ snapshot: null as unknown as ExtensionSnapshot }));
const service = vi.hoisted(() => ({
  subscribe: () => () => {}, getSnapshot: () => state.snapshot,
  refreshCatalog: vi.fn(async () => {}), importFile: vi.fn(async () => {}), install: vi.fn(async () => {}),
  setSafeMode: vi.fn(async () => {}), setPreference: vi.fn(async () => {}), checkUpdates: vi.fn(async () => {}),
  selectTheme: vi.fn(async () => {}), getConfig: () => ({}),
}));
vi.mock("./service", () => ({ extensionService: service }));
vi.mock("../components/UiPrimitives", async () => {
  const actual = await vi.importActual<typeof import("../components/UiPrimitives")>("../components/UiPrimitives");
  return { ...actual, Modal: ({ open, children }: { open: boolean; children: React.ReactNode }) => open ? <section>{children}</section> : null };
});
import { ExtensionSettings } from "./ExtensionSettings";
import { ExtensionMount } from "./ExtensionMount";

const manifest = (kind: "plugin" | "theme"): ExtensionManifest => ({ id: kind, name: `${kind} example`, description: `${kind} description`, author: "Author", version: "1.0.0", kind, apiVersion: 1, minAppVersion: "1.0.0", platforms: ["web"] });
let renderer: ReactTestRenderer | undefined;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  vi.stubGlobal("document", { addEventListener: vi.fn(), removeEventListener: vi.fn() });
  state.snapshot = { preferences: { version: 1, sources: [], installed: Object.fromEntries((["plugin", "theme"] as const).map((kind) => [`official:${kind}`, { key: `official:${kind}`, sourceId: "official", manifest: manifest(kind), sha256: "a".repeat(64), enabled: true, installedAt: "2026-11-02T00:00:00Z" }])), removed: {}, activeTheme: null, autoCheckUpdates: true, autoUpdate: false }, catalog: (["plugin", "theme"] as const).map((kind) => ({ sourceId: "official", manifest: manifest(kind), downloadUrl: `https://example.com/${kind}.zip`, sha256: "a".repeat(64) })), updates: {}, status: {}, busy: false, error: "", safeMode: false, settingsPages: [], headerItems: [], views: [] };
});
afterEach(async () => { if (renderer) await act(async () => renderer!.unmount()); renderer = undefined; vi.unstubAllGlobals(); });

describe("extension settings surfaces", () => {
  it("leaves navigation, imports and recovery available while background checks run", async () => {
    state.snapshot.catalogLoading = true; state.snapshot.checkingUpdates = true;
    await act(async () => { renderer = create(<ExtensionSettings lang="en" kind="plugin" />); });
    const buttons = renderer!.root.findAllByType("button");
    for (const label of ["Browse market", "Import", "Manage sources"]) {
      expect(buttons.find(button => button.children.includes(label))?.props.disabled).not.toBe(true);
    }
    expect(renderer!.root.findByProps({ "aria-label": "Restricted mode" }).props.disabled).not.toBe(true);
    expect(renderer!.root.findByProps({ "aria-label": "Enable plugin example" }).props.disabled).not.toBe(true);
    const check = buttons.find(button => button.children.includes("Check updates"));
    expect(check?.props.disabled).toBe(true);
    expect(check?.props["aria-busy"]).toBe(true);
  });
  it("renders installed and default-source states as text instead of disabled buttons", async () => {
    state.snapshot.preferences.sources = [{ id: "official", name: "Community", url: "https://example.com/catalog.json" }];
    await act(async () => { renderer = create(<ExtensionSettings lang="en" kind="plugin" />); });
    await act(async () => renderer!.root.findAllByType("button").find(button => button.children.includes("Manage sources"))!.props.onClick());
    expect(JSON.stringify(renderer!.toJSON())).toContain("Default source");
    expect(renderer!.root.findAllByType("button").some(button => button.children.includes("Default source"))).toBe(false);
    await act(async () => renderer!.root.findAllByType("button").find(button => button.children.includes("Back to plugins"))!.props.onClick());
    await act(async () => renderer!.root.findAllByType("button").find(button => button.children.includes("Browse market"))!.props.onClick());
    expect(renderer!.root.findAllByType("button").some(button => button.children.includes("Installed"))).toBe(false);
    expect(renderer!.root.findAllByType("button").some(button => button.children.includes("Manage"))).toBe(true);
  });
  it("keeps plugins and themes in their own installed and market lists", async () => {
    await act(async () => { renderer = create(<ExtensionSettings lang="en" kind="plugin" />); });
    expect(JSON.stringify(renderer!.toJSON())).toContain("plugin example");
    expect(JSON.stringify(renderer!.toJSON())).not.toContain("theme example");
    const browse = renderer!.root.findAllByType("button").find((button) => button.children.includes("Browse market"))!;
    await act(async () => browse.props.onClick());
    expect(service.refreshCatalog).toHaveBeenCalledOnce();
    expect(JSON.stringify(renderer!.toJSON())).not.toContain("theme example");
    await act(async () => renderer!.update(<ExtensionSettings lang="en" kind="theme" />));
    expect(JSON.stringify(renderer!.toJSON())).toContain("theme example");
    expect(JSON.stringify(renderer!.toJSON())).not.toContain("Restricted mode");
  });
  it("filters the market to installed packages and opens a plugin's details", async () => {
    state.snapshot.catalog.push({ ...state.snapshot.catalog[0], manifest: { ...manifest("plugin"), id: "extra", name: "Extra plugin" } });
    await act(async () => { renderer = create(<ExtensionSettings lang="en" kind="plugin" />); });
    await act(async () => renderer!.root.findAllByType("button").find(button => button.children.includes("Browse market"))!.props.onClick());
    expect(renderer!.root.findAllByProps({ "aria-label": "View Extra plugin" })).toHaveLength(1);
    await act(async () => renderer!.root.findByProps({ "aria-label": "Installed only", role: "switch" }).props.onClick());
    expect(renderer!.root.findAllByProps({ "aria-label": "View Extra plugin" })).toHaveLength(0);
    await act(async () => renderer!.root.findByProps({ "aria-label": "View plugin example" }).props.onClick());
    expect(JSON.stringify(renderer!.toJSON())).toContain("Requires NavoPath");
  });
  it("opens the setting page selected by the sidebar and returns through its navigation callback", async () => {
    const onSelectPage = vi.fn();
    state.snapshot.settingsPages = [{ id: "weather-options", owner: "official:plugin", name: "Weather options", mount: vi.fn() }];
    await act(async () => { renderer = create(<ExtensionSettings lang="en" kind="plugin" settingsPageId="weather-options" onSelectPage={onSelectPage} />); });
    expect(JSON.stringify(renderer!.toJSON())).toContain("Weather options");
    await act(async () => renderer!.root.findAllByType("button").find(button => button.children.includes("Back to plugins"))!.props.onClick());
    expect(onSelectPage).toHaveBeenCalledWith(null);
  });

  it("passes the current package kind to file imports", async () => {
    await act(async () => { renderer = create(<ExtensionSettings lang="en" kind="theme" />); });
    const file = { name: "paper.navopackage.json" };
    const target = { files: [file], value: "paper.navopackage.json" };
    await act(async () => renderer!.root.findByProps({ type: "file" }).props.onChange({ target }));
    expect(service.importFile).toHaveBeenCalledWith(file, "theme");
    expect(target.value).toBe("");
  });

  it("disables plugin activation while restricted mode is on", async () => {
    state.snapshot.safeMode = true;
    await act(async () => { renderer = create(<ExtensionSettings lang="en" kind="plugin" />); });
    expect(renderer!.root.findByProps({ "aria-label": "Enable plugin example" }).props.disabled).toBe(true);
  });

  it("cleans up a mounted settings contribution exactly once", async () => {
    const dispose = vi.fn();
    const mount = vi.fn(() => dispose);
    const element = { replaceChildren: vi.fn() };
    const contribution: ExtensionContribution = { id: "page", owner: "plugin", name: "Options", mount };
    await act(async () => { renderer = create(<ExtensionMount contribution={contribution} />, { createNodeMock: () => element }); });
    expect(mount).toHaveBeenCalledWith(element);
    await act(async () => renderer!.unmount()); renderer = undefined;
    expect(dispose).toHaveBeenCalledOnce();
    expect(element.replaceChildren).toHaveBeenCalledOnce();
  });
});
