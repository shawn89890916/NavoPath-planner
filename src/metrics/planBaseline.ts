import type { PlannerData } from "../types";
import { buildTimeAllocationMetrics, parseDayStartMinutes } from "./timeAllocation";
export type PlanBaselineRow = {taskId:string;recordId:string;projectId:string;minutes:number;habit:boolean;status:"completed"|"pending";startAt:string;endAt:string;projected?:boolean};
export type PlanBaseline = {id:string;date:string;capturedAt:string;dayStartAt:string;dayEndAt:string;timezone:string;dayStartMinutes:number;rows:PlanBaselineRow[]};
export function baselineIdentity(at:Date,dayStartTime?:string) {
  const dayStartMinutes=parseDayStartMinutes(dayStartTime);
  const day=new Date(at);day.setHours(Math.floor(dayStartMinutes/60),dayStartMinutes%60,0,0);
  if(day>at)day.setDate(day.getDate()-1);
  const end=new Date(day);end.setDate(end.getDate()+1);
  const date=[day.getFullYear(),String(day.getMonth()+1).padStart(2,"0"),String(day.getDate()).padStart(2,"0")].join("-");
  const timezone=Intl.DateTimeFormat().resolvedOptions().timeZone;
  return {id:date+":"+timezone+":"+dayStartMinutes,date,dayStartAt:day.toISOString(),dayEndAt:end.toISOString(),timezone,dayStartMinutes};
}
export function buildPlanBaseline(data:PlannerData,at:Date,dayStartTime?:string):PlanBaseline {
  const id=baselineIdentity(at,dayStartTime);
  const allocation=buildTimeAllocationMetrics({data,range:{preset:"today",anchorDate:id.date},dayStartMinutes:id.dayStartMinutes,engagementEnabled:false});
  return {...id,capturedAt:at.toISOString(),rows:allocation.taskEntries.map(e=>({taskId:e.taskId,recordId:e.recordId,projectId:e.projectId||"__unassigned__",minutes:e.durationMinutes,habit:Boolean(e.isHabit),projected:Boolean(e.isProjectedRecurrence),status:e.completed?"completed":"pending",startAt:e.scheduledStart.toISOString(),endAt:e.scheduledEnd.toISOString()}))};
}
type BaselineEntry={taskId:string;recordId:string;durationMinutes:number;scheduledStart:Date;scheduledEnd:Date;completed:boolean;projectId?:string|null;isHabit?:boolean;isProjectedRecurrence?:boolean};
type BaselineOptions={projects:string[];habit:"include"|"only"|"exclude";completion:"all"|"completed"|"incomplete"};
const identity=(taskId:string,recordId:string)=>JSON.stringify([taskId,recordId]);
/** Compare captured and current membership inside the same day, not inferred historical execution. */
export function comparePlanBaseline(plan:PlanBaseline,entries:BaselineEntry[],options:BaselineOptions) {
  const selected=new Set(options.projects);
  const include=(projectId:string,habit:boolean,completed:boolean)=>(!selected.size||selected.has(projectId))&&(options.habit==="include"||(options.habit==="only")===habit)&&(options.completion==="all"||(options.completion==="completed")===completed);
  const baseline=plan.rows.filter(r=>include(r.projectId,r.habit,r.status==="completed"));
  const ids=new Set(plan.rows.map(r=>identity(r.taskId,r.recordId))),selectedIds=new Set(baseline.map(r=>identity(r.taskId,r.recordId)));
  const start=Date.parse(plan.dayStartAt),end=Date.parse(plan.dayEndAt);
  const seen=new Set<string>(),done=new Set<string>();
  let current=0,lateAdded=0,completed=0,retainedMinutes=0,enteredScopeMinutes=0;
  for(const e of entries){
    if(!include(e.projectId||"__unassigned__",Boolean(e.isHabit),e.completed))continue;
    const m=Math.max(0,(Math.min(end,e.scheduledEnd.getTime())-Math.max(start,e.scheduledStart.getTime()))/60000);
    if(!m)continue;
    const key=identity(e.taskId,e.recordId);
    current+=m;if(e.completed)completed+=m;
    if(!ids.has(key))lateAdded+=m;
    else if(!selectedIds.has(key))enteredScopeMinutes+=m;
    else retainedMinutes+=m;
    seen.add(key);if(e.completed&&!e.isProjectedRecurrence)done.add(key);
  }
  const pending=new Set(baseline.filter(r=>r.status==="pending"&&r.projected===false).map(r=>identity(r.taskId,r.recordId)));
  // Older snapshots cannot distinguish projections explicitly. Leave the cohort unknown.
  const cohortKnown=options.completion==="all"&&baseline.every(r=>typeof r.projected==="boolean");
  let completedPending=0,absent=0;
  for(const key of selectedIds)if(!seen.has(key))absent++;
  if(cohortKnown)for(const key of pending)if(done.has(key))completedPending++;
  return {baselineMinutes:baseline.reduce((a,b)=>a+b.minutes,0),currentMinutes:current,completedMinutes:completed,addedMinutes:lateAdded,enteredScopeMinutes,retainedMinutes,baselineExecutions:selectedIds.size,absentExecutions:absent,pendingExecutions:cohortKnown?pending.size:null,completedPending:cohortKnown?completedPending:null};
}
