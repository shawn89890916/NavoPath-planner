import type { TaskOperation } from "../components/TaskOperationHistory";
import { cacheUpdate } from "../extensions/cache";

export const TASK_OPERATION_RETENTION_MS = 3 * 24 * 60 * 60 * 1000;

export function recentTaskOperations(operations: TaskOperation[], now: number): TaskOperation[] {
  const cutoff = now - TASK_OPERATION_RETENTION_MS;
  return operations.filter((operation) => Date.parse(operation.at) > cutoff)
    .sort((a, b) => b.at.localeCompare(a.at));
}

export async function updateSavedTaskOperations(
  workspaceKey: string,
  update: (operations: TaskOperation[]) => TaskOperation[],
  now: number,
): Promise<TaskOperation[]> {
  const key = `activity-history:v1:${workspaceKey}`;
  const stored = await cacheUpdate<TaskOperation[]>(key, (operations) => {
    const recent = recentTaskOperations(update(operations || []), now);
    return recent.length ? recent : null;
  });
  return stored || [];
}
