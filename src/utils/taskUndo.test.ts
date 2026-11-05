import { describe, expect, it } from "vitest";
import type { PlannerData, Task } from "../types";
import { createDemoData } from "../productDemoData";
import { captureTaskUndo, undoTaskChanges } from "./taskUndo";
import { applyMobilePlacement } from "./mobilePlacement";
import { withDeletionTombstones } from "../syncMerge";

const date = "2026-10-13";
const stamp = `${date}T09:00:00.000Z`;

function schedule(task: Task) {
  return applyMobilePlacement(task, { id: "test-record", taskId: task.id, scheduledDate: date,
    scheduledStart: "09:00", scheduledEnd: "09:30", executionStatus: "scheduled", createdAt: stamp });
}

describe("operation-scoped task undo", () => {
  it("retains tasks, notes, and same-task title edits made after scheduling a task", () => {
    const before = createDemoData("en", "planning", 0);
    const after = { ...before, tasks: [schedule(before.tasks[0]), ...before.tasks.slice(1)] };
    const undo = captureTaskUndo(before, after);
    const newTask: Task = { ...before.tasks[0], id: "new", title: "New work" };
    const latest = { ...after, tasks: [...after.tasks.map((task, i) => i === 0 ? { ...task, title: "Edited title" } : task), newTask], notes: [{ id: "note", content: "New note", tags: [], createdAt: stamp }] };
    const restored = undoTaskChanges(latest, undo, stamp);
    expect(restored.tasks.find((task) => task.id === "new")).toBe(newTask);
    expect(restored.tasks[0].title).toBe("Edited title");
    expect(restored.tasks[0].plannedForDate).toBe(before.tasks[0].plannedForDate);
    expect(restored.notes).toBe(latest.notes);
  });

  it("does not overwrite a later reschedule or resurrect a deleted task", () => {
    const before = createDemoData("en", "planning", 0);
    const after = { ...before, tasks: [schedule(before.tasks[0]), ...before.tasks.slice(1)] };
    const undo = captureTaskUndo(before, after);
    const latest = { ...after, tasks: after.tasks.map((task, i) => i === 0 ? { ...task, plannedForDate: "2026-10-15" } : task) };
    expect(undoTaskChanges(latest, undo, stamp).tasks[0].plannedForDate).toBe("2026-10-15");
    const deleted = { ...latest, tasks: latest.tasks.slice(1) };
    expect(undoTaskChanges(deleted, undo, stamp).tasks.map((task) => task.id)).toEqual(deleted.tasks.map((task) => task.id));
  });

  it("undoes a promoted subtask and persists a tombstone while keeping new work", () => {
    const before = createDemoData("en", "planning", 0);
    before.tasks[0] = { ...before.tasks[0], subtasks: [{ id: "sub", title: "Subtask", completed: false, createdAt: stamp }] };
    const parent = { ...before.tasks[0], subtasks: [{ ...before.tasks[0].subtasks![0], plannedTaskId: "promoted" }] };
    const promoted = schedule({ ...before.tasks[0], id: "promoted", parentTaskId: parent.id, subtasks: [] });
    const after = { ...before, tasks: [parent, ...before.tasks.slice(1), promoted] };
    const latest = { ...after, tasks: [...after.tasks, { ...before.tasks[1], id: "later" }] };
    const undone = undoTaskChanges(latest, captureTaskUndo(before, after), stamp);
    const persisted = withDeletionTombstones(latest, undone, stamp);
    expect(persisted.tasks.some((task) => task.id === "promoted")).toBe(false);
    expect(persisted.tasks.some((task) => task.id === "later")).toBe(true);
    expect(persisted.tasks[0].subtasks?.[0].plannedTaskId).toBeUndefined();
    expect(persisted.sync?.deleted["tasks:promoted"]).toBe(stamp);
  });
});
