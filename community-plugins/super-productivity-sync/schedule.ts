import type { Task, TimelineRecord } from "../../src/types";

// SP represents a single timed slot per task. Ignore untimed and historical
// records, and use the same selected block for exporting and applying edits.
const clock = /^([01]\d|2[0-3]):[0-5]\d$/;
const day = /^\d{4}-\d{2}-\d{2}$/;
export function validSlot(date: unknown, time: unknown): boolean {
  return typeof date === "string" && day.test(date) && typeof time === "string" && clock.test(time)
    && Number.isFinite(Date.parse(date + "T" + time + ":00Z"));
}
export function durationMinutes(record: Pick<TimelineRecord, "scheduledDate" | "scheduledStart" | "scheduledEnd" | "scheduledEndDate">): number {
  const start = Date.parse(record.scheduledDate + "T" + record.scheduledStart + ":00Z");
  let end = Date.parse((record.scheduledEndDate || record.scheduledDate) + "T" + record.scheduledEnd + ":00Z");
  if (!record.scheduledEndDate && end <= start) end += 86_400_000;
  return Number.isFinite(end - start) && end > start ? Math.round((end - start) / 60_000) : 0;
}
export function selectTimedSlot(task: Task) {
  const records = (task.timelineRecords || []).map((record, index) => ({ record, index }))
    .filter(({ record }) => record.executionStatus === "scheduled" && validSlot(record.scheduledDate, record.scheduledStart) && durationMinutes(record) > 0)
    .sort((a,b) => (a.record.scheduledDate + "T" + a.record.scheduledStart).localeCompare(b.record.scheduledDate + "T" + b.record.scheduledStart));
  if (records.length) return records[0];
  // Legacy schedules may coexist with completed execution history.
  if (!task.completed && (!task.executionStatus || task.executionStatus === "scheduled") && task.scheduledDate && task.scheduledStart && validSlot(task.scheduledDate, task.scheduledStart)) {
    const record: TimelineRecord = {
      id: "", taskId: task.id, scheduledDate: task.scheduledDate, scheduledStart: task.scheduledStart,
      scheduledEnd: task.scheduledEnd || "", executionStatus: "scheduled", createdAt: task.createdAt,
    };
    if (!durationMinutes(record)) {
      const minutes = Math.max(1, Math.round((task.estimatedHours || 0) * 60) || 30);
      const end = new Date(Date.parse(record.scheduledDate + "T" + record.scheduledStart + ":00Z") + minutes * 60_000).toISOString();
      record.scheduledEndDate = end.slice(0,10); record.scheduledEnd = end.slice(11,16);
    }
    return { record, index: -1 };
  }
  return undefined;
}
