import { describe, expect, it } from "vitest";
import type { Task, TimelineRecord } from "../types";
import { expandTaskAllDayRecords, expandTaskTimelineSlices } from "./taskTimelineSlices";
import { buildMonthTaskBuckets, moveMonthTask } from "./monthTasks";

const now = "2026-10-09T06:00:00.000Z";
const record: TimelineRecord = { id: "r1", taskId: "t1", scheduledDate: "2026-10-09", scheduledStart: "23:30",
  scheduledEndDate: "2026-10-10", scheduledEnd: "01:00", executionStatus: "scheduled", createdAt: now };
const task: Task = { id: "t1", title: "Revision", dueDate: "2026-10-31", category: "exam", priority: "medium",
  notes: "Private notes", goalId: "", completed: false, estimatedHours: 1.5, createdAt: now, updatedAt: now,
  timelineRecords: [record, { ...record, id: "r2", scheduledDate: "2026-10-12", scheduledEndDate: "2026-10-13" }] };
const dates = ["2026-10-09", "2026-10-10", "2026-10-12", "2026-10-13", "2026-10-15", "2026-10-16"];

describe("month schedules", () => {
  it("shows every execution and midnight slice once without a duplicate deadline entry", () => {
    const expanded = expandTaskTimelineSlices([task], dates);
    const buckets = buildMonthTaskBuckets([task], expanded.tasks, new Set([...dates, task.dueDate]));
    expect([...buckets.keys()]).toEqual(["2026-10-09", "2026-10-10", "2026-10-12", "2026-10-13"]);
    expect([...buckets.values()].flat()).toHaveLength(4);
    expect(buckets.get("2026-10-09")![0].scheduledStart).toBe("23:30");
  });

  it("omits cancelled executions and preserves planned candidates and all-day records", () => {
    const cancelled = { ...task, timelineRecords: [{ ...record, executionStatus: "cancelled" as const }] };
    const allDay = { ...task, id: "all-day", timelineRecords: [{ ...record, id: "all", taskId: "all-day", scheduledStart: "", scheduledEnd: "" }] };
    const candidate = { ...task, id: "candidate", timelineRecords: [], plannedForDate: "2026-10-09" };
    const list = [cancelled, allDay, candidate];
    const buckets = buildMonthTaskBuckets(list, [...expandTaskTimelineSlices(list, dates).tasks, ...expandTaskAllDayRecords(list, dates)], new Set(dates));
    expect(buckets.get("2026-10-09")!.map((item) => item.id).sort()).toEqual(["all", "candidate"]);
  });

  it("moves one record, preserves its overnight duration and keeps other records and deadlines intact", () => {
    const expanded = expandTaskTimelineSlices([task], dates);
    const display = expanded.tasks[0];
    const moved = moveMonthTask(task, display, "2026-10-15", "r1", now);
    expect(moved.timelineRecords![0]).toMatchObject({ scheduledDate: "2026-10-15", scheduledStart: "23:30", scheduledEndDate: "2026-10-16", scheduledEnd: "01:00" });
    expect(moved.timelineRecords![1]).toBe(task.timelineRecords![1]);
    expect(moved.dueDate).toBe(task.dueDate);
    expect(moved.notes).toBe(task.notes);
    const buckets = buildMonthTaskBuckets([moved], expandTaskTimelineSlices([moved], dates).tasks, new Set(dates));
    expect(buckets.has("2026-10-09")).toBe(false);
    expect(buckets.get("2026-10-15")).toHaveLength(1);
  });

  it("shifts a continuation slice by the same day offset as its owning record", () => {
    const display = expandTaskTimelineSlices([task], dates).tasks[1];
    const moved = moveMonthTask(task, display, "2026-10-16", "r1", now);
    expect(moved.timelineRecords![0].scheduledDate).toBe("2026-10-15");
    expect(moved.timelineRecords![0].scheduledEndDate).toBe("2026-10-16");
    expect(moveMonthTask(task, display, display.scheduledDate!, "r1", now)).toBe(task);
  });

  it("creates an all-day schedule for a candidate without changing its deadline", () => {
    const candidate = { ...task, timelineRecords: [], plannedForDate: "2026-10-09", executionLane: "candidate" as const };
    expect(moveMonthTask(candidate, candidate, "2026-10-15", candidate.id, now)).toMatchObject({ scheduledDate: "2026-10-15", plannedForDate: "2026-10-15", dueDate: task.dueDate, executionLane: undefined });
    expect(moveMonthTask(candidate, candidate, "2026-10-09", candidate.id, now).scheduledDate).toBe("2026-10-09");
  });

  it("keeps all-day records untimed and retains their completion status", () => {
    const allDay = { ...task, timelineRecords: [{ ...record, scheduledStart: "", scheduledEnd: "", scheduledEndDate: undefined, executionStatus: "completed" as const }] };
    const display = expandTaskAllDayRecords([allDay], dates)[0];
    expect(moveMonthTask(allDay, display, "2026-10-15", record.id, now).timelineRecords![0]).toMatchObject({
      scheduledDate: "2026-10-15", scheduledStart: "", scheduledEnd: "", executionStatus: "completed",
    });
  });

  it("shows a newly planned candidate alongside its historical executions", () => {
    const candidate = { ...task, plannedForDate: "2026-10-15", executionLane: "candidate" as const };
    const buckets = buildMonthTaskBuckets([candidate], expandTaskTimelineSlices([candidate], dates).tasks, new Set(dates));
    expect(buckets.get("2026-10-15")?.map((item) => item.id)).toEqual([task.id]);
    expect(buckets.get("2026-10-09")).toHaveLength(1);
    const moved = moveMonthTask(candidate, candidate, "2026-10-16", candidate.id, now);
    expect(moved.timelineRecords).toHaveLength(3);
    expect(moved.timelineRecords!.slice(0, 2)).toEqual(task.timelineRecords);
    expect(expandTaskAllDayRecords([moved], dates)).toMatchObject([{ scheduledDate: "2026-10-16" }]);
  });

  it("moves a recurring occurrence without shifting the recurrence rule", () => {
    const recurring = { ...task, timelineRecords: [], recurrence: { enabled: true, mode: "scheduled" as const, frequency: "daily" as const,
      interval: 1, startDate: "2026-10-09", startTime: "09:00", durationMinutes: 60 } };
    const display = { ...recurring, id: "occ_t1_2026-10-09", scheduledDate: "2026-10-09", scheduledStart: "09:00" };
    const moved = moveMonthTask(recurring, display, "2026-10-15", display.id, now);
    expect(moved.recurrence).toBe(recurring.recurrence);
    expect(moved.timelineRecords).toMatchObject([
      { scheduledDate: "2026-10-09", executionStatus: "cancelled" },
      { scheduledDate: "2026-10-15", scheduledStart: "09:00", scheduledEnd: "10:00", executionStatus: "scheduled" },
    ]);
  });
});
