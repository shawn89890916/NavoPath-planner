import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadPlugin, patchMethod, type RuntimeBridge } from "./runtime";
import { parsePackage } from "./packages";
import { officialPackageTexts } from "./officialPackages";
import type { PluginContext } from "./types";
import { provider } from "../../community-plugins/pomodoro/main";
import { getTimerMode, onTimerModeOpening } from "./timers";

function bridge() {
  let data: any = { tasks: [], projects: [], events: [] };
  let config: Record<string, unknown> = {};
  const contributions: string[] = [], clean = vi.fn();
  const value: RuntimeBridge = {
    key: "official:weather", platform: "web",
    host: { getData: () => data, saveData: async next => { data = next; }, getSettings: () => ({ language: "en" } as any), saveSettings: async () => {}, getAccountId: () => "alice", toast: vi.fn(), internal: {} },
    config: () => config, saveConfig: async patch => { config = { ...config, ...patch }; }, getValue: async () => null, setValue: async () => {}, removeValue: async () => {},
    contribute: (kind, name, mount, options) => { contributions.push(`${kind}:${name}:${options?.placement || ""}:${options?.planningView ? "planning" : ""}`); return clean; },
    registerNativePlanningView: () => clean, executeCommand: async () => {}, addCommand: () => clean,
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
  it("routes header items to declared placements and cleans planning view registrations", async () => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test"); vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const f = bridge(), pkg = parsePackage(new TextEncoder().encode(officialPackageTexts.weather)); delete pkg.manifest.styles;
    let ctx!: PluginContext;
    const loaded = await loadPlugin(pkg, f.value, async () => ({ default: { onload(context) {
      ctx = context;
      context.ui.addHeaderItem("Legacy", () => {});
      context.ui.addHeaderItem("Candidates", () => {}, { placement: "candidate-header" });
      context.ui.addHeaderItem("Planning tools", () => {}, { placement: "planning-sidebar" });
      context.ui.registerPlanningView("Review", () => {});
    } } }));
    expect(f.contributions).toEqual([
      "headerItems:Legacy:app-header:",
      "headerItems:Candidates:candidate-header:",
      "headerItems:Planning tools:planning-sidebar:",
      "views:Review::planning",
    ]);
    await loaded.dispose();
    expect(f.clean).toHaveBeenCalledTimes(4);
    vi.unstubAllGlobals();
  });
  it("exposes a bundled launcher icon for the active plugin and revokes it on unload", async () => {
    const createUrl = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:launcher-icon");
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const pkg = parsePackage(new TextEncoder().encode(officialPackageTexts.weather));
    delete pkg.manifest.styles;
    pkg.manifest.icon = "icon.svg";
    pkg.files["icon.svg"] = { encoding: "utf8", data: '<svg viewBox="0 0 24 24"><path d="M4 12h16"/></svg>' };
    const loaded = await loadPlugin(pkg, bridge().value, async () => ({ default: { onload() {} } }));
    expect(loaded.iconUrl).toBe("blob:launcher-icon");
    const icon = createUrl.mock.calls.at(-1)?.[0];
    if (!(icon instanceof Blob)) throw new Error("Expected an SVG blob for the launcher icon");
    expect(icon.type).toBe("image/svg+xml");
    expect(await icon.text()).toContain('<svg xmlns="http://www.w3.org/2000/svg" viewBox=');
    await loaded.dispose();
    expect(revoke).toHaveBeenCalledWith("blob:launcher-icon");
  });
  it("cleans partial activation when plugin startup throws", async () => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test"); vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const f = bridge(), pkg = parsePackage(new TextEncoder().encode(officialPackageTexts.weather)); delete pkg.manifest.styles;
    await expect(loadPlugin(pkg, f.value, async () => ({ default: { onload(ctx) { ctx.ui.registerView("Partial", () => {}); throw new Error("broken"); } } }))).rejects.toThrow("broken");
    expect(f.clean).toHaveBeenCalledTimes(1);
  });
  it("opens host timer controls through the public SDK and revokes them on unload", async () => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test"); vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const f = bridge(), pkg = parsePackage(new TextEncoder().encode(officialPackageTexts.weather)); delete pkg.manifest.styles;
    let ctx!: PluginContext;
    const launch = vi.fn(); const off = onTimerModeOpening(launch);
    const loaded = await loadPlugin(pkg, f.value, async () => ({ default: { onload(context) { ctx = context; ctx.timers.registerMode(provider as any); } } }));
    try {
      ctx.timers.open("pomodoro"); expect(launch).toHaveBeenCalledExactlyOnceWith("pomodoro");
      await loaded.dispose(); expect(getTimerMode("pomodoro")).toBeUndefined();
      expect(() => ctx.timers.open("pomodoro")).toThrow("Plugin is unloaded");
      expect(launch).toHaveBeenCalledTimes(1);
    } finally { await loaded.dispose(); off(); }
  });
});
