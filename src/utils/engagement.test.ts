import { describe, expect, it } from "vitest";
import { engagementFor, engagementMinutes, engagementPatch, normalizeEngagement } from "./engagement";
import { fallbackData, normalizeData } from "../browserFallback";
import { getDefaultSettings, normalizeSettings } from "../defaultSettings";
import { expandTaskTimelineSlices } from "./taskTimelineSlices";
import { taskBlockStyle } from "../components/TaskBlock";
import type { Task } from "../types";

const task: Task = {
  id: "work", title: "Work", dueDate: "2026-10-09", category: "personal", priority: null,
  notes: "", goalId: "", completed: false, createdAt: "2026-10-09T00:00:00Z", updatedAt: "2026-10-09T00:00:00Z",
  engagement: 20,
  timelineRecords: [
    { id: "first", taskId: "work", scheduledDate: "2026-10-09", scheduledStart: "23:00", scheduledEndDate: "2026-10-10", scheduledEnd: "01:00", executionStatus: "completed", engagement: 50, createdAt: "now" },
    { id: "second", taskId: "work", scheduledDate: "2026-10-10", scheduledStart: "09:00", scheduledEnd: "10:00", executionStatus: "scheduled", createdAt: "now" },
  ],
};

describe("engagement ratings", () => {
  it("is opt-in for new, existing, malformed, and reset settings", () => {
    expect(getDefaultSettings().featureEngagementEnabled).toBe(false);
    expect(normalizeSettings({}).featureEngagementEnabled).toBe(false);
    expect(normalizeSettings({ featureEngagementEnabled: "true" }).featureEngagementEnabled).toBe(false);
    expect(normalizeSettings({ featureEngagementEnabled: true }).featureEngagementEnabled).toBe(true);
  });

  it("defaults to 80 and snaps all ratings to the ten allowed values", () => {
    expect(normalizeEngagement(undefined)).toBe(80);
    expect(normalizeEngagement(NaN)).toBe(80);
    expect(normalizeEngagement(-10)).toBe(10);
    expect(normalizeEngagement(9)).toBe(10);
    expect(normalizeEngagement(120)).toBe(100);
    expect(Array.from({ length: 101 }, (_, value) => normalizeEngagement(value)).every(value => value >= 10 && value <= 100 && value % 10 === 0)).toBe(true);
    expect(normalizeEngagement(34)).toBe(30);
    expect(normalizeEngagement(35)).toBe(40);
    expect(engagementMinutes(15, 33)).toBe(4.5);
    expect(engagementMinutes(60, 0)).toBe(6);
  });

  it("isolates records, keeps their default independent of task scores, and survives saved-data normalization", () => {
    const [first, second] = task.timelineRecords!;
    const updated = { ...task, ...engagementPatch(task, 0, first) };
    expect(engagementFor(updated, updated.timelineRecords![0])).toBe(10);
    expect(engagementFor(updated, second)).toBe(80);
    const saved = normalizeData({ ...fallbackData(), tasks: [updated] });
    expect(saved.tasks[0].timelineRecords![0].engagement).toBe(10);
    expect(saved.tasks[0].engagement).toBe(20);
    const invalid = normalizeData({ ...fallbackData(), tasks: [{ ...task, engagement: 200, timelineRecords: [{ ...first, engagement: -1 }] }] });
    expect(invalid.tasks[0].engagement).toBe(100);
    expect(invalid.tasks[0].timelineRecords![0].engagement).toBe(10);
  });

  it("carries record completion and score to both midnight slices while preserving the next execution", () => {
    const expanded = expandTaskTimelineSlices([task], ["2026-10-09", "2026-10-10"]).tasks;
    expect(expanded.filter(item => item.id.startsWith("first")).map(item => [item.completed, item.engagement])).toEqual([[true, 50], [true, 50]]);
    expect(expanded.find(item => item.id === "second")?.completed).toBe(false);
    expect(expanded.find(item => item.id === "second")?.engagement).toBeUndefined();
  });

  it("changes only background alpha, preserving the project marker and block geometry", () => {
    expect(taskBlockStyle({ projectColor: "#7EA172" }).opacity).toBeUndefined();
    const style = taskBlockStyle({ engagement: 10, projectColor: "#7EA172", style: { height: 80 } });
    expect(style).toMatchObject({ height: 80, "--task-project-color": "#7EA172", "--task-engagement": "10%", backgroundColor: "color-mix(in srgb, var(--task-bg) 10%, transparent)" });
    expect(style.opacity).toBeUndefined();
    expect(taskBlockStyle({ engagement: 80 }).backgroundColor).toBe("color-mix(in srgb, var(--task-bg) 80%, transparent)");
    expect(taskBlockStyle({ engagement: 100 }).backgroundColor).toBe("color-mix(in srgb, var(--task-bg) 100%, transparent)");
  });
});
