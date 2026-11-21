import type { Settings, Task, TimelineRecord } from "./types";

export const ONBOARDING_START = { onboardingVersion: 1, onboardingStep: "setup", onboardingTaskId: "" } as const;
export const ONBOARDING_ADD = { onboardingStep: "add", onboardingTaskId: "" } as const;
export const ONBOARDING_DONE = { onboardingVersion: 2, onboardingStep: "done", onboardingTaskId: "" } as const;

export function onboardingStage(settings?: Settings | null): "setup" | "add" | "schedule" | "done" {
  if (!settings || (settings.onboardingVersion ?? 0) >= ONBOARDING_DONE.onboardingVersion) return "done";
  switch (settings.onboardingStep) {
    case "setup": return "setup";
    case "add": return "add";
    case "candidates":
    case "drag":
    case "schedule": return "schedule";
    default: return "done";
  }
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
  if (settings.onboardingTaskId) return tasks.find((task) => task.id === settings.onboardingTaskId);
  return tasks.find((task) => isOnboardingTask(task) && task.executionLane === "candidate");
}
