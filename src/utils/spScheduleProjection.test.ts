import { describe, expect, it } from "vitest";
import { selectTimedSlot, durationMinutes, hasRecordedTimedSlot, isReadOnlyHistoryNote } from "../../community-plugins/super-productivity-sync/schedule";
import type { Task, TimelineRecord } from "../types";
const rec = (patch: Partial<TimelineRecord> = {}): TimelineRecord => ({
 id:"slot",taskId:"task",scheduledDate:"2026-11-26",scheduledStart:"09:00",scheduledEnd:"10:00",executionStatus:"scheduled",createdAt:"2026-11-26T00:00:00Z",...patch
});
const task = (patch: Partial<Task> = {}) => ({id:"task",title:"Task",createdAt:"2026-11-26T00:00:00Z",completed:false,...patch}) as Task;
describe("SP timed timeline projection",()=>{
 it("ignores all-day and historical slots without blocking a timed task",()=>{
  const slot=rec({id:"timed"});
  expect(selectTimedSlot(task({timelineRecords:[rec({id:"all-day",scheduledStart:"",scheduledEnd:""}),rec({id:"history",executionStatus:"completed"}),slot]}))?.record).toEqual(slot);
 });
 it("projects legacy schedules crossing midnight",()=>{
  const result=selectTimedSlot(task({scheduledDate:"2026-11-26",scheduledStart:"23:30",scheduledEnd:"00:15",timelineRecords:[rec({executionStatus:"completed"})]}))!;
  expect(result.index).toBe(-1);expect(durationMinutes(result.record)).toBe(45);
 });
 it("uses actual dated cross-midnight duration and rejects cancelled legacy slots",()=>{
  expect(durationMinutes(rec({scheduledStart:"23:30",scheduledEnd:"01:00",scheduledEndDate:"2026-11-27"}))).toBe(90);
  expect(selectTimedSlot(task({scheduledDate:"2026-11-26",scheduledStart:"10:30",scheduledEnd:"11:00",executionStatus:"cancelled"}))).toBeUndefined();
 });
});

describe("SP schedule replay after execution", () => {
 it("recognizes a returned or completed slot without reopening it across 1000 replays", () => {
  for (const executionStatus of ["returned_unfinished", "completed"] as const) {
   const records = [rec({executionStatus})];
   const item = task({timelineRecords:records});
   for(let i=0;i<1000;i++){
    expect(selectTimedSlot(item)).toBeUndefined();
    if (!hasRecordedTimedSlot(item,"2026-11-26","09:00",60)) records.push(rec({id:"duplicate"}));
   }
   expect(records).toHaveLength(1);
   expect(records[0].executionStatus).toBe(executionStatus);
  }
 });
 it("does not block a different date, duration, or a cancelled execution", () => {
  const item=task({timelineRecords:[rec({executionStatus:"returned_unfinished"})]});
  expect(hasRecordedTimedSlot(item,"2026-11-27","09:00",60)).toBe(false);
  expect(hasRecordedTimedSlot(item,"2026-11-26","09:00",30)).toBe(false);
  expect(hasRecordedTimedSlot(task({timelineRecords:[rec({executionStatus:"cancelled"})]}),"2026-11-26","09:00",60)).toBe(false);
 });
});

describe("read-only calendar marker", () => {
 it("recognizes feed notes without matching a task title or arbitrary text", () => {
  expect(isReadOnlyHistoryNote("NavoPath · Completed · Read-only timeline record")).toBe(true);
  expect(isReadOnlyHistoryNote("NavoPath · Returned unfinished · Read-only timeline record")).toBe(true);
  expect(isReadOnlyHistoryNote("✓ My task")).toBe(false);
  expect(isReadOnlyHistoryNote("NavoPath · Completed · Read-only timeline record with my extra note")).toBe(false);
 });
});
