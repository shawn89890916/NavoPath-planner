import { describe, expect, it } from "vitest";
import type { PlannerData } from "../types";
import { projectActivityFacts, queryPluginActivity } from "./pluginActivityFacts";
import type { TimeAllocationMetrics } from "./timeAllocation";

const from = "2026-11-28T10:00:00Z", to = "2026-11-28T11:00:00Z";
const data = { tasks: [], projects: [], timeEntries: [{ id: "measured", taskId: "deleted-task", startAt: "2026-11-28T09:00:00Z", endAt: to, durationMinutes: 90, source: "manual" }] } as unknown as PlannerData;
describe("plugin activity facts", () => {
  it("clips measured time proportionally and permits task-ID filtering", () => {
    expect(queryPluginActivity(data, { from, to }, 0)).toEqual({ planned: [], actual: [{ id: "measured", taskId: "deleted-task", start: "2026-11-28T10:00:00.000Z", end: "2026-11-28T11:00:00.000Z", minutes: 45 }] });
    expect(queryPluginActivity(data, { from, to, taskIds: [] }, 0).actual).toEqual([]);
  });
  it("rejects invalid, inverted and unbounded ranges", () => {
    for (const query of [{ from: "invalid", to }, { from: to, to: from }, { from: "2024-01-01T00:00:00Z", to }]) expect(() => queryPluginActivity(data, query, 0)).toThrow();
  });
  it("keeps concrete planned duration raw and excludes estimated/projected entries", () => {
    const base = { taskId: "task", recordId: "r", scheduledStart: new Date(from), scheduledEnd: new Date(to), durationMinutes: 12 };
    const allocation = { taskEntries: [base, { ...base, isEstimatedAllDay: true }, { ...base, isProjectedRecurrence: true }] } as unknown as TimeAllocationMetrics;
    expect(projectActivityFacts(allocation, []).planned).toEqual([{ id: JSON.stringify(["task", "r", "2026-11-28T10:00:00.000Z"]), taskId: "task", start: "2026-11-28T10:00:00.000Z", end: "2026-11-28T11:00:00.000Z", minutes: 60 }]);
  });
});
