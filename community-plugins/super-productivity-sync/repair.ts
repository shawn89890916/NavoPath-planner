import type { PlannerData, Task, TimelineRecord } from "../../src/types";
import { durationMinutes, isReadOnlyHistoryNote, validSlot } from "./schedule";

type RepairData = Pick<PlannerData, "tasks" | "timeEntries">;
const key = (r: TimelineRecord) => validSlot(r.scheduledDate,r.scheduledStart) && durationMinutes(r)>0
  ? JSON.stringify([r.scheduledDate,r.scheduledStart,durationMinutes(r)]) : "";

// Only propose obvious replay artifacts. Never remove an edited, timed,
// rated, linked, recurring or otherwise ambiguous task automatically.
export function planHistoryRepair(data: RepairData) {
  const candidates: Task[] = [], blocked: Task[] = [];
  const history = data.tasks.filter(t => isReadOnlyHistoryNote(t.notes));
  const regular = data.tasks.filter(t => !isReadOnlyHistoryNote(t.notes));
  const sourceSlots = new Map<string, Set<string>>();
  for (const t of regular) {
    for (const r of t.timelineRecords || []) {
      const slot=key(r);
      if (!slot || r.executionStatus === "scheduled" || r.executionStatus === "cancelled") continue;
      const k=JSON.stringify([t.title,slot]);
      const sources=sourceSlots.get(k) || new Set<string>(); sources.add(t.id); sourceSlots.set(k,sources);
    }
  }
  for (const t of history) {
    const records=t.timelineRecords || [], slot=records.length ? key(records[0]) : "";
    const title=t.title.replace(/^✓\s+/, "");
    const sources=sourceSlots.get(JSON.stringify([title,slot]));
    const recordIds=new Set(records.map(r=>r.id));
    const protectedTask=t.completed || t.completedAt || t.parentTaskId || t.subtasks?.length || t.caldav || t.fixedCourse || t.recurrence || t.goalId || t.dueDate || t.scheduleLocked || t.hardDeadline || t.engagement != null || t.scheduledDate || t.scheduledStart || t.scheduledEnd ||
      data.tasks.some(other=>other.parentTaskId===t.id) ||
      data.timeEntries?.some(entry=>entry.taskId===t.id || (entry.timelineRecordId && recordIds.has(entry.timelineRecordId)));
    const safe=!protectedTask && records.length>=2 && !!slot && sources?.size===1 &&
      records.every(r=>r.taskId===t.id && r.executionStatus==="returned_unfinished" && r.engagement==null && key(r)===slot);
    (safe ? candidates : blocked).push(t);
  }
  return { candidates, blocked, recordCount:candidates.reduce((n,t)=>n+(t.timelineRecords?.length||0),0) };
}
