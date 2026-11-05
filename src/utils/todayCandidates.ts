import type { PlannerData } from "../types";
import { hasActiveTaskSchedule } from "./timelineRecords";

export type TodayCandidateResult = {
  data: PlannerData;
  action: "added" | "removed" | "existing" | "returned";
  taskId: string;
};

export function reorderTodayCandidates(
  data: PlannerData,
  visibleIds: string[],
  dragId: string,
  targetId: string,
  position: "before" | "after",
  groupByProject: boolean,
  now = new Date().toISOString(),
): PlannerData {
  const byId = new Map(data.tasks.map((task) => [task.id, task]));
  const dragged = byId.get(dragId);
  const target = byId.get(targetId);
  if (!dragged || !target || dragId === targetId
    || dragged.completed !== target.completed
    || (groupByProject && dragged.projectId !== target.projectId)) return data;
  const ids = [...new Set(visibleIds)].filter((id) => byId.has(id));
  if (!ids.includes(dragId) || !ids.includes(targetId)) return data;
  const reordered = ids.filter((id) => id !== dragId);
  const targetIndex = reordered.indexOf(targetId);
  reordered.splice(targetIndex + (position === "after" ? 1 : 0), 0, dragId);
  if (reordered.every((id, index) => id === ids[index])) return data;
  // Use the whole visible list so ranks from different projects cannot collide.
  const order = new Map(reordered.map((id, index) => [id, index * 10]));
  return {
    ...data,
    tasks: data.tasks.map((task) => order.has(task.id) && task.order !== order.get(task.id)
      ? { ...task, order: order.get(task.id), updatedAt: now }
      : task),
  };
}

export function returnScheduledTaskToToday(
  data: PlannerData,
  taskOrRecordId: string,
  today: string,
  now = new Date().toISOString(),
): TodayCandidateResult {
  const owner = data.tasks.find((task) =>
    task.id === taskOrRecordId || (task.timelineRecords || []).some((record) => record.id === taskOrRecordId)
  );
  if (!owner) return { data, action: "existing", taskId: taskOrRecordId };
  const record = owner.timelineRecords?.find((item) => item.id === taskOrRecordId);
  const legacyScheduled = owner.id === taskOrRecordId && !owner.completed && owner.scheduledDate
    && (!owner.executionStatus || owner.executionStatus === "scheduled");
  if (record ? record.executionStatus !== "scheduled" : !legacyScheduled) {
    return { data, action: "existing", taskId: owner.id };
  }

  return {
    data: {
      ...data,
      tasks: data.tasks.map((task) => {
        if (task.id !== owner.id) return task;
        const nextTask = record ? {
          ...task, timelineRecords: (task.timelineRecords || []).filter((item) => item.id !== record.id),
        } : {
          ...task, scheduledDate: undefined, scheduledStart: undefined, scheduledEnd: undefined, executionStatus: undefined,
        };
        return {
          ...nextTask,
          ...(hasActiveTaskSchedule(nextTask) ? {} : { plannedForDate: today, executionLane: "candidate" as const }),
          updatedAt: now,
        };
      }),
    },
    action: "returned",
    taskId: owner.id,
  };
}
