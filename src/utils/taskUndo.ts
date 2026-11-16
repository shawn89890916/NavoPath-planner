import type { PlannerData, Task } from "../types";

type FieldChange = { key: keyof Task; before: unknown; after: unknown };
type TaskChange = { id: string; title: string; fields: FieldChange[]; previousSlot: [string?, string?, string?] };
export type TaskUndo = { added: Task[]; removed: Task[]; changes: TaskChange[] };
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function changedFields(before: Task, after: Task): FieldChange[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]) as Set<keyof Task>;
  return [...keys].filter((key) => key !== "updatedAt" && !same(before[key], after[key]))
    .map((key) => ({ key, before: before[key], after: after[key] }));
}

/** Capture only this operation's fields; never retain a workspace snapshot. */
export function captureTaskUndo(before: PlannerData, after: PlannerData): TaskUndo {
  const previous = new Map(before.tasks.map((task) => [task.id, task]));
  const nextIds = new Set(after.tasks.map((task) => task.id));
  return {
    added: after.tasks.filter((task) => !previous.has(task.id)),
    removed: before.tasks.filter((task) => !nextIds.has(task.id)),
    changes: after.tasks.flatMap((task) => {
      const original = previous.get(task.id);
      if (!original || original === task) return [];
      const fields = changedFields(original, task);
      return fields.length ? [{
        id: task.id, title: task.title, fields,
        previousSlot: [original.scheduledDate, original.scheduledStart, original.scheduledEnd],
      }] : [];
    }),
  };
}

/** Restore only this operation, and abort the whole undo when a later edit overlaps. */
export function undoTaskChanges(data: PlannerData, undo: TaskUndo, now = new Date().toISOString()): PlannerData {
  const current = new Map(data.tasks.map((task) => [task.id, task]));
  const added = new Set(undo.added.map((task) => task.id));
  const changes = new Map(undo.changes.map((change) => [change.id, change.fields]));
  if (
    undo.added.some((task) => !current.has(task.id) || changedFields(task, current.get(task.id)!).length > 0)
    || undo.removed.some((task) => current.has(task.id) || (task.projectId && !data.projects.some((project) => project.id === task.projectId)))
    || undo.changes.some(({ id, fields }) => {
      const task = current.get(id);
      return !task || fields.some((field) => !same(task[field.key], field.after));
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
      const restored = { ...task, updatedAt: now };
      for (const field of fields) {
        if (field.before === undefined) delete restored[field.key];
        else Object.assign(restored, { [field.key]: field.before });
      }
      return restored;
    }), ...restoredTasks],
  };
}
