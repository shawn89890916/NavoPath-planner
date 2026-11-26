import { describe, expect, it } from "vitest";
import type { PlannerData, Task } from "../types";
import { diffAnalyticsEvents, makeTimerAnalyticsEvent } from "./activityEvents";
import { buildTimeAllocationMetrics } from "./timeAllocation";
import { buildInsights, metricDay } from "./insightFacts";
import { buildObservedPlanHistory } from "./historyAnalysis";
import { normalizeSavedViews } from "./savedViews";
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


describe("observed schedule history",()=>{
 it("does not invent an initial plan for an existing record and counts moves independently from resizes",()=>{
  const next={...data,tasks:[{...task,timelineRecords:[{...task.timelineRecords![0],scheduledStart:"10:00",scheduledEnd:"11:00"}]}]};
  const events=diffAnalyticsEvents(data,next,"2026-11-26T00:10:00Z","change");
  const r=buildObservedPlanHistory(events,next,{start:new Date("2026-11-26"),end:new Date("2026-11-27")});
  expect(r.moveCount).toBe(1);expect(r.resizeCount).toBe(0);expect(r.comparisons).toEqual([]);
 });
 it("validates persisted view configuration",()=>{expect(normalizeSavedViews([{id:"bad",name:"broken"}])).toEqual([]);});
});


describe("event provenance",()=>{
 it("preserves explicit sources without fabricating remote initial estimates",()=>{
  const events=diffAnalyticsEvents({...data,tasks:[]},data,"2026-11-26T00:00:00Z","remote:9","remote-observed");
  expect(events.every(e=>e.source==="remote-observed")).toBe(true);expect(events.find(e=>e.entityType==="execution")?.estimateMinutes).toBeUndefined();
  expect(buildObservedPlanHistory(events,data,{start:new Date("2026-11-26"),end:new Date("2026-11-27")}).observedExecutions).toBe(0);
 });
 it("represents idle pause as a system transition and never includes task text",()=>{
  const e=makeTimerAnalyticsEvent("t","idle-pause","2026-11-26T00:00:00Z",12,"op");expect(e).toMatchObject({source:"system",entityType:"timer",after:{transition:"idle-pause",elapsedSeconds:12}});
 });
});

import { buildPlanBaseline, comparePlanBaseline } from "./planBaseline";
describe("daily first-observed plans",()=>{
 it("captures a configured day without task titles or retroactive claims",()=>{const at=new Date(2026,10,26,10,0);const p=buildPlanBaseline(data,at,"04:00");expect(p.date).toBe("2026-11-26");expect(p.capturedAt).toBe(at.toISOString());expect(p.rows).toHaveLength(1);expect(JSON.stringify(p)).not.toContain("secret");const a=buildTimeAllocationMetrics({data,range:{preset:"today",anchorDate:"2026-11-26"},dayStartMinutes:240});expect(comparePlanBaseline(p,a.taskEntries,{projects:[],habit:"include",completion:"all"})).toMatchObject({baselineMinutes:60,currentMinutes:60,addedMinutes:0});});
});

describe("extended metrics facts",()=>{
 it("reports cancelled separately and only links explicit measured execution IDs",()=>{const t={...task,timelineRecords:[task.timelineRecords![0],{...task.timelineRecords![0],id:"cancel",executionStatus:"cancelled" as const}]};const d={...data,tasks:[t],timeEntries:[{id:"te",taskId:"t",timelineRecordId:"r",startAt:new Date(2026,10,26,9).toISOString(),endAt:new Date(2026,10,26,10).toISOString(),durationMinutes:40,source:"manual" as const,createdAt:"",updatedAt:""}]};const a=buildTimeAllocationMetrics({data:d,range:{preset:"today",anchorDate:"2026-11-26"}});const r=buildInsights(d,a,{dayStartMinutes:0,projectIds:[],habitMode:"include",completion:"all"});expect(r.statuses.cancelled).toBe(1);expect(r.measurementCoverage).toBe(100);expect(r.trackedBySource.manual).toBe(40);expect(r.occupied).toBe(60);});
 it("uses finite recorded extent for all, without unobserved recurring projections",()=>{const t={...task,recurrence:{mode:"scheduled" as const,frequency:"daily" as const,startDate:"2026-01-01",startTime:"09:00",durationMinutes:60}};const a=buildTimeAllocationMetrics({data:{...data,tasks:[t]},range:{preset:"all",anchorDate:"2026-11-26"}});expect(a.taskEntries).toHaveLength(1);expect((a.range.end.getTime()-a.range.start.getTime())/86400000).toBe(1);});
});

import {matchedPeriods,accuracySummary,currentProjectProgress} from "./reviewMetrics";
describe("review metrics",()=>{
 it("matches elapsed current and preceding windows without including the future",()=>{const start=new Date(2026,10,26,4),end=new Date(2026,10,27,4),at=new Date(2026,10,26,10);const r=matchedPeriods({preset:"today",start,end,label:""},at)!;expect(r.partial).toBe(true);expect(r.previous.start).toEqual(new Date(2026,10,25,4));expect(r.previous.end).toEqual(new Date(2026,10,25,10));expect(r.current.end).toEqual(at);expect(matchedPeriods({preset:"all",start,end,label:""},at)).toBeNull();});
 it("preserves orphaned tracked time and leaves unknown completion out of completion filters",()=>{const d={...data,tasks:[],timeEntries:[{id:"te",taskId:"deleted",projectId:"old",startAt:new Date(2026,10,26,9).toISOString(),endAt:new Date(2026,10,26,10).toISOString(),durationMinutes:35,source:"manual" as const,createdAt:"",updatedAt:""}]};const a=buildTimeAllocationMetrics({data:d,range:{preset:"today",anchorDate:"2026-11-26"}});const opts={dayStartMinutes:0,projectIds:["old"],habitMode:"include" as const,completion:"all" as const};expect(buildInsights(d,a,opts).tracked).toBe(35);expect(buildInsights(d,a,{...opts,completion:"incomplete"}).trackedSessions).toBe(0);});
 it("keeps missing estimates out of error denominators and reports signed bias",()=>{const r=accuracySummary([{initial:60,tracked:90,estimate:null},{initial:60,tracked:30,estimate:60}]);expect(r.schedule).toMatchObject({count:2,bias:0,mae:30,relativeError:50});expect(r.estimate).toMatchObject({count:1,bias:-30,mae:30});});
 it("counts current project task completion independently of repeated executions",()=>{const r=currentProjectProgress({...data,tasks:[{...task,estimatedHours:2,completed:true}]},[],"include");expect(r[0]).toMatchObject({total:1,completed:1,estimated:120,estimatedCompleted:120,estimateCount:1});});
});
