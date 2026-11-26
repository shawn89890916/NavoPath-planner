import type { PlannerData } from "../types";
import { normalizeEngagement } from "../utils/engagement";
import type { TimeAllocationMetrics, MetricHabitMode, MetricCompletionFilter } from "./timeAllocation";

export type InsightOptions = { dayStartMinutes:number; projectIds:string[]; habitMode:MetricHabitMode; completion:MetricCompletionFilter };
export type DailyInsight = { date:string; scheduled:number; completed:number; tracked:number };
export function metricDay(date:Date,dayStartMinutes:number) {
  const d=new Date(date);
  if(d.getHours()*60+d.getMinutes()<dayStartMinutes)d.setDate(d.getDate()-1);
  return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
}
function intervalMinutes(start:number,end:number) { return Math.max(0,(end-start)/60000); }
function eachDay(start:number,end:number,dayStart:number,visit:(date:string,ms:number)=>void) {
  let cursor=start;
  while(cursor<end) {
    const key=metricDay(new Date(cursor),dayStart);
    const boundary=new Date(cursor); boundary.setHours(Math.floor(dayStart/60),dayStart%60,0,0);
    if(boundary.getTime()<=cursor)boundary.setDate(boundary.getDate()+1);
    const stop=Math.min(end,boundary.getTime());
    if(stop<=cursor)break;
    visit(key,stop-cursor);cursor=stop;
  }
}
/** Raw scheduled duration, tracked duration and explicit engagement are separate measures. */
export function buildInsights(data:PlannerData,allocation:TimeAllocationMetrics,options:InsightOptions) {
  const tasks=new Map(data.tasks.map(t=>[t.id,t]));
  const projectFilter=new Set(options.projectIds);
  const days=new Map<string,DailyInsight>();
  const day=(date:string)=>{let x=days.get(date);if(!x){x={date,scheduled:0,completed:0,tracked:0};days.set(date,x);}return x;};
  const executions=new Map<string,{status:string;minutes:number;score?:number}>();
  let scheduled=0,completed=0,ratedMinutes=0,ratedWeighted=0,tracked=0,trackedSessions=0;
  const statuses:Record<string,number>={scheduled:0,completed:0,returned_unfinished:0,skipped:0,cancelled:0};
  for(const entry of allocation.taskEntries){
    const t=tasks.get(entry.taskId);if(!t)continue;
    const record=t.timelineRecords?.find(r=>r.id===entry.recordId);
    const status=entry.isHabit&&entry.completed?"completed":record?.executionStatus || (entry.completed?"completed":"scheduled");
    if(options.completion==="completed"&&status!=="completed" || options.completion==="incomplete"&&status==="completed")continue;
    const score=record?record.engagement:t.engagement;
    const raw=intervalMinutes(entry.scheduledStart.getTime(),entry.scheduledEnd.getTime());
    const key=entry.taskId+":"+entry.recordId;
    const item=executions.get(key)||{status,minutes:0,score:typeof score==="number"&&Number.isFinite(score)?normalizeEngagement(score):undefined};
    item.minutes+=raw;executions.set(key,item);
    scheduled+=raw;
    if(status==="completed"){completed+=raw;if(item.score!==undefined){ratedMinutes+=raw;ratedWeighted+=raw*item.score/100;}}
    eachDay(entry.scheduledStart.getTime(),entry.scheduledEnd.getTime(),options.dayStartMinutes,(date,ms)=>{const d=day(date);d.scheduled+=ms/60000;if(status==="completed")d.completed+=ms/60000;});
  }
  for(const e of executions.values())statuses[e.status]=(statuses[e.status]||0)+1;
  const start=allocation.range.start.getTime(),end=allocation.range.end.getTime();
  for(const entry of data.timeEntries||[]){
    const task=tasks.get(entry.taskId);if(!task)continue;
    if(projectFilter.size&&!projectFilter.has(task.projectId||"__unassigned__"))continue;
    const habit=task.id.startsWith("habit-task-")||Boolean((data.habitDailyStates||[]).find(h=>h.timelineRecordId===entry.timelineRecordId&&entry.timelineRecordId));
    if(options.habitMode==="exclude"&&habit || options.habitMode==="only"&&!habit)continue;
    const record=task.timelineRecords?.find(r=>r.id===entry.timelineRecordId);
    const isCompleted=record?record.executionStatus==="completed":task.completed;
    if(options.completion==="completed"&&!isCompleted || options.completion==="incomplete"&&isCompleted)continue;
    const a=Date.parse(entry.startAt),b=Date.parse(entry.endAt);
    if(!Number.isFinite(a)||!Number.isFinite(b)||b<=a||!Number.isFinite(entry.durationMinutes)||entry.durationMinutes<=0)continue;
    const lo=Math.max(a,start),hi=Math.min(b,end);if(hi<=lo)continue;
    trackedSessions++;
    eachDay(lo,hi,options.dayStartMinutes,(date,ms)=>{const minutes=entry.durationMinutes*ms/(b-a);day(date).tracked+=minutes;tracked+=minutes;});
  }
  return {scheduled,completed,tracked,trackedSessions,executionCount:executions.size,statuses,ratedMinutes,ratedWeighted,explicitEngagement:ratedMinutes>0?ratedWeighted/ratedMinutes*100:null,ratingCoverage:completed>0?ratedMinutes/completed*100:null,days:[...days.values()].sort((a,b)=>a.date.localeCompare(b.date))};
}
