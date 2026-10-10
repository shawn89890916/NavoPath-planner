import type { Task, TimelineRecord } from "../../src/types.ts";
import { engagementFor, engagementMinutes, engagementPatch } from "../../src/utils/engagement.ts";
import { timelineRecordDurationMinutes } from "../../src/utils/timelineRecords.ts";

export function canRateEngagement(task: Task, record?: TimelineRecord | null) {
  return record
    ? record.executionStatus === "completed" || task.completed && record.executionStatus === "scheduled"
    : task.completed;
}

export function setEngagement(task: Task, score: number, recordId?: string): Partial<Task> {
  if (!Number.isInteger(score) || score < 10 || score > 100 || score % 10 !== 0) throw new Error("Engagement must be 10–100 in steps of 10");
  const record = recordId ? task.timelineRecords?.find((item) => item.id === recordId) : undefined;
  if (recordId && !record) throw new Error("Execution record not found on this task");
  if (!recordId && task.timelineRecords?.length) throw new Error("recordId is required for tasks with execution records");
  if (!canRateEngagement(task, record)) throw new Error("Only completed executions can be rated");
  return engagementPatch(task, score, record);
}

export function listEngagement(tasks: Task[], enabled: boolean, filters: { taskId?: string; projectId?: string; from?: string; to?: string; offset?: number; limit?: number } = {}) {
  if (filters.from && filters.to && filters.from > filters.to) throw new Error("from must be on or before to");
  const entries = tasks
    .filter((task) => (!filters.taskId || task.id === filters.taskId) && (!filters.projectId || task.projectId === filters.projectId))
    .flatMap((task) => {
      const records = task.timelineRecords?.length ? task.timelineRecords : [null];
      return records.filter((record) => canRateEngagement(task, record)).map((record) => {
        const date = record?.scheduledDate || task.completedAt?.slice(0, 10) || task.scheduledDate || null;
        const duration = record?.scheduledStart ? timelineRecordDurationMinutes(record) : (task.estimatedHours || .5) * 60;
        const durationMinutes = Number.isFinite(duration) ? Math.max(0, duration) : 0;
        const score = engagementFor(task, record);
        return { taskId: task.id, title: task.title, projectId: task.projectId, recordId: record?.id || null, date, startTime: record?.scheduledStart || null,
          engagement: score, explicitlyRated: typeof (record ? record.engagement : task.engagement) === "number", durationMinutes,
          engagedMinutes: engagementMinutes(durationMinutes, score), statisticsMinutes: enabled ? engagementMinutes(durationMinutes, score) : durationMinutes };
      });
    })
    // Date filters select executions by their start date; do not invent dates for unscheduled tasks.
    .filter((entry) => (!filters.from || entry.date !== null && entry.date >= filters.from) && (!filters.to || entry.date !== null && entry.date <= filters.to))
    .sort((a, b) => (a.date || "").localeCompare(b.date || "") || (a.startTime || "").localeCompare(b.startTime || "") || a.taskId.localeCompare(b.taskId));
  const durationMinutes = entries.reduce((sum, entry) => sum + entry.durationMinutes, 0);
  const engagedMinutes = entries.reduce((sum, entry) => sum + entry.engagedMinutes, 0);
  const offset = filters.offset ?? 0;
  const limit = filters.limit ?? 100;
  return { enabled, defaultEngagement: 80, dateBasis: "execution_start_date", summary: {
    executions: entries.length, explicitlyRated: entries.filter((entry) => entry.explicitlyRated).length, durationMinutes, engagedMinutes,
    statisticsMinutes: enabled ? engagedMinutes : durationMinutes,
    durationWeightedEngagement: durationMinutes ? Math.round(engagedMinutes / durationMinutes * 1000) / 10 : null,
  }, entries: entries.slice(offset, offset + limit), nextOffset: offset + limit < entries.length ? offset + limit : null };
}
