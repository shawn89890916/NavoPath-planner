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
import { ExtensionSettings } from "./ExtensionSettings";
import { ExtensionMount } from "./ExtensionMount";

const manifest = (kind: "plugin" | "theme"): ExtensionManifest => ({ id: kind, name: `${kind} example`, description: `${kind} description`, author: "Author", version: "1.0.0", kind, apiVersion: 1, minAppVersion: "1.0.0", platforms: ["web"] });
let renderer: ReactTestRenderer | undefined;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  state.snapshot = { preferences: { version: 1, sources: [], installed: Object.fromEntries((["plugin", "theme"] as const).map((kind) => [`official:${kind}`, { key: `official:${kind}`, sourceId: "official", manifest: manifest(kind), sha256: "a".repeat(64), enabled: true, installedAt: "2026-11-02T00:00:00Z" }])), removed: {}, activeTheme: null, autoCheckUpdates: true, autoUpdate: false }, catalog: (["plugin", "theme"] as const).map((kind) => ({ sourceId: "official", manifest: manifest(kind), downloadUrl: `https://example.com/${kind}.zip`, sha256: "a".repeat(64) })), updates: {}, status: {}, busy: false, error: "", safeMode: false, settingsPages: [], headerItems: [], views: [] };
});
afterEach(async () => { if (renderer) await act(async () => renderer!.unmount()); renderer = undefined; });

describe("extension settings surfaces", () => {
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
