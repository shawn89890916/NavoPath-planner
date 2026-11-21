import type { Settings, Task, TimelineRecord } from "./types";

export const ONBOARDING_START = { workspaceGuideStep: "setup", workspaceGuideTaskId: "" } as const;
export const ONBOARDING_ADD = { workspaceGuideStep: "add", workspaceGuideTaskId: "" } as const;
export const ONBOARDING_DONE = { workspaceGuideStep: "done", workspaceGuideTaskId: "" } as const;

export function onboardingStage(settings?: Settings | null) {
  return settings?.workspaceGuideStep ?? "done";
}

export function onboardingBlock(task?: Task): Pick<TimelineRecord, "id" | "scheduledDate" | "scheduledStart"> | undefined {
  if (!task) return;
  const records = task.timelineRecords ?? [];
  const record = records.find((item) => item.scheduledDate && item.scheduledStart && item.scheduledEnd
    && (item.executionStatus === "scheduled" || item.executionStatus === "completed"));
  if (record) return record;
  if (records.length === 0 && task.scheduledDate && task.scheduledStart && task.scheduledEnd
    && (!task.executionStatus || task.executionStatus === "scheduled" || task.executionStatus === "completed")) {
    return { id: task.id, scheduledDate: task.scheduledDate, scheduledStart: task.scheduledStart };
  }
}

export function isOnboardingTask(task: Task) {
  return !task.completed && !task.parentTaskId && !task.caldav && !task.fixedCourse;
}

export function onboardingTarget(settings: Settings, tasks: Task[]) {
  return tasks.find((task) => task.id === settings.workspaceGuideTaskId);
}
