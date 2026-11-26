import { describe, expect, it } from "vitest";
import type { PlannerData, Task } from "../types";
import { diffAnalyticsEvents, makeTimerAnalyticsEvent } from "./activityEvents";
import { buildTimeAllocationMetrics } from "./timeAllocation";
import { buildInsights, metricDay } from "./insightFacts";
import { buildObservedPlanHistory, createObservedPlanAccumulator } from "./historyAnalysis";
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

it("restores the optional chart grain, while migrating older saved views to day",()=>{const query={range:"today",group:"project",display:"duration",habit:"include",completion:"all",projects:[],customStart:"2026-11-26",customEnd:"2026-11-26"};const saved={id:"one",name:"Review",view:"overview",chart:"trend",query};expect(normalizeSavedViews([saved])[0].grain).toBe("day");expect(normalizeSavedViews([{...saved,grain:"month"}])[0].grain).toBe("month");});

import {timeBuckets,overlapMinutes} from "./timeSeries";
it("preserves missing calendar days and keeps absent measurements distinct",()=>{const range={preset:"custom" as const,start:new Date(2026,10,23,4),end:new Date(2026,10,27,4),label:""};const r=timeBuckets([{date:"2026-11-24",scheduled:60,completed:30,tracked:0,trackedSessions:0}],range,"day",240,1);expect(r.rows.map(x=>x.date)).toEqual(["2026-11-23","2026-11-24","2026-11-25","2026-11-26"]);expect(r.rows[0].hasRecords).toBe(false);expect(r.rows[1]).toMatchObject({hasRecords:true,trackedSessions:0,scheduled:60});expect(timeBuckets([],range,"day",240,1,2).truncated).toBe(true);expect(overlapMinutes(new Date(2026,10,23,3),new Date(2026,10,23,5),range.start,range.end)).toBe(60);});

it("excludes estimated all-day work from timed occupancy and hourly distribution",()=>{const t={...task,estimatedHours:1,completed:true,timelineRecords:[{...task.timelineRecords![0],scheduledStart:"",scheduledEnd:"",executionStatus:"completed" as const}]};const d={...data,tasks:[t]};const a=buildTimeAllocationMetrics({data:d,range:{preset:"today",anchorDate:"2026-11-26"}});const r=buildInsights(d,a,{dayStartMinutes:0,projectIds:[],habitMode:"include",completion:"all"});expect(a.taskEntries[0].isEstimatedAllDay).toBe(true);expect(r.scheduled).toBe(60);expect(r.allDayEstimated).toBe(60);expect(r.occupied).toBe(0);expect(r.completedHours.flat().reduce((n,v)=>n+v,0)).toBe(0);});
it("includes projected recurrence on both calendar sides of a shifted day boundary",()=>{const t={...task,timelineRecords:[],recurrence:{mode:"scheduled" as const,frequency:"daily" as const,startDate:"2026-11-24",startTime:"02:00",durationMinutes:60}};const d={...data,tasks:[t]};const a=buildTimeAllocationMetrics({data:d,range:{preset:"today",anchorDate:"2026-11-26"},dayStartMinutes:240});expect(a.taskEntries).toHaveLength(1);expect(a.taskEntries[0].scheduledStart).toEqual(new Date(2026,10,27,2));expect(a.taskEntries[0].isProjectedRecurrence).toBe(true);const r=buildInsights(d,a,{dayStartMinutes:240,projectIds:[],habitMode:"include",completion:"all"});expect(r.projectedScheduled).toBe(60);expect(r.measurementCoverage).toBeNull();});


