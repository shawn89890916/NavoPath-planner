import type { Task, TimelineRecord } from "../types";

export const DEFAULT_ENGAGEMENT = 80;

export function normalizeEngagement(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.round(Math.max(10, Math.min(100, value)))
    : DEFAULT_ENGAGEMENT;
}

export function engagementFor(task: Task, record?: TimelineRecord | null): number {
  return normalizeEngagement(record ? record.engagement : task.engagement);
}

export function engagementMinutes(minutes: number, score: unknown): number {
  return Math.max(0, minutes) * normalizeEngagement(score) / 100;
}

export function engagementPatch(task: Task, score: number, record?: TimelineRecord | null): Partial<Task> {
  const engagement = normalizeEngagement(score);
  return record
    ? { timelineRecords: (task.timelineRecords || []).map((item) => item.id === record.id ? { ...item, engagement } : item) }
    : { engagement };
}
