import { describe, expect, it } from "vitest";
import type { Task } from "../types";
import { candidateReturnedScheduleSummary, candidateScheduleSummary } from "./candidateSchedule";

function task(overrides: Partial<Task>): Task {
  return {
    id: "task-1",
    title: "Candidate",
    dueDate: "2026-09-20",
    category: "exam",
    priority: null,
    notes: "",
    goalId: "goal-1",
    completed: false,
    createdAt: "2026-09-20T00:00:00.000Z",
    updatedAt: "2026-09-20T00:00:00.000Z",
    ...overrides,
  };
}

describe("candidate schedule summaries", () => {
  it("keeps returned placements out of active schedule links while exposing their original time", () => {
    const returned = task({
      executionStatus: "returned_unfinished",
      timelineRecords: [{
        id: "record-1",
        taskId: "task-1",
        scheduledDate: "2026-09-19",
        scheduledStart: "18:00",
        scheduledEnd: "18:45",
        executionStatus: "returned_unfinished",
        createdAt: "2026-09-19T10:00:00.000Z",
      }],
    });

    expect(candidateScheduleSummary(returned, "2026-09-20")).toBeNull();
    expect(candidateReturnedScheduleSummary(returned)).toMatchObject({
      date: "2026-09-19",
      startTime: "18:00",
    });
  });

  it("uses the latest returned placement as the original schedule", () => {
    const returned = task({
      timelineRecords: [
        { id: "old", taskId: "task-1", scheduledDate: "2026-09-18", scheduledStart: "09:00", scheduledEnd: "09:30", executionStatus: "returned_unfinished", createdAt: "2026-09-18T01:00:00.000Z" },
        { id: "latest", taskId: "task-1", scheduledDate: "2026-09-19", scheduledStart: "15:30", scheduledEnd: "16:00", executionStatus: "returned_unfinished", createdAt: "2026-09-19T07:30:00.000Z" },
      ],
    });

    expect(candidateReturnedScheduleSummary(returned)?.label).toContain("15:30");
  });
});