describe("large observed history and conservative provenance",()=>{
 const range={start:new Date("2026-11-26T00:00:00Z"),end:new Date("2026-11-27T00:00:00Z")};
 const before={scheduledDate:"2026-11-26",scheduledStart:"09:00",scheduledEnd:"10:00",executionStatus:"scheduled"};
 const moved={...before,scheduledStart:"10:00",scheduledEnd:"11:00"};
 const done={...moved,executionStatus:"completed"};
 function event(taskId:string,entityId:string,n:number,source:import("./activityEvents").AnalyticsSource="client"):import("./activityEvents").AnalyticsEvent {
  const at="2026-11-26T0"+n+":00:00Z";
  return {id:JSON.stringify([taskId,entityId,n,source]),schemaVersion:1,operationId:"op-"+n,entityType:"execution",entityId,taskId,occurredAt:at,source,action:n===0?"created":"changed",before:n===0?undefined:n===1?before:moved,after:n===0?before:n===1?moved:done,estimateMinutes:n===0?45:undefined};
 }
 function completedTask(id:string,recordId:string):Task{return {...task,id,timelineRecords:[{...task.timelineRecords![0],id:recordId,taskId:id,executionStatus:"completed"}]};}
 function timeEntry(taskId:string,recordId:string){return {id:JSON.stringify([taskId,recordId]),taskId,timelineRecordId:recordId,startAt:"2026-11-26T10:00:00Z",endAt:"2026-11-26T11:00:00Z",durationMinutes:50,source:"manual" as const,createdAt:"",updatedAt:""};}
 it("handles out-of-order history and record identifiers containing separators",()=>{
  const a=completedTask("a:b","c"),b=completedTask("a","b:c");
  const d={...data,tasks:[a,b],timeEntries:[timeEntry(a.id,"c"),timeEntry(b.id,"b:c")]};
  const es=[event(a.id,"c",2),event(b.id,"b:c",2),event(a.id,"c",0),event(b.id,"b:c",0),event(a.id,"c",1),event(b.id,"b:c",1)];
  const r=buildObservedPlanHistory(es,d,range);
  expect(r.movedExecutions).toBe(2);expect(r.comparisons).toHaveLength(2);expect(r.comparisons.every(x=>x.initial===60&&x.tracked===50&&x.estimate===45)).toBe(true);
 });
 it("does not count sync replay as local moves or complete a comparison across unknown provenance",()=>{
  const d={...data,tasks:[completedTask("t","r")],timeEntries:[timeEntry("t","r")]};
  const r=buildObservedPlanHistory([event("t","r",0),event("t","r",1,"sync"),event("t","r",2)],d,range);
  expect(r.moveCount).toBe(0);expect(r.observedExecutions).toBe(1);expect(r.comparisons).toEqual([]);
  expect(buildObservedPlanHistory([event("t","r",0,"sync")],d,range).observedExecutions).toBe(0);
 });
 it("streams the entire range beyond 500 events without dropping the original creation",()=>{
  const d={...data,tasks:[completedTask("t","r")],timeEntries:[timeEntry("t","r")]};
  const first=event("t","r",0),last=event("t","r",2);
  const events=[last,...Array.from({length:750},(_,i)=>({...event("t","r",1),id:"edit-"+i,after:moved,before:moved})),first];
  const acc=createObservedPlanAccumulator(d,range);
  for(const e of events)acc.add(e);
  expect(acc.finish()).toEqual(buildObservedPlanHistory(events,d,range));
  expect(acc.finish()).toMatchObject({eventCount:752,created:1,comparisons:[{initial:60,tracked:50,estimate:45}]});
 });
 it("counts event-time project attribution but rejects comparisons across a filtered-out project",()=>{
  const d={...data,tasks:[completedTask("t","r")],timeEntries:[timeEntry("t","r")]};
  const acc=createObservedPlanAccumulator(d,range,["p"]);
  for(const e of [{...event("t","r",0),projectId:"p"},{...event("t","r",1),projectId:"other"},{...event("t","r",2),projectId:"p"}])acc.add(e);
  expect(acc.finish()).toMatchObject({eventCount:2,created:1,moveCount:0,observedExecutions:1,comparisons:[]});
 });
 it("aggregates 100,000 events against 25,000 independent completed records",()=>{
  const tasks:Task[]=[],events:import("./activityEvents").AnalyticsEvent[]=[],timeEntries:ReturnType<typeof timeEntry>[]=[];
  for(let i=0;i<25000;i++){
    const id="synthetic-"+i,recordId="execution-"+i;tasks.push(completedTask(id,recordId));timeEntries.push(timeEntry(id,recordId));
    for(let n=3;n>=0;n--)events.push(event(id,recordId,n));
  }
  const start=performance.now();
  const r=buildObservedPlanHistory(events,{...data,tasks,timeEntries},range);
  console.info("Metrics history 100k synthetic events:",Math.round(performance.now()-start),"ms");
  expect(r.observedExecutions).toBe(25000);expect(r.created).toBe(25000);expect(r.moveCount).toBe(25000);expect(r.comparisons).toHaveLength(25000);
 },20000);
});


