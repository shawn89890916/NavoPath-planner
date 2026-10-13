import { describe, expect, it } from "vitest";
import type { PlannerData, Task, TimelineRecord } from "../types";
import { normalizeData } from "../browserFallback";
import { normalizeHabits, scheduleHabitRecord, toggleHabitCompletion } from "./habits";
import { expandTaskTimelineSlices } from "./taskTimelineSlices";
import { setTaskCompletion, toggleTaskCompletion } from "./taskCompletion";

const date = "2026-10-13";
const stamp = `${date}T08:00:00.000Z`;
const record = (id: string, executionStatus: TimelineRecord["executionStatus"] = "scheduled"): TimelineRecord => ({
  id, taskId: "task", scheduledDate: date, scheduledStart: "09:00", scheduledEnd: "10:00", executionStatus, createdAt: stamp,
});
const task = (patch: Partial<Task> = {}): Task => ({
  id: "task", title: "Task", category: "personal", priority: null, notes: "", dueDate: "", goalId: "", completed: false, createdAt: stamp, updatedAt: stamp, ...patch,
});
const data = (tasks: Task[] = []): PlannerData => ({
  version: 2, importedSeedVersion: "test", generatedAt: stamp, goals: [], projects: [], tasks, longTasks: [], events: [], notes: [], drafts: [], chat: [], aiMemories: [],
});

describe("atomic task completion", () => {
  it("finishes a parent only when all active executions are complete, and reopens it", () => {
    const initial = data([task({ timelineRecords: [record("r1"), record("r2"), record("cancelled", "cancelled")] })]);
    const first = toggleTaskCompletion(initial, "r1", stamp);
    expect(first.tasks[0].completed).toBe(false);
    expect(expandTaskTimelineSlices(first.tasks, [date]).tasks.map((item) => item.completed)).toEqual([true, false]);
    const second = normalizeData(toggleTaskCompletion(first, "r2", stamp));
    expect(second.tasks[0].completed).toBe(true);
    const reopened = toggleTaskCompletion(second, "r1", stamp);
    expect(reopened.tasks[0].completed).toBe(false);
    expect(reopened.tasks[0].timelineRecords?.map((item) => item.executionStatus)).toEqual(["scheduled", "completed", "cancelled"]);
    expect(initial.tasks[0].timelineRecords?.[0].executionStatus).toBe("scheduled");
  });

  it("updates records when completion is explicitly changed in the task editor", () => {
    const initial = data([task({ timelineRecords: [record("r1"), record("r2")] })]);
    const completed = setTaskCompletion(initial, "task", true, stamp);
    expect(completed.tasks[0].timelineRecords?.every((item) => item.executionStatus === "completed")).toBe(true);
    expect(setTaskCompletion(completed, "task", false, stamp).tasks[0].timelineRecords?.every((item) => item.executionStatus === "scheduled")).toBe(true);
  });

  it("keeps a recurring task open after an individual occurrence finishes", () => {
    const initial = data([task({ recurrence: { mode: "scheduled", frequency: "daily", startDate: date, startTime: "09:00", durationMinutes: 60 }, timelineRecords: [record("r1")] })]);
    const completed = toggleTaskCompletion(initial, "r1", stamp);
    expect(completed.tasks[0].completed).toBe(false);
    expect(completed.tasks[0].timelineRecords?.[0].executionStatus).toBe("completed");
  });

  it("keeps skipped and returned history intact without blocking a later successful execution", () => {
    const initial = data([task({ timelineRecords: [record("returned", "returned_unfinished"), record("skipped", "skipped"), record("next")] })]);
    const completed = toggleTaskCompletion(initial, "next", stamp);
    expect(completed.tasks[0].completed).toBe(true);
    const reopened = setTaskCompletion(completed, "task", false, stamp);
    expect(reopened.tasks[0].timelineRecords?.map((item) => item.executionStatus)).toEqual(["returned_unfinished", "skipped", "scheduled"]);
  });

  it("synchronizes habit list, timeline, editor, reversal, and saved data without changing another day", () => {
    const initial = data();
    const habits = normalizeHabits({ ...initial, pluginConfigs: { "habit-tracker": { habits: "Read" } } }, stamp);
    const habitId = habits.habits![0].id;
    const first = scheduleHabitRecord({ ...initial, ...habits }, habitId, date, "09:00", stamp);
    const tomorrow = scheduleHabitRecord(first.data, habitId, "2026-10-14", "10:00", stamp);
    const completed = normalizeData(toggleTaskCompletion(tomorrow.data, first.recordId, stamp));
    expect(completed.habitDailyStates?.find((state) => state.date === date)?.completed).toBe(true);
    expect(completed.habitDailyStates?.find((state) => state.date === "2026-10-14")?.completed).toBe(false);
    const reopened = toggleHabitCompletion(completed, habitId, date, false, stamp);
    expect(reopened.tasks.find((item) => item.timelineRecords?.some((r) => r.id === first.recordId))?.completed).toBe(false);
    expect(reopened.tasks.flatMap((item) => item.timelineRecords || []).find((item) => item.id === first.recordId)?.executionStatus).toBe("scheduled");
    const editor = setTaskCompletion(reopened, `habit-task-${habitId}-${date}`, true, stamp);
    expect(editor.habitDailyStates?.find((state) => state.date === date)?.completed).toBe(true);
  });

  it("ignores missing and cancelled records", () => {
    const initial = data([task({ timelineRecords: [record("cancelled", "cancelled")] })]);
    expect(toggleTaskCompletion(initial, "missing", stamp)).toBe(initial);
    expect(toggleTaskCompletion(initial, "cancelled", stamp)).toBe(initial);
  });
});
