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
  it("blocks the entire undo when a later change overlaps, then permits it after that change is undone", () => {
    const before = createDemoData("en", "planning", 0);
    const first = { ...before, tasks: [schedule(before.tasks[0]), ...before.tasks.slice(1)] };
    const later = { ...first, tasks: [{ ...first.tasks[0], plannedForDate: "2026-10-15" }, ...first.tasks.slice(1)] };
    const firstUndo = captureTaskUndo(before, first);
    expect(undoTaskChanges(later, firstUndo, stamp)).toBe(later);
    const restored = undoTaskChanges(later, captureTaskUndo(first, later), stamp);
    expect(undoTaskChanges(restored, firstUndo, stamp).tasks[0].timelineRecords).toEqual(before.tasks[0].timelineRecords);
  });

  it("protects a task created by an operation after later work modifies it", () => {
    const before = createDemoData("en", "planning", 0);
    const added = { ...before.tasks[0], id: "created" };
    const after = { ...before, tasks: [...before.tasks, added] };
    const undo = captureTaskUndo(before, after);
    const modified = { ...after, tasks: [...before.tasks, { ...added, notes: "Later notes" }] };
    expect(undoTaskChanges(modified, undo, stamp)).toBe(modified);
    expect(undoTaskChanges(after, undo, stamp).tasks).toEqual(before.tasks);
  });

  it("restores a deleted task past its sync tombstone while preserving other tasks", () => {
    const before = createDemoData("en", "planning", 0);
    const [deleted, ...kept] = before.tasks;
    const after = withDeletionTombstones(before, { ...before, tasks: kept }, stamp);
    const restored = undoTaskChanges(after, captureTaskUndo(before, after), stamp);
    const persisted = withDeletionTombstones(after, restored, stamp);
    expect(persisted.tasks.slice(0, kept.length)).toEqual(kept);
    expect(persisted.tasks.find((task) => task.id === deleted.id)?.title).toBe(deleted.title);
    expect(persisted.sync?.deleted[`tasks:${deleted.id}`]).toBeUndefined();
  });

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
