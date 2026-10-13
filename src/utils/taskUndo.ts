import type { PlannerData, Task } from "../types";

type FieldChange = { key: keyof Task; before: unknown; after: unknown };
export type TaskUndo = { addedTaskIds: string[]; changes: { id: string; fields: FieldChange[] }[] };
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Capture only this operation's fields; never retain a workspace snapshot. */
export function captureTaskUndo(before: PlannerData, after: PlannerData): TaskUndo {
  const previous = new Map(before.tasks.map((task) => [task.id, task]));
  return {
    addedTaskIds: after.tasks.filter((task) => !previous.has(task.id)).map((task) => task.id),
    changes: after.tasks.flatMap((task) => {
      const original = previous.get(task.id);
      if (!original || original === task) return [];
      const keys = new Set([...Object.keys(original), ...Object.keys(task)]) as Set<keyof Task>;
      const fields = [...keys].filter((key) => key !== "updatedAt" && !same(original[key], task[key]))
        .map((key) => ({ key, before: original[key], after: task[key] }));
      return fields.length ? [{ id: task.id, fields }] : [];
    }),
  };
}

/** Apply to the latest data, keeping later edits and explicit deletions. */
export function undoTaskChanges(data: PlannerData, undo: TaskUndo, now = new Date().toISOString()): PlannerData {
  const added = new Set(undo.addedTaskIds);
  const changes = new Map(undo.changes.map((change) => [change.id, change.fields]));
  return {
    ...data,
    tasks: data.tasks.filter((task) => !added.has(task.id)).map((task) => {
      const fields = changes.get(task.id)?.filter((field) => same(task[field.key], field.after));
      if (!fields?.length) return task;
      const restored = { ...task, updatedAt: now };
      for (const field of fields) {
        if (field.before === undefined) delete restored[field.key];
        else Object.assign(restored, { [field.key]: field.before });
      }
      return restored;
    }),
  };
}
