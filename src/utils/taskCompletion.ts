import type { PlannerData, Task } from "../types";
import { toggleHabitCompletion } from "./habits";
import { hasRecurringRule } from "./recurrence";

export function habitScheduleForTask(data: PlannerData, taskOrRecordId: string) {
  const owner = data.tasks.find((task) => task.id === taskOrRecordId
    || task.timelineRecords?.some((record) => record.id === taskOrRecordId));
  if (!owner) return null;
  for (const habit of data.habits || []) {
    const prefix = `habit-task-${habit.id}-`;
    if (owner.id.startsWith(prefix)) {
      const date = owner.id.slice(prefix.length);
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return { habitId: habit.id, date };
    }
  }
  return null;
}

function completionPatch(task: Task, completed: boolean, now: string): Task {
  return {
    ...task,
    completed,
    completedAt: completed ? now : undefined,
    workflowStatus: completed ? "done" : task.workflowStatus === "done" ? "doing" : task.workflowStatus,
    updatedAt: now,
  };
}

/** One atomic update for the task, execution records, and a linked habit day. */
export function setTaskCompletion(data: PlannerData, taskOrRecordId: string, completed: boolean, now = new Date().toISOString()): PlannerData {
  const owner = data.tasks.find((task) => task.id === taskOrRecordId
    || task.timelineRecords?.some((record) => record.id === taskOrRecordId));
  if (!owner) return data;
  const record = owner.timelineRecords?.find((item) => item.id === taskOrRecordId);
  if (record?.executionStatus === "cancelled") return data;
  const habit = habitScheduleForTask(data, taskOrRecordId);
  if (habit) return toggleHabitCompletion(data, habit.habitId, habit.date, completed, now);

  const records = (owner.timelineRecords || []).map((item) => {
    if (record ? item.id !== record.id : !["scheduled", "completed"].includes(item.executionStatus)) return item;
    return { ...item, executionStatus: completed ? "completed" as const : "scheduled" as const };
  });
  const activeRecords = records.filter((item) => item.executionStatus === "scheduled" || item.executionStatus === "completed");
  const taskCompleted = record
    ? !hasRecurringRule(owner) && activeRecords.length > 0 && activeRecords.every((item) => item.executionStatus === "completed")
    : completed;
  const updated = completionPatch(owner, taskCompleted, now);
  if (owner.timelineRecords) updated.timelineRecords = records;
  if (!record && owner.executionStatus) updated.executionStatus = completed ? "completed" : "scheduled";
  return { ...data, tasks: data.tasks.map((task) => task.id === owner.id ? updated : task) };
}

export function toggleTaskCompletion(data: PlannerData, taskOrRecordId: string, now = new Date().toISOString()): PlannerData {
  const owner = data.tasks.find((task) => task.id === taskOrRecordId
    || task.timelineRecords?.some((record) => record.id === taskOrRecordId));
  if (!owner) return data;
  const record = owner.timelineRecords?.find((item) => item.id === taskOrRecordId);
  return setTaskCompletion(data, taskOrRecordId, record ? record.executionStatus !== "completed" : !owner.completed, now);
}
