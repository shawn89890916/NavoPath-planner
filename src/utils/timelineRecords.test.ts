import { describe, expect, it } from "vitest";
import type { TimelineRecord } from "../types";
import { applyScheduledTimelineRecord, calculateTimelineRecordEnd, calendarDateTimeSpanMinutes, clockTimeSpanMinutes, findScheduledTimelineRecord, focusTargetForRecord, normalizeTimelineRecord, rescheduleTimelineRecord, sliceTimelineRecord } from "./timelineRecords";

const record: TimelineRecord = {
  id: "record-1",
  taskId: "task-1",
  scheduledDate: "2026-07-01",
  scheduledStart: "23:30",
  scheduledEndDate: "2026-07-02",
  scheduledEnd: "07:30",
  executionStatus: "scheduled",
  createdAt: "2026-07-01T00:00:00.000Z",
};

describe("timelineRecords", () => {
  it("advances the end date when a scheduled duration crosses midnight", () => {
    expect(calculateTimelineRecordEnd("2026-12-31", "23:50", 20)).toEqual({
      scheduledEndDate: "2027-01-01",
      scheduledEnd: "00:10",
    });
  });

  it("measures a span across calendar dates", () => {
    expect(calendarDateTimeSpanMinutes("2026-07-01", "23:30", "2026-07-02", "00:30")).toBe(60);
    expect(calendarDateTimeSpanMinutes("2026-07-01", "23:30", "2026-07-03", "00:30")).toBe(1_500);
  });

  it("measures a clock span that crosses midnight", () => {
    expect(clockTimeSpanMinutes("09:15", "10:00")).toBe(45);
    expect(clockTimeSpanMinutes("23:30", "00:30")).toBe(60);
  });

  it("preserves duration when moving a cross-midnight record to another date", () => {
    expect(rescheduleTimelineRecord(record, "2026-07-10", "23:45")).toMatchObject({
      scheduledDate: "2026-07-10",
      scheduledStart: "23:45",
      scheduledEndDate: "2026-07-11",
      scheduledEnd: "07:45",
    });
  });

  it("recalculates the end date when changing a record duration", () => {
    expect(rescheduleTimelineRecord(record, record.scheduledDate, record.scheduledStart, 30)).toMatchObject({
      scheduledDate: "2026-07-01",
      scheduledStart: "23:30",
      scheduledEndDate: "2026-07-02",
      scheduledEnd: "00:00",
    });
  });

  it("normalizes legacy same-day records", () => {
    const legacy = { ...record, scheduledEndDate: undefined, scheduledStart: "09:00", scheduledEnd: "10:00" };
    expect(normalizeTimelineRecord(legacy).scheduledEndDate).toBe("2026-07-01");
  });

  it("infers the next day for a legacy record that crosses midnight", () => {
    const legacy = { ...record, scheduledEndDate: undefined, scheduledEnd: "00:30" };
    expect(normalizeTimelineRecord(legacy).scheduledEndDate).toBe("2026-07-02");
  });

  it("keeps a safe start-date fallback for malformed legacy bounds", () => {
    const legacy = { ...record, scheduledDate: "damaged", scheduledEndDate: undefined, scheduledStart: "", scheduledEnd: "" };
    expect(normalizeTimelineRecord(legacy).scheduledEndDate).toBe("damaged");
  });

  it("slices cross-day records into visible day pieces", () => {
    const slices = sliceTimelineRecord(record, ["2026-07-01", "2026-07-02"]);
    expect(slices).toEqual([
      { recordId: "record-1", taskId: "task-1", date: "2026-07-01", startMinutes: 1410, endMinutes: 1440, continuesBefore: false, continuesAfter: true },
      { recordId: "record-1", taskId: "task-1", date: "2026-07-02", startMinutes: 0, endMinutes: 450, continuesBefore: true, continuesAfter: false },
    ]);
  });

  it("treats the day before an exact-midnight end as the final visible slice", () => {
    const midnightEnd = { ...record, scheduledEnd: "00:00" };

    expect(sliceTimelineRecord(midnightEnd, ["2026-07-01", "2026-07-02"])).toEqual([
      { recordId: "record-1", taskId: "task-1", date: "2026-07-01", startMinutes: 1410, endMinutes: 1440, continuesBefore: false, continuesAfter: false },
    ]);
  });

  it("creates a stable focus target", () => {
    expect(focusTargetForRecord(record)).toEqual({ date: "2026-07-01", recordId: "record-1", taskId: "task-1", time: "23:30" });
  });

  it("keeps independent executions when an AI suggestion has no record target", () => {
    const second = { ...record, id: "record-2", scheduledDate: "2026-07-03", scheduledEndDate: "2026-07-04" };
    const added = rescheduleTimelineRecord({ ...record, id: "record-3" }, "2026-07-10", "23:45");
    const records = [record, second];

    expect(findScheduledTimelineRecord(records)).toBeUndefined();
    expect(applyScheduledTimelineRecord(records, added)).toEqual([record, second, added]);
    expect(records).toEqual([record, second]);
  });

  it("moves only the explicitly selected execution and keeps its identity and history", () => {
    const second = { ...record, id: "record-2" };
    const completed = { ...record, id: "completed", executionStatus: "completed" as const };
    const moved = rescheduleTimelineRecord({ ...record, id: "new-id" }, "2026-07-10", "23:45");
    const result = applyScheduledTimelineRecord([record, second, completed], moved, record.id);

    expect(result[0]).toMatchObject({ id: record.id, createdAt: record.createdAt, scheduledDate: "2026-07-10", scheduledStart: "23:45", scheduledEndDate: "2026-07-11", scheduledEnd: "07:45" });
    expect(result[1]).toBe(second);
    expect(result[2]).toBe(completed);
  });

  it("reschedules a sole pending execution without adding a duplicate", () => {
    const completed = { ...record, id: "completed", executionStatus: "completed" as const };
    const moved = rescheduleTimelineRecord({ ...record, id: "new-id" }, "2026-07-10", "10:00", 60);

    expect(findScheduledTimelineRecord([completed, record])).toBe(record);
    expect(applyScheduledTimelineRecord([completed, record], moved, record.id)).toEqual([completed, { ...record, scheduledDate: "2026-07-10", scheduledStart: "10:00", scheduledEndDate: "2026-07-10", scheduledEnd: "11:00" }]);
  });

  it("does not replace another execution when the supplied record ID is stale", () => {
    const added = { ...record, id: "new-id" };
    expect(findScheduledTimelineRecord([record], "missing-id")).toBeUndefined();
    expect(applyScheduledTimelineRecord([record], added, "missing-id")).toEqual([record, added]);
  });

  it("retains multiple new time blocks for one task in the same AI batch", () => {
    const first = { ...record, id: "new-1" };
    const second = rescheduleTimelineRecord({ ...record, id: "new-2" }, "2026-07-03", "10:00", 60);
    expect(applyScheduledTimelineRecord(applyScheduledTimelineRecord([], first), second)).toEqual([first, second]);
  });
});
