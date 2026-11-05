import { describe, expect, it } from "vitest";
import type { PlannerData, Task } from "../types";
import { reorderTodayCandidates, returnScheduledTaskToToday } from "./todayCandidates";

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    title: "Draft essay",
    dueDate: "",
    category: "personal",
    priority: "medium",
    notes: "",
    goalId: "",
    completed: false,
    createdAt: "2026-06-20T00:00:00.000Z",
    updatedAt: "2026-06-20T00:00:00.000Z",
    ...overrides,
  };
}

function data(tasks: Task[]): PlannerData {
  return {
    version: 2,
    importedSeedVersion: "test",
    generatedAt: "2026-06-20T00:00:00.000Z",
    goals: [], projects: [], tasks, longTasks: [], events: [], notes: [], drafts: [], chat: [], aiMemories: [],
  };
}

describe("today candidate transformations", () => {
  it("returns a scheduled promoted subtask to today without clearing its planned marker", () => {
    const source = data([
      task({
        subtasks: [{ id: "sub-1", title: "Collect sources", completed: false, plannedTaskId: "promoted-1", createdAt: "now" }],
      }),
      task({
        id: "promoted-1",
        parentTaskId: "task-1",
        title: "Collect sources",
        plannedForDate: "2026-06-20",
        executionLane: undefined,
        timelineRecords: [{ id: "record-1", taskId: "promoted-1", scheduledDate: "2026-06-20", scheduledStart: "09:00", scheduledEnd: "09:30", executionStatus: "scheduled", createdAt: "now" }],
      }),
    ]);

    const result = returnScheduledTaskToToday(source, "record-1", "2026-06-20", "now");

    expect(result.action).toBe("returned");
    expect(result.data.tasks[1]).toMatchObject({ plannedForDate: "2026-06-20", executionLane: "candidate", timelineRecords: [] });
    expect(result.data.tasks[0].subtasks?.[0].plannedTaskId).toBe("promoted-1");
  });

  it("removes only the selected execution and keeps the remaining schedule", () => {
    const record = { id: "first", taskId: "task-1", scheduledDate: "2026-06-20", scheduledStart: "09:00", scheduledEnd: "09:30", executionStatus: "scheduled" as const, createdAt: "now" };
    const remaining = { ...record, id: "second", scheduledStart: "10:00", scheduledEnd: "10:30" };
    const source = data([task({ projectId: "project-1", executionLane: undefined, timelineRecords: [record, remaining] })]);
    const result = returnScheduledTaskToToday(source, record.id, "2026-06-20", "now");
    expect(result.data.tasks[0]).toMatchObject({ projectId: "project-1", executionLane: undefined, timelineRecords: [remaining] });
    expect(returnScheduledTaskToToday(result.data, record.id, "2026-06-20").data).toBe(result.data);
  });

  it("preserves explicit records when cancelling a legacy all-day block", () => {
    const record = { id: "record-1", taskId: "task-1", scheduledDate: "2026-06-21", scheduledStart: "10:00", scheduledEnd: "10:30", executionStatus: "scheduled" as const, createdAt: "now" };
    const source = data([task({ scheduledDate: "2026-06-20", executionLane: undefined, timelineRecords: [record] })]);
    const result = returnScheduledTaskToToday(source, "task-1", "2026-06-20", "now");
    expect(result.data.tasks[0]).toMatchObject({ scheduledDate: undefined, executionLane: undefined, timelineRecords: [record] });
  });
});


describe("today candidate ordering", () => {
  const candidates = () => data([
    task({ id: "a", projectId: "p1", order: 0, parentTaskId: "parent", goalId: "goal", recurrence: { mode: "flexible", frequency: "daily" } }),
    task({ id: "b", projectId: "p2", order: 0 }),
    task({ id: "c", projectId: "p1", order: 10 }),
    task({ id: "d", order: 10 }),
    task({ id: "hidden", projectId: "p1", order: 15 }),
  ]);
  const visible = ["a", "b", "c", "d"];
  const ordered = (result: PlannerData) => result.tasks.filter((item) => visible.includes(item.id))
    .sort((a, b) => (a.order || 0) - (b.order || 0)).map((item) => item.id);

  it("orders the entire mixed-project list without changing task metadata", () => {
    const source = candidates();
    const result = reorderTodayCandidates(source, visible, "a", "d", "after", false, "now");
    expect(ordered(result)).toEqual(["b", "c", "d", "a"]);
    for (const original of source.tasks) {
      const updated = result.tasks.find((item) => item.id === original.id)!;
      expect({ ...updated, order: original.order, updatedAt: original.updatedAt }).toEqual(original);
    }
    expect(result.tasks[4]).toBe(source.tasks[4]);
    expect(source.tasks[0].order).toBe(0);
  });

  it("keeps repeated up/down moves stable after serialization", () => {
    let result = reorderTodayCandidates(candidates(), visible, "a", "d", "after", false);
    result = JSON.parse(JSON.stringify(result));
    result = reorderTodayCandidates(result, ordered(result), "a", "b", "before", false);
    expect(ordered(result)).toEqual(visible);
    result = reorderTodayCandidates(result, ordered(result), "d", "b", "after", false);
    expect(ordered(result)).toEqual(["a", "b", "d", "c"]);
  });

  it("allows same-project sorting and rejects cross-project drops when grouped", () => {
    const source = candidates();
    expect(reorderTodayCandidates(source, visible, "a", "b", "after", true)).toBe(source);
    expect(reorderTodayCandidates(source, visible, "a", "d", "after", true)).toBe(source);
    expect(ordered(reorderTodayCandidates(source, visible, "c", "a", "before", true)))
      .toEqual(["c", "a", "b", "d"]);
  });

  it("ignores missing, hidden, same-position and different-completion targets", () => {
    const source = candidates();
    expect(reorderTodayCandidates(source, visible, "a", "missing", "after", false)).toBe(source);
    expect(reorderTodayCandidates(source, visible, "a", "hidden", "after", false)).toBe(source);
    expect(reorderTodayCandidates(source, visible, "a", "a", "after", false)).toBe(source);
    expect(reorderTodayCandidates(source, visible, "a", "b", "before", false)).toBe(source);
    source.tasks[1].completed = true;
    expect(reorderTodayCandidates(source, visible, "a", "b", "after", false)).toBe(source);
  });
});
