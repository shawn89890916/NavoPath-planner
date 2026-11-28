import { describe, expect, it, vi } from "vitest";
import type { PlannerData, Task } from "../types";
import { executePluginTask, pluginEntityKeys, linkedPluginEntity } from "./pluginTaskCommands";
import { captureTaskUndo } from "../utils/taskUndo";
import { withDeletionTombstones } from "../syncMerge";

const stamp = "2026-11-28T09:00:00.000Z";
function fixture() {
  let data = { tasks: [], projects: [], events: [], habits: [], habitDailyStates: [] } as unknown as PlannerData;
  let active = true;
  const save = vi.fn(async (next: PlannerData, _kind: string) => { data = next; });
  const host = { current: () => data, active: () => active, now: () => stamp, today: () => "2026-11-28", save };
  return { host, save, get data() { return data; }, set data(next) { data = next; }, deactivate: () => { active = false; } };
}
const create = { kind: "create", operationId: "op", title: "Read", estimateMinutes: 45 } as const;
describe("core plugin task command adapter", () => {
  it("creates a regular candidate task and uses the same id for repeated requests", async () => {
    const f = fixture();
    const results = await Promise.all([executePluginTask("official:reading", create, f.host), executePluginTask("official:reading", create, f.host)]);
    expect(results[0]).toEqual(results[1]);
    expect(results[0]).toMatchObject({ status: "accepted", task: { title: "Read", estimateMinutes: 45 } });
    expect(f.data.tasks).toHaveLength(1);
    expect(f.data.tasks[0]).toMatchObject({ executionLane: "candidate", plannedForDate: "2026-11-28", estimatedHours: 0.75 });
    expect(f.save).toHaveBeenCalledTimes(1);
    expect(f.save.mock.calls[0][1]).toBe("create");
    await executePluginTask("official:other", create, f.host);
    expect(f.data.tasks).toHaveLength(2);
  });
  it("prevents recreation of a deleted deterministic task and invalid project or malformed entity links", async () => {
    const f = fixture();
    await executePluginTask("official:reading", create, f.host);
    const id = f.data.tasks[0].id;
    f.data = withDeletionTombstones(f.data, { ...f.data, tasks: [] }, stamp);
    expect(f.data.sync?.deleted["tasks:" + id]).toBeDefined();
    expect(await executePluginTask("official:reading", create, f.host)).toMatchObject({ status: "conflict" });
    expect(await executePluginTask("official:reading", { ...create, operationId: "bad", projectId: "absent" }, f.host)).toMatchObject({ status: "conflict" });
    expect(await executePluginTask("official:reading", { ...create, operationId: "link", entityId: "" }, f.host)).toMatchObject({ status: "conflict" });
    expect(f.data.tasks).toHaveLength(0);
  });
  it("creates and recovers immutable owner-scoped entity associations without a separate link write", async () => {
    const f = fixture(), owner = "official:reading";
    const linked = { ...create, entityId: "book-1" };
    const result = await executePluginTask(owner, linked, f.host);
    expect(result).toMatchObject({ status: "accepted", task: { entityId: "book-1" } });
    const id = f.data.tasks[0].id;
    expect(id.length).toBeLessThanOrEqual(200);
    expect(linkedPluginEntity(id, await pluginEntityKeys(owner, ["book-1", "book-2"]))).toBe("book-1");
    expect(linkedPluginEntity(id, await pluginEntityKeys("official:other", ["book-1"]))).toBeUndefined();
    expect(await executePluginTask(owner, linked, f.host)).toEqual(result);
    expect(await executePluginTask(owner, { ...linked, entityId: "book-2" }, f.host)).toMatchObject({ status: "conflict" });
    expect(f.save).toHaveBeenCalledTimes(1);
    f.data = withDeletionTombstones(f.data, { ...f.data, tasks: [] }, stamp);
    expect(await executePluginTask(owner, { ...linked, entityId: "book-2" }, f.host)).toMatchObject({ status: "conflict" });
  });
  it("requires the current task revision and uses native completion semantics for linked records", async () => {
    const f = fixture();
    await executePluginTask("official:reading", create, f.host);
    const task = f.data.tasks[0];
    const record = { id: "record", taskId: task.id, scheduledDate: "2026-11-28", scheduledStart: "09:00", scheduledEnd: "09:45", executionStatus: "scheduled" as const, createdAt: stamp };
    f.data = { ...f.data, tasks: [{ ...task, timelineRecords: [record] }] };
    const before = f.data;
    const command = { kind: "complete", operationId: "complete", taskId: task.id, completed: true } as const;
    expect(await executePluginTask("official:reading", command, f.host)).toMatchObject({ status: "conflict" });
    expect(await executePluginTask("official:reading", { ...command, expectedUpdatedAt: stamp }, f.host)).toMatchObject({ status: "accepted" });
    expect(f.data.tasks[0]).toMatchObject({ completed: true, timelineRecords: [{ executionStatus: "completed" }] });
    expect(f.save.mock.calls.at(-1)?.[1]).toBe("complete");
    const undo = captureTaskUndo(before, f.data);
    expect(undo.changes).toHaveLength(1);
    const rename = { kind: "rename", operationId: "rename", taskId: task.id, title: "Later", expectedUpdatedAt: stamp } as const;
    expect(await executePluginTask("official:reading", rename, f.host)).toMatchObject({ status: "conflict" });
    expect(await executePluginTask("official:reading", { ...rename, expectedUpdatedAt: f.data.tasks[0].updatedAt }, f.host)).toMatchObject({ status: "accepted", task: { title: "Later" } });
    expect(f.save.mock.calls.at(-1)?.[1]).toBe("edit");
  });
  it("rejects a stale activation after asynchronous hashing and protected task types", async () => {
    const f = fixture();
    const pending = executePluginTask("official:reading", create, f.host);
    f.deactivate();
    expect(await pending).toMatchObject({ status: "unavailable" });
    expect(f.save).not.toHaveBeenCalled();
    const g = fixture();
    await executePluginTask("official:reading", create, g.host);
    const task: Task = { ...g.data.tasks[0], fixedCourse: true };
    g.data = { ...g.data, tasks: [task] };
    expect(await executePluginTask("official:reading", { kind: "rename", operationId: "protected", taskId: task.id, title: "X", expectedUpdatedAt: stamp }, g.host)).toMatchObject({ status: "conflict" });
  });
});
