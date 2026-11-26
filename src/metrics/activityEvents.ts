import type { PlannerData, Task, Subtask, TimelineRecord, TimeEntry, HabitDailyState, Project } from "../types";

export type AnalyticsValue = string | number | boolean | null;
export type AnalyticsSnapshot = Record<string, AnalyticsValue>;
export type AnalyticsEntity = "task" | "subtask" | "execution" | "timeEntry" | "habit" | "project" | "timer";
export type AnalyticsSource = "client" | "ai" | "sync" | "plugin" | "system" | "undo" | "remote-observed";
export type TimerTransition = "start" | "pause" | "idle-pause" | "resume" | "stop" | "discard";
export interface AnalyticsEvent {
  id: string;
  schemaVersion: 1;
  operationId: string;
  entityType: AnalyticsEntity;
  entityId: string;
  taskId?: string;
  projectId?: string;
  occurredAt: string;
  source: AnalyticsSource;
  recordedAt?: string;
  timezone?: string;
  estimateMinutes?: number;
  action: "created" | "changed" | "removed";
  before?: AnalyticsSnapshot;
  after?: AnalyticsSnapshot;
}
type Item = { id: string; taskId?: string; projectId?: string; estimateMinutes?:number; snapshot: AnalyticsSnapshot };
const value = (v: unknown): AnalyticsValue => typeof v === "string" || typeof v === "boolean" || (typeof v === "number" && Number.isFinite(v)) ? v as AnalyticsValue : null;
function fields<T extends object>(obj: T, keys: readonly (keyof T)[]): AnalyticsSnapshot {
  return Object.fromEntries(keys.map(key => [String(key), value(obj[key])]));
}
function taskItem(t: Task): Item {
  return { id: t.id, taskId: t.id, projectId: t.projectId, snapshot: {...fields(t, ["completed","workflowStatus","projectId","parentTaskId","estimatedHours","importance","urgency","priority","plannedForDate","engagement","scheduledDate","scheduledStart","scheduledEnd","executionStatus","dueDate","hardDeadline","scheduleLocked","executionLane","order"]), aiDurationMinutes:value(t.aiInference?.duration?.minutes),aiDurationSource:value(t.aiInference?.duration?.source),aiDurationUserOverridden:value(t.aiInference?.duration?.userOverridden),aiProjectId:value(t.aiInference?.project?.projectId),aiProjectSource:value(t.aiInference?.project?.source),aiProjectUserOverridden:value(t.aiInference?.project?.userOverridden)} };
}
function executionItem(t: Task, r: TimelineRecord): Item {
  return { id: r.id, taskId: t.id, projectId: t.projectId, estimateMinutes:typeof t.estimatedHours==="number"&&Number.isFinite(t.estimatedHours)?t.estimatedHours*60:undefined, snapshot: { ...fields(r, ["scheduledDate","scheduledStart","scheduledEndDate","scheduledEnd","executionStatus","engagement"]), projectId: value(t.projectId) } };
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
function subtaskItems(task:Task,list:Subtask[],parentId:string):Item[]{return list.flatMap(s=>[{id:s.id,taskId:task.id,projectId:task.projectId,snapshot:{...fields(s,["completed","done","plannedTaskId","order"]),parentId}},...subtaskItems(task,s.subtasks||[],s.id)]);}
function collection(data: PlannerData, entity: AnalyticsEntity): Item[] {
  switch (entity) {
    case "task": return data.tasks.map(taskItem);
    case "subtask": return data.tasks.flatMap(t=>subtaskItems(t,t.subtasks||[],t.id));
    case "execution": return data.tasks.flatMap(t => (t.timelineRecords || []).map(r => executionItem(t,r)));
    case "timeEntry": return (data.timeEntries || []).map(timeItem);
    case "habit": return (data.habitDailyStates || []).map(habitItem);
    case "project": return data.projects.map(projectItem);
    case "timer": return [];
  }
}
/** Derive only allowlisted business changes. Never store task titles, notes or conversations. */
export function diffAnalyticsEvents(previous: PlannerData, next: PlannerData, occurredAt: string, operationId: string, source: AnalyticsSource = "client"): AnalyticsEvent[] {
  const result: AnalyticsEvent[] = [];
  const entities: AnalyticsEntity[] = ["task","subtask","execution","timeEntry","habit","project"];
  const timezone=Intl.DateTimeFormat().resolvedOptions().timeZone;
  for (const entityType of entities) {
    if((entityType==="task"||entityType==="subtask"||entityType==="execution")&&previous.tasks===next.tasks)continue;
    if(entityType==="timeEntry"&&previous.timeEntries===next.timeEntries||entityType==="habit"&&previous.habitDailyStates===next.habitDailyStates||entityType==="project"&&previous.projects===next.projects)continue;
    const before = new Map(collection(previous,entityType).map(x => [x.id,x]));
    const after = new Map(collection(next,entityType).map(x => [x.id,x]));
    for (const entityId of new Set([...before.keys(),...after.keys()])) {
      const a=before.get(entityId), b=after.get(entityId);
      if (a && b && JSON.stringify(a.snapshot) === JSON.stringify(b.snapshot)) continue;
      const item=b || a!;
      result.push({ id: operationId+":"+entityType+":"+entityId, schemaVersion:1, operationId, entityType, entityId, taskId:item.taskId, projectId:item.projectId, occurredAt, recordedAt:occurredAt, timezone, estimateMinutes:!a&&source!=="remote-observed"&&source!=="undo"?item.estimateMinutes:undefined, source, action:!a?"created":!b?"removed":"changed", before:a?.snapshot, after:b?.snapshot });
    }
  }
  return result;
}

export function makeTimerAnalyticsEvent(taskId:string|undefined,transition:TimerTransition,at:string,elapsedSeconds:number,operationId:string,projectId?:string,timelineRecordId?:string):AnalyticsEvent {
  return {id:operationId+":timer",schemaVersion:1,operationId,entityType:"timer",entityId:taskId||"unlinked",taskId,projectId,occurredAt:at,recordedAt:at,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,source:transition==="idle-pause"?"system":"client",action:"changed",after:{transition,mode:"stopwatch",timelineRecordId:timelineRecordId||null,elapsedSeconds:Math.max(0,Math.round(elapsedSeconds))}};
}
