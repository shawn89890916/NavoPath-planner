import type { PlannerData } from "../types";
import type { V2ActivityFacts, V2ActivityQuery } from "../extensions/sdkV2";
import { V2ContractError } from "../extensions/runtimeV2";
import { buildTimeAllocationMetrics, type TimeAllocationMetrics } from "./timeAllocation";
import { buildInsights } from "./insightFacts";

type Tracked = ReturnType<typeof buildInsights>["trackedEntries"];

/** Project only concrete scheduled intervals and measured time, never projected
 * recurrences, all-day estimates or engagement-weighted time as actual time.
 * Segments split by metric day get stable, distinct IDs. */
export function projectActivityFacts(allocation: TimeAllocationMetrics, tracked: Tracked): V2ActivityFacts {
  return {
    planned: allocation.taskEntries.filter(e => !e.isEstimatedAllDay && !e.isProjectedRecurrence).map(e => ({
      id: JSON.stringify([e.taskId, e.recordId, e.scheduledStart.toISOString()]),
      taskId: e.taskId, start: e.scheduledStart.toISOString(), end: e.scheduledEnd.toISOString(),
      minutes: (e.scheduledEnd.getTime() - e.scheduledStart.getTime()) / 60000,
    })),
    actual: tracked.map(e => ({ id: e.id, taskId: e.taskId, start: e.start.toISOString(), end: e.end.toISOString(), minutes: e.minutes })),
  };
}

const timestamp = (value: unknown) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? Date.parse(value) : NaN;

export function queryPluginActivity(data: PlannerData, query: V2ActivityQuery, dayStartMinutes: number): V2ActivityFacts {
  const from = timestamp(query?.from), to = timestamp(query?.to);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from || to - from > 366 * 86400000 ||
      (query.taskIds !== undefined && (!Array.isArray(query.taskIds) || query.taskIds.length > 10000 || query.taskIds.some(id => typeof id !== "string")))) {
    throw new V2ContractError("INVALID_INPUT", "Expected an ISO interval of at most 366 days and optional task IDs");
  }
  const ids = query.taskIds === undefined ? undefined : new Set(query.taskIds);
  const filtered = ids ? { ...data, tasks: data.tasks.filter(t => ids.has(t.id)), timeEntries: (data.timeEntries || []).filter(e => ids.has(e.taskId)) } : data;
  const options = { dayStartMinutes, projectIds: [], habitMode: "include" as const, completion: "all" as const };
  const allocation = buildTimeAllocationMetrics({ data: filtered, range: { preset: "custom" }, rangeOverride: { preset: "custom", start: new Date(from), end: new Date(to), label: "" }, ...options });
  return projectActivityFacts(allocation, buildInsights(filtered, allocation, options).trackedEntries);
}
