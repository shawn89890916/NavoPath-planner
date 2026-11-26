import { describe, expect, it } from "vitest";
import type { PlannerData, Task } from "../types";
import { diffAnalyticsEvents } from "./activityEvents";
import { buildTimeAllocationMetrics } from "./timeAllocation";
import { buildInsights, metricDay } from "./insightFacts";
const task:Task={id:"t",title:"secret",notes:"private",dueDate:"",category:"personal",priority:null,goalId:"",completed:false,createdAt:"2026-11-26T00:00:00Z",updatedAt:"2026-11-26T00:00:00Z",timelineRecords:[{id:"r",taskId:"t",scheduledDate:"2026-11-26",scheduledStart:"09:00",scheduledEnd:"10:00",executionStatus:"scheduled",createdAt:"2026-11-26T00:00:00Z"}]};
const data:PlannerData={version:1,importedSeedVersion:"",generatedAt:"",goals:[],projects:[],tasks:[task],longTasks:[],events:[],notes:[],drafts:[],chat:[],aiMemories:[]};
describe("local analytics events",()=>{
 it("records schedule edits, not text changes or no-op saves",()=>{
  const next={...data,tasks:[{...task,title:"another private title",timelineRecords:[{...task.timelineRecords![0],scheduledStart:"10:00",scheduledEnd:"11:00"}]}]};
  const events=diffAnalyticsEvents(data,next,"2026-11-26T00:10:00Z","op");
  expect(events).toHaveLength(1);expect(events[0]).toMatchObject({entityType:"execution",action:"changed",before:{scheduledStart:"09:00"},after:{scheduledStart:"10:00"}});
  expect(JSON.stringify(events)).not.toContain("private");expect(diffAnalyticsEvents(next,next,"now","op2")).toHaveLength(0);
 });
 it("records task removal and independent execution removal",()=>{expect(diffAnalyticsEvents(data,{...data,tasks:[]},"now","op").map(e=>e.entityType)).toEqual(["task","execution"]);});
});
describe("metrics insights",()=>{
 it("keeps raw time and explicit ratings distinct; counts independent executions",()=>{
  const completed={...task,completed:true,timelineRecords:[{...task.timelineRecords![0],executionStatus:"completed" as const,engagement:50},{...task.timelineRecords![0],id:"r2",scheduledStart:"11:00",scheduledEnd:"12:00",executionStatus:"scheduled" as const}]};
  const d={...data,tasks:[completed]}; const a=buildTimeAllocationMetrics({data:d,range:{preset:"today",anchorDate:"2026-11-26"},engagementEnabled:true});
  const r=buildInsights(d,a,{dayStartMinutes:0,projectIds:[],habitMode:"include",completion:"all"});
  expect(r.scheduled).toBe(120);expect(r.completed).toBe(60);expect(r.executionCount).toBe(2);expect(r.explicitEngagement).toBe(50);expect(r.ratingCoverage).toBe(100);expect(r.trackedSessions).toBe(0);
 });
 it("uses configured day boundary before midnight",()=>{expect(metricDay(new Date(2026,10,27,2,0),240)).toBe("2026-11-26");});
});
