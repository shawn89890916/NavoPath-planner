import { describe, expect, it } from "vitest";
import type { PlannerData } from "../types";
import { normalizePlannerDataForClient } from "./dataNormalization";
import { normalizeHabits, scheduleHabitRecord } from "./habits";
import { fallbackData, normalizeData } from "../browserFallback";

describe("data normalization", () => {
  it("repairs old habit titles on reload and retains saved project assignments", () => {
    const initial = fallbackData();
    const data = { ...initial, ...normalizeHabits(initial) };
    const habitId = data.habits![0].id;
    const scheduled = scheduleHabitRecord(data, habitId, "2026-11-02", "09:00").data;
    const saved = {
      ...scheduled,
      habits: scheduled.habits!.map((habit) => habit.id === habitId ? { ...habit, title: "Renamed habit", projectId: "project-study" } : habit),
    };
    const normalized = normalizeData(JSON.parse(JSON.stringify(saved)));
    const task = normalized.tasks.find((item) => item.id === `habit-task-${habitId}-2026-11-02`)!;
    expect(task.title).toBe("Renamed habit");
    expect(task.timelineRecords).toEqual(scheduled.tasks[scheduled.tasks.length - 1].timelineRecords);
    expect(normalized.habits!.find((habit) => habit.id === habitId)?.projectId).toBe("project-study");
    expect(normalizeData(normalized)).toEqual(normalized);
  });

  it("keeps legacy plugin habits and backfills cross-day fields", () => {
    const legacy = {
      version: 1,
      importedSeedVersion: "",
      generatedAt: "now",
      goals: [],
      projects: [],
      tasks: [{
        id: "task-1",
        title: "Legacy",
        dueDate: "2026-07-01",
        category: "personal",
        priority: "medium",
        notes: "",
        goalId: "",
        completed: false,
        timelineRecords: [{ id: "r1", taskId: "task-1", scheduledDate: "2026-07-01", scheduledStart: "09:00", scheduledEnd: "10:00", executionStatus: "scheduled", createdAt: "now" }],
        createdAt: "now",
        updatedAt: "now",
      }],
      longTasks: [],
      events: [],
      notes: [],
      drafts: [],
      chat: [],
      aiMemories: [],
      pluginConfigs: { "habit-tracker": { habits: "Read" } },
    } as PlannerData;
    const normalized = normalizePlannerDataForClient(legacy);
    expect(normalized.tasks[0].timelineRecords?.[0].scheduledEndDate).toBe("2026-07-01");
    expect(normalized.habits?.[0].title).toBe("Read");
    expect(normalized.pluginConfigs?.["habit-tracker"]?.habits).toBe("Read");
  });
});
