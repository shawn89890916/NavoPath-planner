import { describe, expect, it } from "vitest";
import { applyUnfinishedTaskDecisions, ensureDailyReviewConversation, recordGapActivity } from "./proactiveAssistant";
import type { PlannerData, Task } from "./types";

const task: Task = { id: "task-1", title: "Physics", dueDate: "2026-08-31", category: "personal", priority: "medium", notes: "", goalId: "", completed: false, estimatedHours: 1, order: 0, subtasks: [], createdAt: "1", updatedAt: "1" };
const data = (): PlannerData => ({ version: 1, importedSeedVersion: "test", generatedAt: "1", goals: [], projects: [], tasks: [task], longTasks: [], events: [], notes: [], drafts: [], chat: [], aiMemories: [], timeEntries: [] });

describe("proactive gap activity", () => {
  it("logs an existing task without completing it", () => {
    const result = recordGapActivity(data(), { taskId: "task-1", date: "2026-08-31", startTime: "10:00", endTime: "10:45" });
    expect(result.tasks[0].completed).toBe(false);
    expect(result.tasks[0].timelineRecords?.[0].executionStatus).toBe("completed");
    expect(result.timeEntries?.[0]).toMatchObject({ taskId: "task-1", durationMinutes: 45, source: "manual" });
  });

  it("creates a completed historical task when no task is selected", () => {
    const result = recordGapActivity(data(), { newTaskTitle: "整理笔记", date: "2026-08-31", startTime: "11:00", endTime: "11:30" });
    expect(result.tasks).toHaveLength(2);
    expect(result.tasks[1]).toMatchObject({ title: "整理笔记", completed: true });
    expect(result.timeEntries?.[0].taskId).toBe(result.tasks[1].id);
  });
});

describe("proactive daily review and unfinished task actions", () => {
  it("appends a daily review notification to one fixed conversation exactly once", () => {
    const notification = { id: "notification-1", kind: "daily_review" as const, title: "今日收工复盘", body: "完成了物理复习。", created_at: "2026-08-31T14:00:00.000Z", metadata: { date: "2026-08-31" } };
    const first = ensureDailyReviewConversation(data(), notification, "zh");
    const second = ensureDailyReviewConversation(first.data, notification, "zh");
    expect(first.added).toBe(true);
    expect(second.added).toBe(false);
    expect(second.data.aiConversations).toHaveLength(1);
    expect(second.data.aiConversations?.[0].id).toBe("navopath-daily-review");
    expect(second.data.aiConversations?.[0].messages).toHaveLength(1);
    expect(second.data.aiConversations?.[0].messages[0].notificationId).toBe("notification-1");
  });

  it("applies complete, tomorrow, and AI decisions without moving AI-owned tasks", () => {
    const source = data();
    source.tasks.push({ ...task, id: "task-2", title: "Math", timelineRecords: [{ id: "record-2", taskId: "task-2", scheduledDate: "2026-08-31", scheduledStart: "11:00", scheduledEnd: "12:00", executionStatus: "scheduled", createdAt: "1" }] });
    source.tasks.push({ ...task, id: "task-3", title: "Chemistry", timelineRecords: [{ id: "record-3", taskId: "task-3", scheduledDate: "2026-08-31", scheduledStart: "13:00", scheduledEnd: "14:00", executionStatus: "scheduled", createdAt: "1" }] });
    const result = applyUnfinishedTaskDecisions(source, [
      { taskId: "task-1", recordId: "missing", title: "Physics", date: "2026-08-31", startTime: "09:00", endTime: "10:00" },
      { taskId: "task-2", recordId: "record-2", title: "Math", date: "2026-08-31", startTime: "11:00", endTime: "12:00" },
      { taskId: "task-3", recordId: "record-3", title: "Chemistry", date: "2026-08-31", startTime: "13:00", endTime: "14:00" },
    ], { "task-1": "ai", "task-2": "tomorrow", "task-3": "complete" }, "2026-08-31T15:00:00.000Z");
    expect(result.aiTaskIds).toEqual(["task-1"]);
    expect(result.data.tasks.find((item) => item.id === "task-2")?.plannedForDate).toBe("2026-09-01");
    expect(result.data.tasks.find((item) => item.id === "task-2")?.timelineRecords?.[0].executionStatus).toBe("returned_unfinished");
    expect(result.data.tasks.find((item) => item.id === "task-3")?.completed).toBe(true);
    expect(result.data.tasks.find((item) => item.id === "task-3")?.timelineRecords?.[0].executionStatus).toBe("completed");
  });
});
