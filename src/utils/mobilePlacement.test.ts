import { describe, expect, it } from "vitest";
import type { Task, TimelineRecord } from "../types";
import { applyMobilePlacement, mobilePlacementVersion } from "./mobilePlacement";
import { calculateTimelineRecordEnd } from "./timelineRecords";

const date = "2026-10-22";
const stamp = `${date}T08:00:00Z`;
const record = (id: string, status: TimelineRecord["executionStatus"] = "scheduled"): TimelineRecord => ({ id, taskId: "t", scheduledDate: date, scheduledStart: "23:30", ...calculateTimelineRecordEnd(date, "23:30", 60), executionStatus: status, engagement: 70, createdAt: stamp });
const task = (records: TimelineRecord[]): Task => ({ id: "t", title: "Task", category: "personal", priority: null, notes: "", dueDate: "", goalId: "", completed: false, createdAt: stamp, updatedAt: stamp, timelineRecords: records });

describe("mobile placement", () => {
  it("appends a cross-midnight execution without losing scheduled, unfinished or completed history", () => {
    const existing = [record("scheduled"), record("unfinished", "returned_unfinished"), record("completed", "completed")];
    const original = task(existing);
    const next = applyMobilePlacement(original, record("new"));
    expect(next.timelineRecords?.slice(0, 3)).toEqual(existing);
    expect(next.timelineRecords?.[3].scheduledEndDate).toBe("2026-10-23");
    expect(original.timelineRecords).toHaveLength(3);
  });
  it("moves only an explicit execution, preserving its status and engagement", () => {
    const original = task([record("r", "returned_unfinished"), record("other")]);
    const incoming = { ...record("new"), scheduledDate: "2026-10-24", ...calculateTimelineRecordEnd("2026-10-24", "23:30", 60) };
    const next = applyMobilePlacement(original, incoming, "r");
    expect(next.timelineRecords?.[0]).toMatchObject({ id: "r", scheduledDate: "2026-10-24", executionStatus: "returned_unfinished", engagement: 70 });
    expect(next.timelineRecords?.[1]).toEqual(original.timelineRecords?.[1]);
    expect(() => applyMobilePlacement(original, incoming, "missing")).toThrow();
  });
  it("invalidates scheduling changes while allowing unrelated note edits", () => {
    const original = task([record("r")]);
    expect(mobilePlacementVersion({ ...original, notes: "later note" })).toBe(mobilePlacementVersion(original));
    expect(mobilePlacementVersion({ ...original, estimatedHours: 2 })).not.toBe(mobilePlacementVersion(original));
    expect(mobilePlacementVersion({ ...original, plannedForDate: "2026-10-25" })).not.toBe(mobilePlacementVersion(original));
    expect(mobilePlacementVersion({ ...original, completed: true })).not.toBe(mobilePlacementVersion(original));
  });
});
