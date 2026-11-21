import { describe, expect, it } from "vitest";
import { getDefaultSettings, normalizeSettings } from "./defaultSettings";
import { onboardingBlock, onboardingStage, onboardingTarget, ONBOARDING_DONE, ONBOARDING_START } from "./onboarding";
import type { Task, TimelineRecord } from "./types";

const task: Task = {
  id: "first-task", title: "Tidy my desk", dueDate: "", category: "personal",
  priority: "medium", notes: "", goalId: "", completed: false,
  createdAt: "2026-11-21T01:00:00Z", updatedAt: "2026-11-21T01:00:00Z",
  executionLane: "candidate",
};
const block: TimelineRecord = {
  id: "block", taskId: task.id, scheduledDate: "2026-11-21", scheduledStart: "10:00",
  scheduledEnd: "10:30", executionStatus: "scheduled", createdAt: task.createdAt,
};

describe("workspace onboarding", () => {
  it("opens the workspace setup when the current guide restarts", () => {
    const defaults = getDefaultSettings();
    expect(onboardingStage(defaults)).toBe("done");
    expect(onboardingStage({ ...defaults, ...ONBOARDING_START })).toBe("setup");
    expect(onboardingStage({ ...defaults, workspaceGuideStep: "add" })).toBe("add");
    expect(onboardingStage({ ...defaults, ...ONBOARDING_DONE })).toBe("done");
  });

  it("discards retired tutorial state without resuming it", () => {
    const retiredFields = { onboardingVersion: 1, onboardingStep: "add", onboardingTaskId: task.id };
    const normalized = normalizeSettings(retiredFields);
    expect(onboardingStage(normalized)).toBe("done");
    for (const field of Object.keys(retiredFields)) expect(normalized).not.toHaveProperty(field);
    expect(onboardingStage(normalizeSettings({ ...retiredFields, ...ONBOARDING_START }))).toBe("setup");
  });

  it("tracks the saved task across refreshes and detects its removal", () => {
    const settings = { ...getDefaultSettings(), ...ONBOARDING_START, workspaceGuideStep: "schedule" as const };
    const other = { ...task, id: "other-task" };
    expect(onboardingTarget(settings, [task, other])).toBeUndefined();
    expect(onboardingTarget({ ...settings, workspaceGuideTaskId: task.id }, [other, task])).toBe(task);
    expect(onboardingTarget({ ...settings, workspaceGuideTaskId: task.id }, [other])).toBeUndefined();
  });

  it("completes only for a real timed block and supports legacy timed tasks", () => {
    expect(onboardingBlock({ ...task, timelineRecords: [{ ...block, scheduledStart: "", scheduledEnd: "" }] })).toBeUndefined();
    expect(onboardingBlock({ ...task, timelineRecords: [{ ...block, executionStatus: "cancelled" }] })).toBeUndefined();
    expect(onboardingBlock({ ...task, timelineRecords: [block] })).toBe(block);
    expect(onboardingBlock({ ...task, scheduledDate: block.scheduledDate, scheduledStart: block.scheduledStart, scheduledEnd: block.scheduledEnd }))
      .toMatchObject({ id: task.id, scheduledDate: block.scheduledDate });
  });
});
