import { afterEach, describe, expect, it, vi } from "vitest";
import { createMemoryStorage, getWorkspaceDemoRuntime, getWorkspaceStorage, workspaceNow } from "./workspaceEnvironment";
import { installProductDemo } from "./productDemoRuntime";
import { DEMO_DATE, scheduleDemoTask } from "./productDemoData";

afterEach(() => vi.unstubAllGlobals());
function demoWindow() {
  const realStorage = createMemoryStorage(); realStorage.setItem("workspace", "untouched");
  const parent = { postMessage: vi.fn() };
  const location = { pathname: "/product-demo/ai", search: "?lang=en", origin: "http://localhost" };
  const target = { localStorage: realStorage, location, addEventListener: vi.fn() };
  vi.stubGlobal("window", target); vi.stubGlobal("location", location); vi.stubGlobal("navigator", { language: "zh-CN" }); vi.stubGlobal("parent", parent);
  vi.stubGlobal("document", { documentElement: { classList: { add: vi.fn(), toggle: vi.fn() } } });
  return { target, realStorage, parent };
}
describe("workspace example boundary", () => {
  it("uses independent memory API and storage, and restores its fixture on refresh", async () => {
    const { target, realStorage } = demoWindow(); installProductDemo("ai");
    const api = window.plannerApi!; const original = (await api.getBootstrap!()).data!;
    const changed = structuredClone(original); changed.tasks[0].title = "Changed"; await api.saveData(changed);
    changed.tasks[0].title = "External mutation";
    expect((await api.getData()).tasks[0].title).toBe("Changed");
    getWorkspaceStorage().setItem("workspace", "demo");
    expect(realStorage.getItem("workspace")).toBe("untouched");
    expect(workspaceNow().getFullYear()).toBe(2030);
    target.location.pathname = "/app";
    expect(getWorkspaceDemoRuntime()).toBeUndefined(); expect(getWorkspaceStorage()).toBe(window.localStorage);
    target.location.pathname = "/product-demo/ai"; installProductDemo("ai");
    expect((await window.plannerApi!.getData()).tasks[0].title).toBe(original.tasks[0].title);
  });
  it("plans every example candidate once around existing schedules", async () => {
    demoWindow(); installProductDemo("ai");
    let state = await window.plannerApi!.getData();
    const runtime = getWorkspaceDemoRuntime()!;
    const suggestion = runtime.suggest(state);
    expect(suggestion.actions).toHaveLength(4);
    for (const action of suggestion.actions || []) {
      if (action.type !== "schedule_task" || !action.taskId || !action.date || !action.start) throw new Error("Expected a scheduled task");
      const next = scheduleDemoTask(state, action.taskId, action.date, action.start);
      expect(next).not.toBe(state);
      state = next;
    }
    expect(runtime.suggest(state).actions).toEqual([]);
  });
  it("reschedules presets into free slots on tomorrow and the following day", async () => {
    demoWindow(); installProductDemo("ai");
    const initial = await window.plannerApi!.getData();
    const state = scheduleDemoTask(initial, "notebook", "2030-10-08", "09:00", 60);
    const runtime = getWorkspaceDemoRuntime()!;
    expect(runtime.suggest(state, { taskId: "content", days: 1 }).actions?.[0]).toMatchObject({ type: "schedule_task", taskId: "content", date: "2030-10-08", start: "10:00" });
    expect(runtime.suggest(state, { taskId: "layout", days: 2 }).actions?.[0]).toMatchObject({ type: "schedule_task", taskId: "layout", date: "2030-10-09", start: "09:00" });
    expect(runtime.suggest(state, { taskId: "missing", days: 1 }).actions).toEqual([]);
    expect(state.tasks.find(task => task.id === "content")?.plannedForDate).toBe(DEMO_DATE);
  });
  it("keeps preset suggestions clear of migrated timeline records", async () => {
    const { parent } = demoWindow(); installProductDemo("ai");
    const state = await window.plannerApi!.getData(); const morningTask = state.tasks.find(task => task.id === "notebook")!;
    morningTask.timelineRecords = [{ id: "migrated", taskId: morningTask.id, scheduledDate: DEMO_DATE, scheduledStart: "09:00", scheduledEnd: "09:30", executionStatus: "scheduled", createdAt: morningTask.createdAt }];
    delete morningTask.scheduledDate; delete morningTask.scheduledStart; delete morningTask.scheduledEnd;
    const runtime = getWorkspaceDemoRuntime()!; const suggestion = runtime.suggest(state);
    const action = suggestion.actions?.[0];
    expect(action?.type).toBe("schedule_task");
    expect(action && "start" in action ? action.start : undefined).toBe("09:30");
    runtime.ready(); expect(parent.postMessage).toHaveBeenCalledWith({ channel: "navopath-product-demo", type: "ready" }, "http://localhost");
  });
});
