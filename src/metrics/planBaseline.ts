import type { PlannerData } from "../types";
import { buildTimeAllocationMetrics, parseDayStartMinutes } from "./timeAllocation";
export type PlanBaselineRow = {taskId:string;recordId:string;projectId:string;minutes:number;habit:boolean;status:"completed"|"pending";startAt:string;endAt:string};
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
  return {...id,capturedAt:at.toISOString(),rows:allocation.taskEntries.map(e=>({taskId:e.taskId,recordId:e.recordId,projectId:e.projectId||"__unassigned__",minutes:e.durationMinutes,habit:Boolean(e.isHabit),status:e.completed?"completed":"pending",startAt:e.scheduledStart.toISOString(),endAt:e.scheduledEnd.toISOString()}))};
}
export function comparePlanBaseline(plan:PlanBaseline,entries:{taskId:string;recordId:string;durationMinutes:number;scheduledStart:Date;scheduledEnd:Date;completed:boolean;projectId?:string|null;isHabit?:boolean}[],options:{projects:string[];habit:"include"|"only"|"exclude";completion:"all"|"completed"|"incomplete"}) {
  const selected=new Set(options.projects);
  const include=(projectId:string,habit:boolean,completed:boolean)=>(!selected.size||selected.has(projectId))&&(options.habit==="include"||(options.habit==="only")===habit)&&(options.completion==="all"||(options.completion==="completed")===completed);
  const baseline=plan.rows.filter(r=>include(r.projectId,r.habit,r.status==="completed"));
  const ids=new Set(plan.rows.map(r=>r.taskId+":"+r.recordId));
  const start=Date.parse(plan.dayStartAt),end=Date.parse(plan.dayEndAt);
  let current=0,lateAdded=0,completed=0;
  for(const e of entries){
    if(!include(e.projectId||"__unassigned__",Boolean(e.isHabit),e.completed))continue;
    const m=Math.max(0,(Math.min(end,e.scheduledEnd.getTime())-Math.max(start,e.scheduledStart.getTime()))/60000);
    if(!m)continue;current+=m;if(e.completed)completed+=m;if(!ids.has(e.taskId+":"+e.recordId))lateAdded+=m;
  }
  return {baselineMinutes:baseline.reduce((a,b)=>a+b.minutes,0),currentMinutes:current,completedMinutes:completed,addedMinutes:lateAdded};
}
