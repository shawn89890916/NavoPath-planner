import { afterEach, describe, expect, it, vi } from "vitest";
import { loadV2Preview, type V2PreviewBridge } from "./runtimeV2Host";
import type { ExtensionPackage, ExtensionContribution, ExtensionHost } from "./types";
import type { PluginContextV2 } from "./sdkV2";

function fixture() {
  const tasks = [
    { id: "one", title: "Read", completed: false, projectId: "project", dueDate: "", estimatedHours: 0.5, notes: "private host field" },
    { id: "two", title: "Done", completed: true },
  ];
  let current = true;
  const views = new Map<string, ExtensionContribution>();
  const settings = new Map<string, ExtensionContribution>();
  const host: ExtensionHost = {
    getData: () => ({ tasks } as any), saveData: vi.fn(),
    getSettings: () => ({ language: "en" } as any), saveSettings: vi.fn(),
    toast: vi.fn(), getAccountId: () => "alice", internal: { secret: true },
  };
  const bridge: V2PreviewBridge = {
    key: "official:preview-sample", host, platform: "web", isCurrent: () => current,
    register(kind, value) {
      const map = kind === "views" ? views : settings;
      map.set(value.id, value);
      return () => { map.delete(value.id); };
    },
  };
  const pkg: ExtensionPackage = {
    manifest: {
      id: "preview-sample", name: "Sample", description: "Sample", author: "Sample",
      version: "1.0.0", minAppVersion: "1.7.0-beta.139", kind: "plugin",
      platforms: ["web"], apiVersion: 2, main: "main.js",
      permissions: ["tasks.read", "ui.workspace", "ui.planning", "ui.settings", "ui.toast"],
    },
    files: { "main.js": { encoding: "utf8", data: "export default {}" } },
  };
  return { bridge, pkg, tasks, views, settings, invalidate: () => { current = false; } };
}
afterEach(() => vi.restoreAllMocks());
describe("protocol 2 production preview bridge", () => {
  it("projects real host task data without exposing raw objects and registers stable native page contributions", async () => {
    const f = fixture();
    let ctx!: PluginContextV2;
    const cleanup = vi.fn();
    const loaded = await loadV2Preview(f.pkg, f.bridge, async () => ({ default: {
      onload(context) {
        ctx = context;
        ctx.ui.registerWorkspacePage({ id: "work", name: "Work", mount: () => cleanup });
        ctx.ui.registerPlanningView({ id: "plan", name: "Plan", mount: () => {} });
        ctx.ui.registerSettingsPage({ id: "options", name: "Options", mount: () => {} });
      },
    } }));
    expect(ctx).not.toHaveProperty("app");
    expect(await ctx.tasks.list()).toEqual([{ id: "one", title: "Read", completed: false, projectId: "project", dueDate: undefined, estimateMinutes: 30 }]);
    expect((await ctx.tasks.list({ ids: ["two"], includeCompleted: true }))[0].id).toBe("two");
    const projected = await ctx.tasks.list();
    (projected[0] as { title: string }).title = "edited";
    expect(f.tasks[0].title).toBe("Read");
    await expect(ctx.tasks.execute({ kind: "create", operationId: "x", title: "X" })).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
    expect(f.bridge.host.saveData).not.toHaveBeenCalled();
    expect(f.views.get("official:preview-sample:ui.planning:plan")?.planningView).toBe(true);
    expect(f.settings.size).toBe(1);
    const page = f.views.get("official:preview-sample:ui.workspace:work")!;
    const off = await page.mount({} as HTMLElement);
    await loaded.dispose();
    if (typeof off === "function") await off();
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(f.views.size + f.settings.size).toBe(0);
    await expect(ctx.tasks.list()).rejects.toMatchObject({ code: "INACTIVE" });
  });
  it("rejects unwired permissions and non-approved owners before importing code", async () => {
    const f = fixture(), importer = vi.fn();
    await expect(loadV2Preview(f.pkg, { ...f.bridge, key: "imported:preview-sample" }, importer)).rejects.toThrow("approved catalog");
    f.pkg.manifest.permissions = ["tasks.write"];
    await expect(loadV2Preview(f.pkg, f.bridge, importer)).rejects.toThrow("supported permissions");
    expect(importer).not.toHaveBeenCalled();
  });
  it("does not activate a module whose import resolves after the account changes", async () => {
    const f = fixture(), onload = vi.fn();
    let finish!: (value: { default: { onload: typeof onload } }) => void;
    const pending = loadV2Preview(f.pkg, f.bridge, () => new Promise(resolve => { finish = resolve; }));
    f.invalidate(); finish({ default: { onload } });
    await expect(pending).rejects.toMatchObject({ code: "INACTIVE" });
    expect(onload).not.toHaveBeenCalled();
    expect(f.views.size).toBe(0);
  });
  it("clears partial registrations on a duplicate page or startup failure", async () => {
    const f = fixture();
    await expect(loadV2Preview(f.pkg, f.bridge, async () => ({ default: {
      onload(ctx) {
        ctx.ui.registerWorkspacePage({ id: "a", name: "A", mount: () => {} });
        ctx.ui.registerWorkspacePage({ id: "b", name: "B", mount: () => {} });
      },
    } }))).rejects.toThrow("Only one page");
    expect(f.views.size).toBe(0);
  });
});
