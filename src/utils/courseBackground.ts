import type { CalendarEvent, Task } from "../types";

// 使用现有品牌注释色；同名课程在各天和主题中保持一致。
const COURSE_COLORS = ["#7EA172", "#D7816A", "#584D3D", "#8B7B9B", "#73969C"];
export function courseBackgroundColor(title: string): string {
  let hash = 0;
  for (const character of title.trim().normalize("NFKC")) hash = (Math.imul(hash, 31) + character.codePointAt(0)!) >>> 0;
  return COURSE_COLORS[hash % COURSE_COLORS.length];
}

export function blockingCalendarEvents(events: CalendarEvent[]): CalendarEvent[] {
  return events.filter(event => !event.fixedCourse);
}

// 旧版把课程事件转成普通任务：只合并从未编辑过、时间完全一致的自动副本。
export function isUneditedMigratedCourse(task: Task, events: CalendarEvent[]): boolean {
  if (!task.id.startsWith("migrated_event_course_") || task.completed || task.projectId || task.subtasks?.length) return false;
  const event = events.find(event => event.fixedCourse && task.id === `migrated_event_${event.id}_primary`);
  if (!event || task.title !== event.title || task.notes !== (event.details || "")) return false;
  const records = task.timelineRecords || [];
  return records.length === 1 && records[0].executionStatus === "scheduled"
    && records[0].scheduledDate === (event.startDate || event.date)
    && records[0].scheduledStart === event.startTime && records[0].scheduledEnd === event.endTime
    && (!records[0].scheduledEndDate || records[0].scheduledEndDate === (event.endDate || event.date));
}
