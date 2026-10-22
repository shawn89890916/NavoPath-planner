import type { Task, TimelineRecord } from "../types";
import { rescheduleTimelineRecord, timelineRecordDurationMinutes } from "./timelineRecords";

/** Only scheduling changes invalidate a preview; notes and project edits remain safe. */
export function mobilePlacementVersion(task: Task): string {
  return JSON.stringify([task.completed, task.workflowStatus, task.estimatedHours, task.recurrence,
    task.timelineRecords, task.plannedForDate, task.dueDate, task.scheduledDate, task.scheduledStart, task.scheduledEnd, task.executionLane]);
}

/** An explicit record moves independently; a new execution appends without removing history. */
export function applyMobilePlacement(task: Task, record: TimelineRecord, recordId?: string): Task {
  const records = task.timelineRecords || [];
  const target = recordId ? records.find((item) => item.id === recordId) : undefined;
  if (recordId && !target) throw new Error("Execution no longer exists");
  return {
    ...task,
    executionLane: undefined,
    plannedForDate: record.scheduledDate,
    timelineRecords: target ? records.map((item) => item.id === target.id
      ? rescheduleTimelineRecord(item, record.scheduledDate, record.scheduledStart,
        timelineRecordDurationMinutes(record))
      : item) : [...records, record],
    updatedAt: record.createdAt,
  };
}
