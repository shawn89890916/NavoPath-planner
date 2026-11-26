import { describe, expect, it } from "vitest";
import { selectTimedSlot, durationMinutes } from "../../community-plugins/super-productivity-sync/schedule";
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
