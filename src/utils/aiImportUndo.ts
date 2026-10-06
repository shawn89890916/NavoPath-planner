import type { PlannerData, Task } from "../types";

export type AiImportChangeSet = {
  previousTasks: Task[];
  addedTaskIds: string[];
  addedEventIds: string[];
};

/** Restore one accepted AI batch, retaining unrelated work. Persistence belongs to the caller. */
export function undoAiImportData(data: PlannerData, commit: AiImportChangeSet): PlannerData {
  const previousById = new Map(commit.previousTasks.map((task) => [task.id, task]));
  return {
    ...data,
    tasks: data.tasks.filter((task) => !commit.addedTaskIds.includes(task.id)).map((task) => previousById.get(task.id) || task),
    events: data.events.filter((event) => !commit.addedEventIds.includes(event.id)),
  };
}
