import { describe, expect, it } from "vitest";
import { captureTask } from "../../community-plugins/quick-capture/main";
import { dailyOverview } from "../../community-plugins/daily-overview/main";
import type { CalendarEvent, Project, Task } from "../types";

const now = new Date(2026, 10, 3, 9, 30);
const project = { id: "project", title: "Study", category: "exam", completed: false } as Project;
const context = { projects: { get: (id: string) => id === project.id ? project : undefined } } as any;
const task = (id: string, patch: Partial<Task> = {}) => ({ id, title: id, dueDate: "", completed: false, ...patch }) as Task;
const event = (id: string, patch: Partial<CalendarEvent> = {}) => ({ id, title: id, date: "2026-11-03", ...patch }) as CalendarEvent;

describe("Quick Capture", () => {
  it("creates a trimmed candidate for the local day without inventing a deadline", () => {
    const value = captureTask("  Read chapter 2  ", "project", context, now);
    expect(value).toMatchObject({ title: "Read chapter 2", projectId: "project", category: "exam", plannedForDate: "2026-11-03", executionLane: "candidate", completed: false, dueDate: "" });
    expect(value).not.toHaveProperty("id"); expect(value.createdAt).toBe(now.toISOString());
  });
  it("rejects empty and oversized input and unavailable projects", () => {
    expect(() => captureTask("  ", "", context, now)).toThrow("title");
    expect(() => captureTask("x".repeat(501), "", context, now)).toThrow("title");
    expect(() => captureTask("Read", "deleted", context, now)).toThrow("project");
    expect(captureTask("Read", "", context, now)).not.toHaveProperty("projectId");
    expect(() => captureTask("Read", "project", { projects: { get: () => ({ ...project, completed: true }) } } as any, now)).toThrow("project");
  });
});

describe("Daily Overview", () => {
  it("reads actual due, planned and scheduled tasks and excludes completed/cancelled work", () => {
    const data = dailyOverview([
      task("overdue", { dueDate: "2026-11-02" }), task("completed", { dueDate: "2026-11-01", completed: true }),
      task("planned", { plannedForDate: "2026-11-03" }), task("due", { dueDate: "2026-11-03T18:00" }),
      task("scheduled", { timelineRecords: [{ scheduledDate: "2026-11-03", executionStatus: "scheduled" }] as any }),
      task("cancelled", { timelineRecords: [{ scheduledDate: "2026-11-03", executionStatus: "cancelled" }] as any }),
      task("future", { dueDate: "2026-11-04" }), task("unscheduled"),
    ], [], now);
    expect(data.today.map(item => item.id)).toEqual(["planned", "due", "scheduled"]);
    expect(data.overdue.map(item => item.id)).toEqual(["overdue"]);
  });
  it("shows saved events for today and across day ranges, ordered by time", () => {
    const data = dailyOverview([], [event("late", { startTime: "15:00" }), event("all-day"), event("range", { date: "2026-11-01", startDate: "2026-11-01", endDate: "2026-11-04", startTime: "09:00" }), event("future", { date: "2026-11-05" }), event("past", { date: "2026-11-02" })], now);
    expect(data.calendar.map(item => item.id)).toEqual(["all-day", "range", "late"]);
    expect(dailyOverview([], [], now)).toMatchObject({ today: [], overdue: [], calendar: [] });
  });
});
