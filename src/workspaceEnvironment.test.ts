import { afterEach, describe, expect, it, vi } from "vitest";
import { createMemoryStorage, getWorkspaceDemoRuntime, getWorkspaceStorage, workspaceNow } from "./workspaceEnvironment";
import { installProductDemo } from "./productDemoRuntime";
import { DEMO_DATE } from "./productDemoData";

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
  it("keeps preset suggestions clear of migrated timeline records", async () => {
    const { parent } = demoWindow(); installProductDemo("ai");
    const state = await window.plannerApi!.getData(); const meeting = state.tasks.find(task => task.id === "event_occ_demo")!;
    meeting.timelineRecords = [{ id: "migrated", taskId: meeting.id, scheduledDate: DEMO_DATE, scheduledStart: "09:00", scheduledEnd: "09:30", executionStatus: "scheduled", createdAt: meeting.createdAt }];
    delete meeting.scheduledDate; delete meeting.scheduledStart; delete meeting.scheduledEnd;
    const runtime = getWorkspaceDemoRuntime()!; const suggestion = runtime.suggest(state);
    const action = suggestion.actions?.[0];
    expect(action?.type).toBe("schedule_task");
    expect(action && "start" in action ? action.start : undefined).toBe("09:30");
    runtime.ready(); expect(parent.postMessage).toHaveBeenCalledWith({ channel: "navopath-product-demo", type: "ready" }, "http://localhost");
  });
});