import {buildEngagementBreakdown,ratingMean,ratingCoverage,projectActivityTrend} from "./engagementBreakdown";
describe("engagement and project breakdowns",()=>{
 const opts={dayStartMinutes:240,projectIds:[],habitMode:"include" as const,completion:"all" as const};
 const range={preset:"custom" as const,customStart:"2026-11-25",customEnd:"2026-11-26"};
 it("uses raw intervals instead of weighted entry duration and counts cross-day executions once",()=>{
   const t={...task,projectId:"p",timelineRecords:[
     {...task.timelineRecords![0],scheduledDate:"2026-11-26",scheduledStart:"03:00",scheduledEnd:"05:00",executionStatus:"completed" as const,engagement:50},
     {...task.timelineRecords![0],id:"r2",scheduledStart:"11:00",scheduledEnd:"12:00",executionStatus:"completed" as const}
   ]};
   const d={...data,tasks:[t]},a=buildTimeAllocationMetrics({data:d,range,dayStartMinutes:240,engagementEnabled:true});
   const r=buildEngagementBreakdown(d,a,240),baseline=buildInsights(d,a,opts);
   expect(r.overall).toMatchObject({completedMinutes:180,ratedMinutes:120,weightedMinutes:60,completedExecutions:2,ratedExecutions:1});
   expect(ratingMean(r.overall)).toBe(baseline.explicitEngagement);
   expect(ratingCoverage(r.overall)).toBeCloseTo(baseline.ratingCoverage!);
   expect(r.days.map(x=>[x.id,x.completedMinutes])).toEqual([["2026-11-25",60],["2026-11-26",120]]);
   expect(r.bands[3]).toMatchObject({completedExecutions:1,ratedMinutes:120});
   expect(r.hours[0]).toMatchObject({ratedMinutes:120,ratedExecutions:1});
   expect(ratingMean(r.hours[1])).toBeNull();
 });
 it("keeps estimated all-day work out of clock periods and leaves missing ratings unknown",()=>{
   const t={...task,completed:true,estimatedHours:1,timelineRecords:[{...task.timelineRecords![0],scheduledStart:"",scheduledEnd:"",executionStatus:"completed" as const}]};
   const d={...data,tasks:[t]},a=buildTimeAllocationMetrics({data:d,range,dayStartMinutes:240,engagementEnabled:true});
   const r=buildEngagementBreakdown(d,a,240);
   expect(r.overall.completedMinutes).toBe(60);expect(ratingMean(r.overall)).toBeNull();expect(ratingCoverage(r.overall)).toBe(0);
   expect(r.hours.every(x=>x.completedMinutes===0&&ratingCoverage(x)===null)).toBe(true);
 });
 it("splits clock periods and preserves independent counts within each period",()=>{
   const t={...task,timelineRecords:[{...task.timelineRecords![0],scheduledStart:"05:30",scheduledEnd:"06:30",executionStatus:"completed" as const,engagement:90}]};
   const d={...data,tasks:[t]},a=buildTimeAllocationMetrics({data:d,range,dayStartMinutes:240});
   const r=buildEngagementBreakdown(d,a,240);
   expect(r.hours.slice(0,2).map(x=>[x.ratedMinutes,x.ratedExecutions])).toEqual([[30,1],[30,1]]);
   expect(r.overall.ratedExecutions).toBe(1);
 });
 it("keeps project trend raw scheduled minutes separate from apportioned tracked time",()=>{
   const t={...task,projectId:"p",timelineRecords:[{...task.timelineRecords![0],scheduledStart:"03:00",scheduledEnd:"05:00",executionStatus:"completed" as const,engagement:50}]};
   const d={...data,tasks:[t],timeEntries:[{id:"te",taskId:"t",timelineRecordId:"r",startAt:new Date(2026,10,26,3).toISOString(),endAt:new Date(2026,10,26,5).toISOString(),durationMinutes:90,source:"manual" as const,createdAt:"",updatedAt:""}]};
   const a=buildTimeAllocationMetrics({data:d,range,dayStartMinutes:240,engagementEnabled:true}),r=buildInsights(d,a,opts);
   const rows=projectActivityTrend(a,r.trackedEntries,"p",240);
   expect(rows.map(x=>[x.date,x.scheduled,x.completed,x.tracked])).toEqual([["2026-11-25",60,60,45],["2026-11-26",60,60,45]]);
   expect(projectActivityTrend(a,r.trackedEntries,"other",240)).toEqual([]);
 });
});
