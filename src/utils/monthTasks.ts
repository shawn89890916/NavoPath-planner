import type { Task, TimelineRecord } from "../types";
import { addIsoDays } from "./monthWindow";
import { calculateTimelineRecordEnd, rescheduleTimelineRecord } from "./timelineRecords";

/** Use the same expanded schedules as the timeline, with a fallback for planned candidates. */
export function buildMonthTaskBuckets(tasks: Task[], schedules: Task[], dates: Set<string>) {
  const buckets = new Map<string, Task[]>();
  const unscheduled = tasks.filter((task) => task.executionStatus !== "cancelled"
    && ((task.executionLane === "candidate" && task.plannedForDate)
      || (!task.timelineRecords?.length && !task.recurrence?.startTime && !task.scheduledStart)));
  const candidateTasks = new Set(unscheduled);
  for (const task of [...schedules, ...unscheduled]) {
    const date = candidateTasks.has(task) && task.executionLane === "candidate"
      ? task.plannedForDate : task.scheduledDate || task.plannedForDate || task.dueDate;
    if (!date || !dates.has(date) || task.executionStatus === "cancelled") continue;
    const bucket = buckets.get(date) || [];
    if (bucket.some((item) => item.id === task.id)) continue;
    bucket.push(task);
    buckets.set(date, bucket);
  }
  for (const bucket of buckets.values()) bucket.sort((a, b) =>
    Number(a.completed) - Number(b.completed)
    || (a.scheduledStart || "").localeCompare(b.scheduledStart || "")
    || (a.order || 0) - (b.order || 0));
  return buckets;
}

/** Move only the selected execution; other records and the task's deadline stay intact. */
export function moveMonthTask(task: Task, display: Task, date: string, recordId: string, now: string): Task {
  const sourceDate = display.scheduledDate || display.plannedForDate || display.dueDate;
  if (sourceDate === date && display.scheduledDate) return task;
  const record = task.timelineRecords?.find((item) => item.id === recordId);
  if (record) {
    const dayOffset = Math.round((Date.parse(`${record.scheduledDate}T00:00:00Z`) - Date.parse(`${sourceDate}T00:00:00Z`)) / 86_400_000);
    const targetDate = addIsoDays(date, dayOffset);
    const moved = record.scheduledStart
      ? rescheduleTimelineRecord(record, targetDate, record.scheduledStart)
      : { ...record, scheduledDate: targetDate, scheduledEndDate: undefined };
    return { ...task, updatedAt: now,
      plannedForDate: task.plannedForDate === sourceDate ? date : task.plannedForDate,
      timelineRecords: task.timelineRecords!.map((item) => item.id === record.id ? moved : item) };
  }
  if (task.recurrence?.startTime && display.id !== task.id && display.scheduledDate) {
    const start = display.scheduledStart || task.recurrence.startTime;
    const duration = task.recurrence.durationMinutes || Math.round((task.estimatedHours || 0.5) * 60);
    const exception: TimelineRecord = { id: `${display.id}_cancelled`, taskId: task.id,
      scheduledDate: display.scheduledDate, scheduledStart: start,
      ...calculateTimelineRecordEnd(display.scheduledDate, start, duration), executionStatus: "cancelled", createdAt: now };
    return { ...task, updatedAt: now, timelineRecords: [...(task.timelineRecords || []), exception,
      { ...rescheduleTimelineRecord(exception, date, start, duration), id: `${display.id}_moved_${now}`, executionStatus: "scheduled" }] };
  }
  if (task.timelineRecords?.length) {
    return { ...task, updatedAt: now, plannedForDate: date, executionLane: undefined,
      timelineRecords: [...task.timelineRecords, { id: `${task.id}_month_${now}`, taskId: task.id,
        scheduledDate: date, scheduledStart: "", scheduledEnd: "", createdAt: now,
        executionStatus: task.completed ? "completed" : "scheduled" }] };
  }
  return { ...task, updatedAt: now, plannedForDate: date, scheduledDate: date, executionLane: undefined };
}
