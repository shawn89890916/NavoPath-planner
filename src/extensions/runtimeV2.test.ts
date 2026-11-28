import { describe, expect, it, vi } from "vitest";
import type { V2Capability, V2ContributionKind, V2ContributionMap, V2TaskGroup } from "./sdkV2";
import { activateV2, createV2Session, type V2HostAdapter } from "./runtimeV2";
import samplePlugin from "../../integrations/navopath-plugin-template/examples/protocol-v2";

function mockHost(...capabilities: V2Capability[]) {
  let current = true;
  const registry = new Map<string, V2ContributionMap[V2ContributionKind]>();
  const task = { id: "task", title: "Read", completed: false };
  const list = vi.fn(async () => [task]);
  const execute = vi.fn(async () => ({ status: "committed" as const, task }));
  const read = vi.fn(async () => ({ status: "absent" as const, revision: null }));
  const write = vi.fn(async () => ({ status: "conflict" as const, current: { status: "absent" as const, revision: null } }));
  const off = vi.fn();
  let listener: (() => void) | undefined;
  const host: V2HostAdapter = {
    owner: "official:sample", language: "en", platform: "web",
    supported: new Set(capabilities), granted: new Set(capabilities),
    isCurrent: () => current,
    tasks: { list, execute },
    activity: { query: async () => ({ planned: [], actual: [] }) },
    storage: { read, write, subscribe: (_key, fn) => { listener = fn; return off; } },
    contribute: (_kind, id, value) => {
      registry.set(id, value); return () => { registry.delete(id); };
    },
    toast: vi.fn(),
  };
  return { host, registry, task, list, execute, read, write, off,
    changeAccount: () => { current = false; }, emit: () => listener?.(),
    manifest: { apiVersion: 2 as const, permissions: capabilities } };
}
describe("protocol 2 contract (mock host; not production negotiation)", () => {
  it("runs the example authored against the generated public SDK", async () => {
    const f = mockHost("tasks.read", "tasks.write", "ui.toast", "ui.tasksGroup", "ui.workspace", "ui.planning", "ui.settings", "metrics.provider");
    const loaded = await activateV2(samplePlugin, f.manifest, f.host);
    expect(f.registry.size).toBe(5);
    await loaded.dispose(); expect(f.registry.size).toBe(0);
  });
  it("rejects unsupported or ungranted capabilities before activation", () => {
    const f = mockHost("tasks.read");
    expect(() => createV2Session({ apiVersion: 2, permissions: ["storage.read"] }, f.host)).toThrow("storage.read");
    expect(() => createV2Session(f.manifest, { ...f.host, granted: new Set() })).toThrow("tasks.read");
    expect(() => createV2Session(f.manifest, { ...f.host, tasks: undefined })).toThrow("tasks.read");
    expect(() => createV2Session({ apiVersion: 2, permissions: ["tasks.read", "tasks.read"] }, f.host)).toThrow("Invalid permission");
  });
  it("exposes only scoped capabilities, clones host results and rejects undeclared writes", async () => {
    const f = mockHost("tasks.read");
    const session = createV2Session(f.manifest, f.host);
    expect(session.context).not.toHaveProperty("app");
    const tasks = await session.context.tasks.list();
    (tasks[0] as { title: string }).title = "mutated";
    expect(f.task.title).toBe("Read");
    await expect(session.context.tasks.execute({ kind: "complete", operationId: "op", taskId: "task", completed: true })).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
    expect(f.execute).not.toHaveBeenCalled();
    await session.close();
    await expect(session.context.tasks.list()).rejects.toMatchObject({ code: "INACTIVE" });
  });
  it("registers every contribution kind with stable owner keys and disposes on unload", async () => {
    const f = mockHost("ui.tasksGroup", "ui.workspace", "ui.planning", "ui.settings", "metrics.provider");
    const page = { id: "page", name: "Sample", mount: () => {} };
    const group: V2TaskGroup = { id: "group", name: "Tasks", resolve: () => ["task", "task", "unknown"] };
    const plugin = await activateV2({ onload(ctx) {
      ctx.ui.registerTaskGroup(group);
      ctx.ui.registerWorkspacePage(page);
      ctx.ui.registerPlanningView(page);
      ctx.ui.registerSettingsPage(page);
      ctx.metrics.registerProvider({ id: "metric", name: "Count", query: facts => [{ label: "Actual", value: facts.actual.length }] });
      expect(() => ctx.ui.registerTaskGroup(group)).toThrow("official:sample:ui.tasksGroup:group");
    } }, f.manifest, f.host);
    expect(f.registry.size).toBe(5);
    const registered = f.registry.get("official:sample:ui.tasksGroup:group") as V2TaskGroup;
    expect(await registered.resolve(["task"])).toEqual(["task"]);
    await plugin.dispose();
    await plugin.dispose();
    expect(f.registry.size).toBe(0);
    await expect(registered.resolve(["task"])).rejects.toMatchObject({ code: "INACTIVE" });
  });
  it("releases membership subscriptions when a group is removed", async () => {
    const f = mockHost("ui.tasksGroup");
    const session = createV2Session(f.manifest, f.host);
    let notify!: () => void;
    const cleanup = vi.fn(), listener = vi.fn();
    const remove = session.context.ui.registerTaskGroup({ id: "group", name: "Tasks", resolve: () => [],
      subscribe(fn) { notify = fn; return cleanup; },
    });
    const group = f.registry.get("official:sample:ui.tasksGroup:group") as V2TaskGroup;
    const off = group.subscribe!(listener);
    notify(); expect(listener).toHaveBeenCalledTimes(1);
    await remove(); notify(); await off(); await session.close();
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledTimes(1);
  });
  it("revokes an individual contribution without revoking the plugin", async () => {
    const f = mockHost("ui.tasksGroup", "ui.workspace", "tasks.read");
    const session = createV2Session(f.manifest, f.host);
    const group: V2TaskGroup = { id: "group", name: "Tasks", resolve: () => ["task"] };
    const off = session.context.ui.registerTaskGroup(group);
    const stale = f.registry.get("official:sample:ui.tasksGroup:group") as V2TaskGroup;
    await off();
    await expect(stale.resolve(["task"])).rejects.toMatchObject({ code: "INACTIVE" });
    session.context.ui.registerTaskGroup(group);
    await expect(stale.resolve(["task"])).rejects.toMatchObject({ code: "INACTIVE" });
    expect(await session.context.tasks.list()).toHaveLength(1);

    const cleanup = vi.fn();
    let finish!: (off: () => void) => void;
    const unmount = session.context.ui.registerWorkspacePage({ id: "page", name: "Page", mount: () => new Promise(resolve => { finish = resolve; }) });
    const page = f.registry.get("official:sample:ui.workspace:page") as V2ContributionMap["ui.workspace"];
    const pending = page.mount({} as HTMLElement);
    await unmount();
    finish(cleanup); await pending;
    expect(cleanup).toHaveBeenCalledTimes(1);
    await session.close();
  });
  it("revokes before cleanup, cleans up after activation failure and continues after errors", async () => {
    const f = mockHost("ui.workspace");
    const disposed = vi.fn();
    await expect(activateV2({ onload(ctx) {
      ctx.ui.registerWorkspacePage({ id: "page", name: "Sample", mount: () => {} });
      ctx.register(disposed);
      ctx.register(() => { throw new Error("cleanup"); });
      throw new Error("startup");
    } }, f.manifest, f.host)).rejects.toBeInstanceOf(AggregateError);
    expect(disposed).toHaveBeenCalledTimes(1);
    expect(f.registry.size).toBe(0);
    const session = createV2Session(f.manifest, f.host);
    session.context.register(() => expect(session.context.signal.aborted).toBe(true));
    await session.close();
  });
  it("ignores stale subscriptions and late async results after account change", async () => {
    const f = mockHost("tasks.read", "storage.read");
    let release!: (tasks: readonly typeof f.task[]) => void;
    f.host.tasks!.list = () => new Promise(resolve => { release = resolve; });
    const session = createV2Session(f.manifest, f.host), listener = vi.fn();
    session.context.storage.subscribe("library", listener);
    f.emit(); expect(listener).toHaveBeenCalledTimes(1);
    const pending = session.context.tasks.list();
    f.changeAccount(); f.emit(); release([f.task]);
    expect(listener).toHaveBeenCalledTimes(1);
    await expect(pending).rejects.toMatchObject({ code: "INACTIVE" });
    await session.close(); expect(f.off).toHaveBeenCalledTimes(1);
  });
  it("cleans a page mount that resolves after activation ended", async () => {
    const f = mockHost("ui.workspace");
    const cleanup = vi.fn();
    let finish!: (off: () => void) => void;
    const session = createV2Session(f.manifest, f.host);
    session.context.ui.registerWorkspacePage({ id: "page", name: "Sample", mount: () => new Promise(resolve => { finish = resolve; }) });
    const page = f.registry.get("official:sample:ui.workspace:page") as V2ContributionMap["ui.workspace"];
    const pending = page.mount({} as HTMLElement);
    await session.close(); finish(cleanup); await pending;
    expect(cleanup).toHaveBeenCalledTimes(1);
  });
  it("passes storage conflicts through without claiming an offline write committed", async () => {
    const f = mockHost("storage.read", "storage.write");
    const session = createV2Session(f.manifest, f.host);
    expect(await session.context.storage.read("library")).toEqual({ status: "absent", revision: null });
    const command = { kind: "set", value: { title: "Book" }, expectedRevision: "old", operationId: "op" } as const;
    expect(await session.context.storage.write("library", command)).toMatchObject({ status: "conflict" });
    expect(f.write).toHaveBeenCalledWith("library", command, session.context.signal);
    await expect(session.context.storage.read("")).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await session.close();
  });
});
