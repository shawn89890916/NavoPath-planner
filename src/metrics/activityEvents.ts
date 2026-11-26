import type { PlannerData, Task, TimelineRecord, TimeEntry, HabitDailyState, Project } from "../types";

export type AnalyticsValue = string | number | boolean | null;
export type AnalyticsSnapshot = Record<string, AnalyticsValue>;
export type AnalyticsEntity = "task" | "execution" | "timeEntry" | "habit" | "project";
export interface AnalyticsEvent {
  id: string;
  schemaVersion: 1;
  operationId: string;
  entityType: AnalyticsEntity;
  entityId: string;
  taskId?: string;
  projectId?: string;
  occurredAt: string;
  source: "client";
  action: "created" | "changed" | "removed";
  before?: AnalyticsSnapshot;
  after?: AnalyticsSnapshot;
}
type Item = { id: string; taskId?: string; projectId?: string; snapshot: AnalyticsSnapshot };
const value = (v: unknown): AnalyticsValue => typeof v === "string" || typeof v === "boolean" || (typeof v === "number" && Number.isFinite(v)) ? v as AnalyticsValue : null;
function fields<T extends object>(obj: T, keys: readonly (keyof T)[]): AnalyticsSnapshot {
  return Object.fromEntries(keys.map(key => [String(key), value(obj[key])]));
}
function taskItem(t: Task): Item {
  return { id: t.id, taskId: t.id, projectId: t.projectId, snapshot: fields(t, ["completed","workflowStatus","projectId","parentTaskId","estimatedHours","importance","urgency","priority","plannedForDate","engagement","scheduledDate","scheduledStart","scheduledEnd","executionStatus"]) };
}
function executionItem(t: Task, r: TimelineRecord): Item {
  return { id: r.id, taskId: t.id, projectId: t.projectId, snapshot: { ...fields(r, ["scheduledDate","scheduledStart","scheduledEndDate","scheduledEnd","executionStatus","engagement"]), projectId: value(t.projectId) } };
}
function timeItem(t: TimeEntry): Item {
  return { id: t.id, taskId: t.taskId, projectId: t.projectId, snapshot: fields(t, ["projectId","timelineRecordId","startAt","endAt","durationMinutes","source"]) };
}
function habitItem(h: HabitDailyState): Item {
  return { id: h.id, snapshot: fields(h, ["habitId","date","completed","timelineRecordId"]) };
}
function projectItem(p: Project): Item {
  return { id: p.id, projectId: p.id, snapshot: fields(p, ["completed","dueDate","importance","urgency"]) };
}
function collection(data: PlannerData, entity: AnalyticsEntity): Item[] {
  switch (entity) {
    case "task": return data.tasks.map(taskItem);
    case "execution": return data.tasks.flatMap(t => (t.timelineRecords || []).map(r => executionItem(t,r)));
    case "timeEntry": return (data.timeEntries || []).map(timeItem);
    case "habit": return (data.habitDailyStates || []).map(habitItem);
    case "project": return data.projects.map(projectItem);
  }
}
/** Derive only allowlisted business changes. Never store task titles, notes or conversations. */
export function diffAnalyticsEvents(previous: PlannerData, next: PlannerData, occurredAt: string, operationId: string): AnalyticsEvent[] {
  const result: AnalyticsEvent[] = [];
  const entities: AnalyticsEntity[] = ["task","execution","timeEntry","habit","project"];
  for (const entityType of entities) {
    const before = new Map(collection(previous,entityType).map(x => [x.id,x]));
    const after = new Map(collection(next,entityType).map(x => [x.id,x]));
    for (const entityId of new Set([...before.keys(),...after.keys()])) {
      const a=before.get(entityId), b=after.get(entityId);
      if (a && b && JSON.stringify(a.snapshot) === JSON.stringify(b.snapshot)) continue;
      const item=b || a!;
      result.push({ id: operationId+":"+entityType+":"+entityId, schemaVersion:1, operationId, entityType, entityId, taskId:item.taskId, projectId:item.projectId, occurredAt, source:"client", action:!a?"created":!b?"removed":"changed", before:a?.snapshot, after:b?.snapshot });
    }
  }
  return result;
}
