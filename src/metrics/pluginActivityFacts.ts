import type { PlannerData } from "../types";
import type { V2ActivityFacts, V2ActivityQuery } from "../extensions/sdkV2";
import { V2ContractError } from "../extensions/runtimeV2";
import { buildTimeAllocationMetrics, type TimeAllocationMetrics } from "./timeAllocation";
import { buildInsights } from "./insightFacts";
import { engagementMinutes } from "../utils/engagement";

type Tracked = ReturnType<typeof buildInsights>["trackedEntries"];

/** Project only concrete scheduled intervals and measured time, never projected
 * recurrences, all-day estimates or engagement-weighted time as actual time.
 * Segments split by metric day get stable, distinct IDs. */
export function projectActivityFacts(allocation: TimeAllocationMetrics, tracked: Tracked, data?: PlannerData, engagementEnabled = false): V2ActivityFacts {
  const tasks = engagementEnabled && data ? new Map(data.tasks.map(task => [task.id, task])) : undefined;
  return {
    planned: allocation.taskEntries.filter(e => !e.isEstimatedAllDay && !e.isProjectedRecurrence).map(e => ({
      id: JSON.stringify([e.taskId, e.recordId, e.scheduledStart.toISOString()]),
      taskId: e.taskId, start: e.scheduledStart.toISOString(), end: e.scheduledEnd.toISOString(),
      minutes: (e.scheduledEnd.getTime() - e.scheduledStart.getTime()) / 60000,
      ...(engagementEnabled && e.engagement !== undefined ? { weightedMinutes: engagementMinutes((e.scheduledEnd.getTime() - e.scheduledStart.getTime()) / 60000, e.engagement) } : {}),
    })),
    actual: tracked.map(e => {
      const task = tasks?.get(e.taskId), record = task?.timelineRecords?.find(item => item.id === e.recordId);
      return { id: e.id, taskId: e.taskId, start: e.start.toISOString(), end: e.end.toISOString(), minutes: e.minutes,
        ...(engagementEnabled ? { weightedMinutes: engagementMinutes(e.minutes, record ? record.engagement : task?.engagement) } : {}) };
    }),
  };
}

const timestamp = (value: unknown) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? Date.parse(value) : NaN;

export function queryPluginActivity(data: PlannerData, query: V2ActivityQuery, dayStartMinutes: number, engagementEnabled = false): V2ActivityFacts {
  if (!query || typeof query !== "object") throw new V2ContractError("INVALID_INPUT", "Invalid activity query");
  const all = "range" in query && query.range === "all";
  const from = timestamp("from" in query ? query.from : undefined), to = timestamp("to" in query ? query.to : undefined);
  if ((!all && (!Number.isFinite(from) || !Number.isFinite(to) || to <= from || to - from > 366 * 86400000)) ||
      (query.taskIds !== undefined && (!Array.isArray(query.taskIds) || query.taskIds.length > 10000 || query.taskIds.some(id => typeof id !== "string")))) {
    throw new V2ContractError("INVALID_INPUT", "Expected an ISO interval of at most 366 days or all recorded activity, and optional task IDs");
  }
  const ids = query.taskIds === undefined ? undefined : new Set(query.taskIds);
  const filtered = ids ? { ...data, tasks: data.tasks.filter(t => ids.has(t.id)), timeEntries: (data.timeEntries || []).filter(e => ids.has(e.taskId)) } : data;
  const options = { dayStartMinutes, projectIds: [], habitMode: "include" as const, completion: "all" as const };
  const allocation = buildTimeAllocationMetrics({ data: filtered, range: { preset: all ? "all" : "custom" }, rangeOverride: all ? undefined : { preset: "custom", start: new Date(from), end: new Date(to), label: "" }, engagementEnabled, ...options });
  return projectActivityFacts(allocation, buildInsights(filtered, allocation, options).trackedEntries, filtered, engagementEnabled);
}
