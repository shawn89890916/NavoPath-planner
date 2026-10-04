import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createDemoData,
  DEMO_DATE,
  firstDemoSlot,
  rescheduleDemoTomorrow,
  scheduleDemoTask,
} from "./productDemoData";
import { toggleTodayCandidate } from "./utils/todayCandidates";

afterEach(() => vi.useRealTimers());

describe("isolated product examples", () => {
  it("creates independent data for every visit and language", () => {
    const first = createDemoData("zh", "planning", 0);
    first.tasks[0].title = "Changed";
    expect(createDemoData("zh", "planning", 0).tasks[0].title).toBe(
      "撰写个人介绍",
    );
    expect(createDemoData("en", "planning", 0).tasks[0].title).toBe(
      "Write your introduction",
    );
  });

  it("uses the product candidate transition to add and remove a task", () => {
    const initial = createDemoData("zh", "planning", 0);
    const added = toggleTodayCandidate(initial, "content", DEMO_DATE).data;
    expect(added.tasks[0].plannedForDate).toBe(DEMO_DATE);
    expect(added.tasks[0].executionLane).toBe("candidate");
    expect(
      toggleTodayCandidate(added, "content", DEMO_DATE).data.tasks[0]
        .plannedForDate,
    ).toBeUndefined();
    expect(initial.tasks[0].plannedForDate).toBeUndefined();
  });

  it("shows a fuller example day using ordinary, non-overlapping task records", () => {
    for (const lang of ["zh", "en"] as const) {
      const data = createDemoData(lang, "execute", 2);
      expect(data.events).toEqual([]);
      expect(data.tasks.some(task => task.id.startsWith("event_occ_"))).toBe(false);
      const records = data.tasks.flatMap(task => task.timelineRecords || [])
        .sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart));
      expect(records).toHaveLength(9);
      for (let index = 1; index < records.length; index++) {
        expect(records[index - 1].scheduledEnd <= records[index].scheduledStart).toBe(true);
      }
      expect(data.tasks.filter(task => task.executionLane === "candidate" && !task.scheduledStart)).toHaveLength(3);
    }
  });

  it("rejects conflicts and times outside the fifteen minute grid without mutating state", () => {
    const initial = createDemoData("en", "execute", 0);
    for (const time of ["09:00", "09:15", "09:31", "07:45", "18:00", "25:00"]) {
      expect(scheduleDemoTask(initial, "content", DEMO_DATE, time)).toBe(
        initial,
      );
    }
    expect(scheduleDemoTask(initial, "content", DEMO_DATE, "09:30", 20)).toBe(
      initial,
    );
    expect(scheduleDemoTask(initial, "content", DEMO_DATE, "09:30", 0)).toBe(
      initial,
    );
  });

  it("accepts adjacent blocks and preserves the same timeline record when rescheduling", () => {
    const initial = createDemoData("en", "execute", 0);
    const scheduled = scheduleDemoTask(initial, "content", DEMO_DATE, "09:30");
    const record = scheduled.tasks[0].timelineRecords![0];
    expect(record.scheduledEnd).toBe("10:15");
    const moved = scheduleDemoTask(
      scheduled,
      "content",
      DEMO_DATE,
      "10:30",
      60,
    );
    expect(moved.tasks[0].timelineRecords![0]).toMatchObject({
      id: record.id,
      scheduledStart: "10:30",
      scheduledEnd: "11:30",
    });
    expect(scheduled.tasks[0].scheduledStart).toBe("09:30");
    expect(initial.tasks[0].timelineRecords).toBeUndefined();
  });

  it("finds a real free slot tomorrow and clears completed status", () => {
    const initial = createDemoData("en", "execute", 3);
    const moved = rescheduleDemoTomorrow(initial, "content");
    expect(moved.tasks[0]).toMatchObject({
      scheduledDate: "2030-10-08",
      scheduledStart: "09:00",
      completed: false,
      executionStatus: "scheduled",
    });
    expect(moved.tasks[0].timelineRecords![0].executionStatus).toBe(
      "scheduled",
    );
    expect(initial.tasks[0].completed).toBe(true);
  });

  it("keeps sample scheduling stable even when the real date reaches the sample day", () => {
    vi.useFakeTimers();
    const initial = createDemoData("en", "execute", 0);
    for (const date of ["2030-10-07T17:50:00", "2050-10-07T17:50:00"]) {
      vi.setSystemTime(new Date(date));
      expect(firstDemoSlot(initial, "content")).toBe("09:30");
    }
  });
});
