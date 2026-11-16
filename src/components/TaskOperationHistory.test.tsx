import { describe, expect, it } from "vitest";
import { createDemoData } from "../productDemoData";
import { captureTaskUndo } from "../utils/taskUndo";
import type { Task } from "../types";
import { describeOperationDetails, type TaskOperation } from "./TaskOperationHistory";

const dates = new Intl.DateTimeFormat("en-GB", { month: "short", day: "numeric" });
const calendar = new Intl.DateTimeFormat("en-GB", { year: "numeric", month: "short", day: "numeric" });

function details(original: Partial<Task>, patch: Partial<Task>, kind: TaskOperation["kind"]) {
  const data = createDemoData("en", "planning", 0);
  const task = { ...data.tasks[0], timelineRecords: [], ...original };
  const before = { ...data, tasks: [task] };
  const after = { ...data, tasks: [{ ...task, ...patch }] };
  const operation = { id: "op", workspaceKey: "local", at: "2026-11-16T14:00:00Z", kind, titles: [task.title], undo: captureTaskUndo(before, after) };
  return describeOperationDetails(operation, "en", data.projects, dates, calendar);
}

describe("activity history descriptions", () => {
  it("shows both ranges when an existing time block moves across dates", () => {
    const record = { id: "block", taskId: "task", scheduledDate: "2026-11-16", scheduledStart: "14:00", scheduledEnd: "14:45", executionStatus: "scheduled" as const, createdAt: "2026-11-16T14:00:00Z" };
    expect(details({ timelineRecords: [record] }, {
      timelineRecords: [{ ...record, scheduledDate: "2026-11-17", scheduledStart: "16:00", scheduledEnd: "16:45" }],
    }, "reschedule")).toEqual(["Moved from 16 Nov 14:00–14:45 to 17 Nov 16:00–16:45"]);
  });

  it("includes the unchanged date for a legacy time edit", () => {
    expect(details({ scheduledDate: "2026-11-16", scheduledStart: "14:00", scheduledEnd: "14:45" },
      { scheduledEnd: "15:00" }, "reschedule")).toEqual(["Moved from 16 Nov 14:00–14:45 to 16 Nov 14:00–15:00"]);
  });

  it("distinguishes the same calendar day in two different years", () => {
    expect(details({ scheduledDate: "2026-11-16", scheduledStart: "14:00" },
      { scheduledDate: "2027-11-16" }, "reschedule")).toEqual(["Moved from 16 Nov 14:00 to 16 Nov 2027 14:00"]);
  });

  it("names the edited fields and leaves note contents out of the history text", () => {
    expect(details({ title: "Draft", dueDate: "2026-11-16", estimatedHours: 1, notes: "Old note" },
      { title: "Review draft", dueDate: "2026-11-17", estimatedHours: 0.75, notes: "New note" }, "edit")).toEqual([
      "Title changed from “Draft” to “Review draft”",
      "Due date changed from 16 Nov to 17 Nov",
      "Estimated duration changed from 60 min to 45 min",
      "Updated the notes",
    ]);
  });
});
