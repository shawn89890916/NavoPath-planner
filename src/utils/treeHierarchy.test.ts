import { describe, expect, it } from "vitest";
import type { PlannerData, Project, Subtask, Task } from "../types";
import { canMoveTreeNode, moveTreeNode, captureTreeMoveUndo, undoTreeMove, treeDropPosition } from "./treeOrder";

const stamp = "2026-11-26T00:00:00.000Z";
const later = "2026-11-26T00:01:00.000Z";
const sub = (id: string, subtasks: Subtask[] = []): Subtask => ({ id, title: id, completed: false, createdAt: stamp, subtasks });
const task = (id: string, subtasks: Subtask[] = [], projectId = "p"): Task => ({
  id, title: id, notes: "original notes", goalId: "", dueDate: "2026-12-01", category: "personal",
  priority: "medium", completed: false, subtasks, projectId, createdAt: stamp, updatedAt: stamp,
});
const project = (id: string): Project => ({ id, title: id, notes: "", category: "personal", completed: false, createdAt: stamp, updatedAt: stamp });
const data = (): PlannerData => ({
  version: 1, importedSeedVersion: "", generatedAt: stamp, goals: [], projects: [project("p"), project("q")],
  tasks: [task("a", [sub("x", [sub("leaf")]), sub("y")]), task("b", [sub("z")], "q")],
  longTasks: [], events: [], notes: [], drafts: [], chat: [],
});
describe("Tree hierarchy drag", () => {
  it("distinguishes edge sorting and center nesting", () => {
    expect(treeDropPosition("task", "task", 2, 52)).toBe("before");
    expect(treeDropPosition("task", "task", 26, 52)).toBe("inside");
    expect(treeDropPosition("subtask", "task", 51, 52)).toBe("after");
    expect(treeDropPosition("task", "project", 1, 40)).toBe("inside");
    expect(treeDropPosition("project", "task", 20, 40)).toBeNull();
  });
  it("nests an independent task with its subtree, preserving metadata and identity, and detaches it into a different project", () => {
    const initial = data();
    const nested = moveTreeNode(initial, { kind: "task", id: "a" }, { kind: "task", id: "b", position: "inside" }, stamp);
    expect(nested.tasks.map(t => t.id)).toEqual(["b"]);
    const child = nested.tasks[0].subtasks?.find(s => s.id === "a");
    expect(child?.treeTaskSnapshot?.notes).toBe("original notes");
    expect(child?.subtasks?.[0].subtasks?.[0].id).toBe("leaf");
    const restored = moveTreeNode(nested, { kind: "subtask", id: "a" }, { kind: "project", id: "p", position: "inside" }, later);
    expect(restored.tasks.find(t => t.id === "a")).toMatchObject({ id: "a", projectId: "p", dueDate: "2026-12-01", notes: "original notes" });
  });
  it("moves a subtask across owners, preserves descendants and reorders siblings", () => {
    const moved = moveTreeNode(data(), { kind: "subtask", id: "x" }, { kind: "subtask", id: "z", position: "before" }, stamp);
    expect(moved.tasks.find(t => t.id === "a")?.subtasks?.map(s => s.id)).toEqual(["y"]);
    expect(moved.tasks.find(t => t.id === "b")?.subtasks?.map(s => s.id)).toEqual(["x", "z"]);
    expect(moved.tasks.find(t => t.id === "b")?.subtasks?.[0].subtasks?.[0].id).toBe("leaf");
    const sorted = moveTreeNode(moved, { kind: "subtask", id: "z" }, { kind: "subtask", id: "x", position: "before" }, later);
    expect(sorted.tasks.find(t => t.id === "b")?.subtasks?.map(s => s.id)).toEqual(["z", "x"]);
  });
  it("rejects self, descendant, unknown target and scheduled conversions", () => {
    const initial = data();
    expect(moveTreeNode(initial, { kind: "task", id: "a" }, { kind: "subtask", id: "leaf", position: "inside" })).toBe(initial);
    expect(moveTreeNode(initial, { kind: "subtask", id: "x" }, { kind: "subtask", id: "leaf", position: "before" })).toBe(initial);
    expect(moveTreeNode(initial, { kind: "task", id: "a" }, { kind: "task", id: "a", position: "inside" })).toBe(initial);
    expect(moveTreeNode(initial, { kind: "subtask", id: "x" }, { kind: "task", id: "missing", position: "inside" })).toBe(initial);
    initial.tasks[0].plannedForDate = "2026-11-26";
    expect(canMoveTreeNode(initial, { kind: "task", id: "a" }, { kind: "task", id: "b", position: "inside" })).toBe(false);
    expect(canMoveTreeNode(initial, { kind: "task", id: "a" }, { kind: "task", id: "b", position: "before" })).toBe(true);
  });
  it("promotes a plain subtask, keeping identity and assigning the target project", () => {
    const moved = moveTreeNode(data(), { kind: "subtask", id: "x" }, { kind: "task", id: "b", position: "after" }, stamp);
    expect(moved.tasks.filter(t => t.projectId === "q").map(t => t.id)).toEqual(["b", "x"]);
    expect(moved.tasks.find(t => t.id === "x")?.subtasks?.[0].id).toBe("leaf");
  });
  it("restores visible project and task order on undo", () => {
    const initial = data();
    initial.tasks = [task("a"), { ...task("b"), order: 1 }];
    initial.tasks[0].order = 0;
    initial.projects[0].order = 0;
    initial.projects[1].order = 1;
    const moved = moveTreeNode(initial, { kind: "task", id: "b" }, { kind: "task", id: "a", position: "before" }, stamp);
    expect(moved.tasks.map(t => t.id)).toEqual(["b", "a"]);
    expect(undoTreeMove(moved, captureTreeMoveUndo(initial, moved), later)?.tasks.map(t => t.id)).toEqual(["a", "b"]);
    const reordered = moveTreeNode(initial, { kind: "project", id: "q" }, { kind: "project", id: "p", position: "before" }, stamp);
    expect(reordered.projects.map(p => p.id)).toEqual(["q", "p"]);
    expect(undoTreeMove(reordered, captureTreeMoveUndo(initial, reordered), later)?.projects.map(p => p.id)).toEqual(["p", "q"]);
  });
  it("undoes removal and insertion atomically and preserves unrelated tasks", () => {
    const initial = data();
    const moved = moveTreeNode(initial, { kind: "task", id: "a" }, { kind: "task", id: "b", position: "inside" }, stamp);
    const undo = captureTreeMoveUndo(initial, moved);
    const latest = { ...moved, tasks: [...moved.tasks, task("new")] };
    const restored = undoTreeMove(latest, undo, later);
    expect(restored?.tasks.map(t => t.id).sort()).toEqual(["a", "b", "new"]);
    expect(restored?.tasks.find(t => t.id === "b")?.subtasks?.map(s => s.id)).toEqual(["z"]);
    const changed = { ...moved, tasks: moved.tasks.map(t => ({ ...t, subtasks: [] })) };
    expect(undoTreeMove(changed, undo, later)).toBeNull();
  });
});
