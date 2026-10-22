import { describe, expect, it } from "vitest";
import type { PlannerData, Task } from "../types";
import { reconcileOverdueTasks } from "./overdueTasks";

const baseTask = (patch: Partial<Task> = {}): Task => ({
  id: "task-1", title: "Read", dueDate: "", category: "exam", priority: "medium", notes: "", goalId: "", completed: false,
  createdAt: "now", updatedAt: "now", ...patch,
});
const data = (task: Task): PlannerData => ({
  version: 1, importedSeedVersion: "test", generatedAt: "now", goals: [], projects: [], tasks: [task],
  longTasks: [], events: [], notes: [], drafts: [], chat: [], aiMemories: [],
});

describe("reconcileOverdueTasks", () => {
  it("keeps an ongoing cross-midnight execution scheduled, then returns it after its end", () => {
    const task = baseTask({ timelineRecords: [{ id: "overnight", taskId: "task-1", scheduledDate: "2026-10-22",
      scheduledStart: "23:00", scheduledEnd: "01:00", scheduledEndDate: "2026-10-23", executionStatus: "scheduled", engagement: 70, createdAt: "now" }] });
    const source = data(task);
    const ongoing = reconcileOverdueTasks(source, "2026-10-23", new Date(2026, 9, 23, 0, 30).toISOString());
    expect(ongoing.changed).toBe(false);
    expect(ongoing.data).toBe(source);
    const ended = reconcileOverdueTasks(source, "2026-10-23", new Date(2026, 9, 23, 1, 0).toISOString());
    expect(ended.data.tasks[0].timelineRecords?.[0]).toMatchObject({ executionStatus: "returned_unfinished", engagement: 70 });
    expect(ended.data.tasks[0].executionLane).toBe("candidate");
  });

  it("keeps legacy overnight schedules and multi-day records active until they end", () => {
    const legacy = data(baseTask({ scheduledDate: "2026-10-22", scheduledStart: "23:00", scheduledEnd: "01:00" }));
    const now = new Date(2026, 9, 23, 0, 30).toISOString();
    expect(reconcileOverdueTasks(legacy, "2026-10-23", now).changed).toBe(false);
    const multipleDays = data(baseTask({ timelineRecords: [{ id: "trip", taskId: "task-1", scheduledDate: "2026-10-22",
      scheduledStart: "09:00", scheduledEnd: "18:00", scheduledEndDate: "2026-10-24", executionStatus: "scheduled", createdAt: "now" }] }));
    expect(reconcileOverdueTasks(multipleDays, "2026-10-23", now).changed).toBe(false);
    const implicitEnd = data(baseTask({ timelineRecords: [{ id: "overnight", taskId: "task-1", scheduledDate: "2026-10-22",
      scheduledStart: "23:00", scheduledEnd: "01:00", executionStatus: "scheduled", createdAt: "now" }] }));
    expect(reconcileOverdueTasks(implicitEnd, "2026-10-23", now).changed).toBe(false);
  });

  it("leaves an unscheduled Planning task without a manual due date alone", () => {
    const result = reconcileOverdueTasks(data(baseTask({ dueDate: "2026-09-01", dueDateSource: "automatic" })), "2026-09-07", "now");
    expect(result.changed).toBe(false);
    expect(result.data.tasks[0].plannedForDate).toBeUndefined();
  });

  it("returns a manually overdue task to today", () => {
    const result = reconcileOverdueTasks(data(baseTask({ dueDate: "2026-09-01", dueDateSource: "manual" })), "2026-09-07", "now");
    expect(result.data.tasks[0]).toMatchObject({ plannedForDate: "2026-09-07", executionLane: "candidate" });
    expect(result.overdueReturnedCount).toBe(1);
  });

  it("keeps yesterday's block and marks it unfinished while returning its task to candidates", () => {
    const task = baseTask({ timelineRecords: [{ id: "record-1", taskId: "task-1", scheduledDate: "2026-09-06", scheduledStart: "09:00", scheduledEnd: "10:00", executionStatus: "scheduled", createdAt: "now" }] });
    const result = reconcileOverdueTasks(data(task), "2026-09-07", "now");
    expect(result.data.tasks[0]).toMatchObject({ plannedForDate: "2026-09-07", executionLane: "candidate" });
    expect(result.data.tasks[0].timelineRecords?.[0].executionStatus).toBe("returned_unfinished");
  });
});
