import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadPlugin, patchMethod, type RuntimeBridge } from "./runtime";
import { parsePackage } from "./packages";
import { officialPackageTexts } from "./officialPackages";
import type { PluginContext } from "./types";

function bridge() {
  let data: any = { tasks: [], projects: [], events: [] };
  let config: Record<string, unknown> = {};
  const contributions: string[] = [], clean = vi.fn();
  const value: RuntimeBridge = {
    key: "official:weather", platform: "web",
    host: { getData: () => data, saveData: async next => { data = next; }, getSettings: () => ({ language: "en" } as any), saveSettings: async () => {}, getAccountId: () => "alice", toast: vi.fn(), internal: {} },
    config: () => config, saveConfig: async patch => { config = { ...config, ...patch }; }, getValue: async () => null, setValue: async () => {}, removeValue: async () => {},
    contribute: (kind) => { contributions.push(kind); return clean; }, executeCommand: async () => {}, addCommand: () => clean,
  };
  return { value, clean, contributions, getData: () => data };
}
beforeEach(() => vi.stubGlobal("window", {}));
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe("trusted plugin runtime", () => {
  it("removes wrappers out of order without retaining an unloaded plugin", async () => {
    const target = { run: () => "core" };
    const a = patchMethod(target, "run", original => () => `a(${original()})`);
    const b = patchMethod(target, "run", original => () => `b(${original()})`);
    expect(target.run()).toBe("b(a(core))"); await a(); expect(target.run()).toBe("b(core)"); await b(); expect(target.run()).toBe("core");
  });
  it("runs lifecycle and collection APIs and unloads registered contributions", async () => {
    vi.stubGlobal("document", { createElement: () => ({ dataset: {}, remove: vi.fn() }), head: { append: vi.fn() } });
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test"); const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const f = bridge(), pkg = parsePackage(new TextEncoder().encode(officialPackageTexts.weather)); delete pkg.manifest.styles;
    let ctx!: PluginContext; const onSettingsChange = vi.fn();
    const loaded = await loadPlugin(pkg, f.value, async () => ({ default: { async onload(context) { ctx = context; context.ui.addHeaderItem("Hello", () => {}); context.settings.registerPage("Settings", () => {}); await context.tasks.create({ title: "From plugin" } as any); }, onSettingsChange } }));
    expect(f.getData().tasks[0].title).toBe("From plugin");
    await ctx.tasks.update(f.getData().tasks[0].id, { title: "Changed" }); expect(f.getData().tasks[0].title).toBe("Changed");
    await loaded.configChanged({ city: "Shanghai" }); expect(onSettingsChange).toHaveBeenCalledWith({ city: "Shanghai" });
    await loaded.dispose(); expect(f.clean).toHaveBeenCalledTimes(2); expect(revoke).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
  it("cleans partial activation when plugin startup throws", async () => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test"); vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const f = bridge(), pkg = parsePackage(new TextEncoder().encode(officialPackageTexts.weather)); delete pkg.manifest.styles;
    await expect(loadPlugin(pkg, f.value, async () => ({ default: { onload(ctx) { ctx.ui.registerView("Partial", () => {}); throw new Error("broken"); } } }))).rejects.toThrow("broken");
    expect(f.clean).toHaveBeenCalledTimes(1);
  });
});
