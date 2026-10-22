import { describe, expect, it, vi } from "vitest";
import { autoScheduleTasks, getFreeSlots } from "./autoSchedule";
import { expandTaskTimelineSlices } from "./utils/taskTimelineSlices";
import type { Task } from "./types";

const future = "2099-01-05";

function task(id: string, projectId: string, estimatedMinutes = 45) {
  return { id, title: id, projectId, priority: "medium" as const, estimatedMinutes };
}

describe("autoScheduleTasks", () => {
  it("keeps the midnight-ending timeline slice occupied", () => {
    const overnight: Task = { ...task("overnight", "study"), dueDate: "", category: "personal", notes: "", goalId: "",
      completed: false, createdAt: "now", updatedAt: "now", timelineRecords: [{
      id: "overnight-record", taskId: "overnight", scheduledDate: future, scheduledStart: "21:00",
      scheduledEndDate: "2099-01-06", scheduledEnd: "01:00", executionStatus: "scheduled", createdAt: "now",
    }] };
    const scheduledEvents = expandTaskTimelineSlices([overnight], [future, "2099-01-06"]).tasks;
    const settings = { dayStart: "20:00", dayEnd: "23:59", bufferMinutes: 0, allowTaskSplitting: false };
    expect(getFreeSlots({ dateRange: [future], scheduledEvents, settings })).toEqual([
      { date: future, startMinutes: 1200, endMinutes: 1260 },
    ]);
    const result = autoScheduleTasks({ tasks: [task("candidate", "study", 120)], scheduledEvents, dateRange: [future], settings });
    expect(result.proposedEvents).toEqual([]);
    expect(result.unscheduledTasks).toHaveLength(1);
    expect(getFreeSlots({ dateRange: ["2099-01-06"], scheduledEvents,
      settings: { ...settings, dayStart: "00:00", dayEnd: "02:00" } })).toEqual([
      { date: "2099-01-06", startMinutes: 60, endMinutes: 120 },
    ]);
  });

  it("projects raw overnight and multi-day events into every planning day with buffers", () => {
    const scheduledEvents = [{ id: "event", title: "Overnight", scheduledDate: future, scheduledStart: "21:00", scheduledEnd: "01:00" }];
    expect(getFreeSlots({ dateRange: ["2099-01-06"], scheduledEvents,
      settings: { dayStart: "00:00", dayEnd: "02:00", bufferMinutes: 5 } })).toEqual([
      { date: "2099-01-06", startMinutes: 75, endMinutes: 120 },
    ]);
    expect(getFreeSlots({ dateRange: ["2099-01-06"],
      scheduledEvents: [{ ...scheduledEvents[0], scheduledEndDate: "2099-01-07" }],
      settings: { dayStart: "08:00", dayEnd: "22:00", bufferMinutes: 0 } })).toEqual([]);
  });

  it("uses the first grid slot at least five minutes after the current time", () => {
    vi.useFakeTimers();
    try {
      const now = new Date(2026, 6, 28, 12, 1);
      vi.setSystemTime(now);
      const date = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, "0"),
        String(now.getDate()).padStart(2, "0"),
      ].join("-");

      expect(getFreeSlots({
        dateRange: [date],
        scheduledEvents: [],
        settings: {
          dayStart: "08:00",
          dayEnd: "13:00",
          snapMinutes: 15,
          bufferMinutes: 0,
        },
      })[0]).toMatchObject({
        date,
        startMinutes: 12 * 60 + 15,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("treats the local calendar date as today across a UTC day boundary", () => {
    const originalTimeZone = process.env.TZ;
    process.env.TZ = "Asia/Shanghai";
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-07-28T16:30:00.000Z"));

      expect(getFreeSlots({
        dateRange: ["2026-07-29"],
        scheduledEvents: [],
        settings: {
          dayStart: "00:00",
          dayEnd: "02:00",
          snapMinutes: 15,
          bufferMinutes: 0,
        },
      })[0]).toMatchObject({
        date: "2026-07-29",
        startMinutes: 45,
      });

      expect(autoScheduleTasks({
        tasks: [task("local-today", "study", 15)],
        scheduledEvents: [],
        settings: {
          dayStart: "00:00",
          dayEnd: "02:00",
          snapMinutes: 15,
          bufferMinutes: 0,
          allowTaskSplitting: false,
        },
      }).proposedEvents[0]).toMatchObject({
        scheduledDate: "2026-07-29",
        scheduledStart: "00:45",
      });
    } finally {
      vi.useRealTimers();
      if (originalTimeZone === undefined) delete process.env.TZ;
      else process.env.TZ = originalTimeZone;
    }
  });

  it("keeps fixed events as anchors and stays inside the work window", () => {
    const result = autoScheduleTasks({
      tasks: [task("prepare", "study", 60)],
      scheduledEvents: [{ id: "class", title: "Class", date: future, startTime: "09:00", endTime: "10:00" }],
      dateRange: [future],
      settings: { dayStart: "08:00", dayEnd: "12:00", bufferMinutes: 0, allowTaskSplitting: false },
    });
    const proposed = result.proposedEvents[0];
    expect(proposed).toBeDefined();
    expect(proposed.scheduledStart >= "08:00").toBe(true);
    expect(proposed.scheduledEnd <= "12:00").toBe(true);
    expect(proposed.scheduledEnd <= "09:00" || proposed.scheduledStart >= "10:00").toBe(true);
  });

  it("allows a task to end exactly at the planning boundary", () => {
    const result = autoScheduleTasks({
      tasks: [task("exact-fit", "study", 60)],
      scheduledEvents: [],
      dateRange: [future],
      settings: { dayStart: "08:00", dayEnd: "09:00", bufferMinutes: 5, allowTaskSplitting: false },
    });

    expect(result.proposedEvents).toHaveLength(1);
    expect(result.proposedEvents[0]).toMatchObject({
      scheduledStart: "08:00",
      scheduledEnd: "09:00",
    });
    expect(result.unscheduledTasks).toEqual([]);
  });

  it("still keeps the configured buffer between consecutive tasks", () => {
    const result = autoScheduleTasks({
      tasks: [task("first", "study", 55), task("second", "study", 55)],
      scheduledEvents: [],
      dateRange: [future],
      settings: { dayStart: "08:00", dayEnd: "10:00", bufferMinutes: 5, allowTaskSplitting: false },
    });

    expect(result.proposedEvents.map(({ scheduledStart, scheduledEnd }) => ({ scheduledStart, scheduledEnd }))).toEqual([
      { scheduledStart: "08:00", scheduledEnd: "08:55" },
      { scheduledStart: "09:00", scheduledEnd: "09:55" },
    ]);
  });

  it("snaps the next task to the grid after a non-grid buffer", () => {
    const result = autoScheduleTasks({
      tasks: [task("first", "study", 60), task("second", "study", 60)],
      scheduledEvents: [],
      dateRange: [future],
      settings: {
        dayStart: "08:00",
        dayEnd: "11:00",
        snapMinutes: 15,
        bufferMinutes: 5,
        allowTaskSplitting: false,
      },
    });

    expect(result.proposedEvents.map(({ scheduledStart, scheduledEnd }) => ({ scheduledStart, scheduledEnd }))).toEqual([
      { scheduledStart: "08:00", scheduledEnd: "09:00" },
      { scheduledStart: "09:15", scheduledEnd: "10:15" },
    ]);
  });

  it("places project work at its learned preferred start hour", () => {
    const result = autoScheduleTasks({
      tasks: [task("preferred", "study", 60)],
      scheduledEvents: [],
      dateRange: [future],
      settings: {
        dayStart: "08:00",
        dayEnd: "17:00",
        bufferMinutes: 5,
        preferredStartHourByProject: { study: 14.1 },
        allowTaskSplitting: false,
      },
    });

    expect(result.proposedEvents[0]).toMatchObject({
      scheduledStart: "14:00",
      scheduledEnd: "15:00",
    });
  });

  it("preserves free time before a preferred-hour placement", () => {
    const result = autoScheduleTasks({
      tasks: [
        { ...task("preferred", "study", 60), priority: "high" as const },
        task("earlier", "study", 180),
      ],
      scheduledEvents: [],
      dateRange: [future],
      settings: {
        dayStart: "08:00",
        dayEnd: "17:00",
        bufferMinutes: 15,
        strategy: "byProject",
        preferredStartHourByProject: { study: 14 },
        allowTaskSplitting: false,
      },
    });

    expect(result.proposedEvents.map(({ taskId, scheduledStart, scheduledEnd }) => ({
      taskId,
      scheduledStart,
      scheduledEnd,
    }))).toEqual([
      { taskId: "earlier", scheduledStart: "10:45", scheduledEnd: "13:45" },
      { taskId: "preferred", scheduledStart: "14:00", scheduledEnd: "15:00" },
    ]);
  });

  it("honors the selected ordering strategy", () => {
    const tasks = [task("p1-a", "p1"), task("p2-a", "p2"), task("p1-b", "p1")];
    const common = { tasks, scheduledEvents: [], dateRange: [future], settings: { dayStart: "08:00", dayEnd: "13:00", bufferMinutes: 0 } };
    const grouped = autoScheduleTasks({ ...common, settings: { ...common.settings, strategy: "byProject" } });
    const alternating = autoScheduleTasks({ ...common, settings: { ...common.settings, strategy: "alternativeProject" } });
    expect(grouped.proposedEvents.map((event) => event.taskId)).toEqual(["p1-a", "p1-b", "p2-a"]);
    expect(alternating.proposedEvents.map((event) => event.taskId)).toEqual(["p1-a", "p2-a", "p1-b"]);
  });

  it("offers reviewable segments while preserving total duration", () => {
    const result = autoScheduleTasks({
      tasks: [task("long", "study", 150)],
      scheduledEvents: [
        { id: "anchor-1", title: "Anchor", date: future, startTime: "09:00", endTime: "10:00" },
        { id: "anchor-2", title: "Anchor", date: future, startTime: "11:00", endTime: "12:00" },
      ],
      dateRange: [future],
      settings: { dayStart: "08:00", dayEnd: "13:00", bufferMinutes: 0, allowTaskSplitting: true },
    });
    expect(result.proposedEvents.length).toBeGreaterThan(1);
    expect(result.proposedEvents.reduce((sum, event) => sum + event.durationMinutes, 0)).toBe(150);
    expect(result.proposedEvents.every((event) => event.segmentCount === result.proposedEvents.length)).toBe(true);
  });

  it("uses the full end-of-day capacity when splitting across dates", () => {
    const result = autoScheduleTasks({
      tasks: [task("two-day", "study", 120)],
      scheduledEvents: [],
      dateRange: [future, "2099-01-06"],
      settings: { dayStart: "08:00", dayEnd: "09:00", bufferMinutes: 5, allowTaskSplitting: true },
    });

    expect(result.proposedEvents.map(({ scheduledDate, scheduledStart, scheduledEnd, durationMinutes }) => ({
      scheduledDate,
      scheduledStart,
      scheduledEnd,
      durationMinutes,
    }))).toEqual([
      { scheduledDate: future, scheduledStart: "08:00", scheduledEnd: "09:00", durationMinutes: 60 },
      { scheduledDate: "2099-01-06", scheduledStart: "08:00", scheduledEnd: "09:00", durationMinutes: 60 },
    ]);
    expect(result.unscheduledTasks).toEqual([]);
  });

  it("does not mutate source tasks during preview generation", () => {
    const tasks = [task("safe", "study")];
    const before = structuredClone(tasks);
    autoScheduleTasks({ tasks, scheduledEvents: [], dateRange: [future] });
    expect(tasks).toEqual(before);
  });
});
