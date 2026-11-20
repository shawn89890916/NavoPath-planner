import type { PlannerData, Task } from "../types";
import { normalizeData } from "../browserFallback";

type FieldChange = { key: keyof Task; before: unknown; after: unknown; savedAfter?: unknown };
type TaskChange = { id: string; title: string; fields: FieldChange[]; previousSlot: [string?, string?, string?] };
export type TaskUndo = {
  added: Task[];
  removed: Task[];
  changes: TaskChange[];
  savedAdded: ReadonlyMap<string, Task>;
};
function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((item, index) => same(item, b[index]));
  }
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  return [...new Set([...Object.keys(left), ...Object.keys(right)])].every((key) => same(left[key], right[key]));
}

function comparableTasks(data: PlannerData): Task[] {
  // Use the same defaults and ordering as cloud saves without processing unrelated history.
  return normalizeData({
    ...data, timeEntries: [], longTasks: [], notes: [], drafts: [], chat: [],
    aiConversations: [], aiMemories: [], scheduleTemplates: [],
  }).tasks;
}

function changedFields(before: Task, after: Task): FieldChange[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]) as Set<keyof Task>;
  return [...keys].filter((key) => key !== "updatedAt" && !same(before[key], after[key]))
    .map((key) => ({ key, before: before[key], after: after[key] }));
}

/** Capture only this operation's fields; never retain a workspace snapshot. */
export function captureTaskUndo(before: PlannerData, after: PlannerData): TaskUndo {
  const previous = new Map(before.tasks.map((task) => [task.id, task]));
  const nextIds = new Set(after.tasks.map((task) => task.id));
  const added = after.tasks.filter((task) => !previous.has(task.id));
  const removed = before.tasks.filter((task) => !nextIds.has(task.id));
  const changes = after.tasks.flatMap((task): TaskChange[] => {
    const original = previous.get(task.id);
    if (!original || original === task) return [];
    const fields = changedFields(original, task);
    return fields.length ? [{
      id: task.id, title: task.title, fields,
      previousSlot: [original.scheduledDate, original.scheduledStart, original.scheduledEnd],
    }] : [];
  });
  const savedAdded = new Map<string, Task>();
  if (added.length || changes.length) {
    const saved = new Map(comparableTasks(after).map((task) => [task.id, task]));
    for (const task of added) {
      const savedTask = saved.get(task.id);
      if (savedTask) savedAdded.set(task.id, savedTask);
    }
    for (const { id, fields } of changes) {
      const savedTask = saved.get(id);
      if (savedTask) {
        for (const field of fields) field.savedAfter = savedTask[field.key];
      }
    }
  }
  return { added, removed, changes, savedAdded };
}

function matchesAddedTask(undo: TaskUndo, original: Task, current: Task) {
  const saved = undo.savedAdded.get(original.id);
  return !changedFields(original, current).length || (saved && !changedFields(saved, current).length);
}

/** Keep automatic enrichment with the creation it belongs to, provided no later edit intervened. */
export function refreshTaskCreationUndo(undo: TaskUndo, current: Task, updated: Task, next: PlannerData): TaskUndo {
  const original = undo.added.find((task) => task.id === current.id);
  if (!original || !matchesAddedTask(undo, original, current)) return undo;
  const saved = comparableTasks(next).find((task) => task.id === updated.id);
  const savedAdded = new Map(undo.savedAdded);
  if (saved) savedAdded.set(updated.id, saved);
  else savedAdded.delete(updated.id);
  return { ...undo, added: undo.added.map((task) => task === original ? updated : task), savedAdded };
}

/** Restore only this operation, and abort the whole undo when a later edit overlaps. */
export function undoTaskChanges(data: PlannerData, undo: TaskUndo, now = new Date().toISOString()): PlannerData {
  const current = new Map(data.tasks.map((task) => [task.id, task]));
  const added = new Set(undo.added.map((task) => task.id));
  const changes = new Map(undo.changes.map((change) => [change.id, change.fields]));
  if (
    undo.added.some((task) => {
      const actual = current.get(task.id);
      return !actual || !matchesAddedTask(undo, task, actual);
    })
    || undo.removed.some((task) => current.has(task.id) || (task.projectId && !data.projects.some((project) => project.id === task.projectId)))
    || undo.changes.some(({ id, fields }) => {
      const task = current.get(id);
      return !task || fields.some((field) => !same(task[field.key], field.after)
        && !("savedAfter" in field && same(task[field.key], field.savedAfter)));
    })
    || data.tasks.some((task) => !added.has(task.id) && task.parentTaskId && added.has(task.parentTaskId))
    || data.timeEntries?.some((entry) => added.has(entry.taskId))
  ) return data;
  const restoredTasks = undo.removed.map((task) => {
    const deletedAt = Date.parse(data.sync?.deleted[`tasks:${task.id}`] || "");
    const updatedAt = deletedAt >= Date.parse(now) ? new Date(deletedAt + 1).toISOString() : now;
    return { ...task, updatedAt };
  });
  return {
    ...data,
    tasks: [...data.tasks.filter((task) => !added.has(task.id)).map((task) => {
      const fields = changes.get(task.id);
      if (!fields?.length) return task;
      const updatedAt = Date.parse(task.updatedAt) >= Date.parse(now)
        ? new Date(Date.parse(task.updatedAt) + 1).toISOString() : now;
      const restored = { ...task, updatedAt };
      for (const field of fields) {
        if (field.before === undefined) delete restored[field.key];
        else Object.assign(restored, { [field.key]: field.before });
      }
      return restored;
    }), ...restoredTasks],
  };
}
