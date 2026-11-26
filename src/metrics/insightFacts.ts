import type { PlannerData } from "../types";
import { normalizeEngagement } from "../utils/engagement";
import {recordStartDateTime,recordEndDateTime} from "../utils/timelineRecords";
import type { TimeAllocationMetrics, MetricHabitMode, MetricCompletionFilter } from "./timeAllocation";

export type InsightOptions = { dayStartMinutes:number; projectIds:string[]; habitMode:MetricHabitMode; completion:MetricCompletionFilter };
export type DailyInsight = { date:string; scheduled:number; completed:number; tracked:number; trackedSessions:number };
export type ProjectInsight = { id:string; label:string; scheduled:number; completed:number; tracked:number; trackedSessions:number; executions:number };
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
  const day=(date:string)=>{let x=days.get(date);if(!x){x={date,scheduled:0,completed:0,tracked:0,trackedSessions:0};days.set(date,x);}return x;};
  const executions=new Map<string,{status:string;minutes:number;score?:number;projectId:string}>();
  const projects=new Map<string,ProjectInsight>();
  const project=(id:string)=>{let p=projects.get(id);if(!p){p={id,label:data.projects.find(x=>x.id===id)?.title||id,scheduled:0,completed:0,tracked:0,trackedSessions:0,executions:0};projects.set(id,p);}return p;};
  const engagementBuckets=Array.from({length:10},(_,i)=>({score:(i+1)*10,minutes:0,count:0}));
  let scheduled=0,completed=0,ratedMinutes=0,ratedWeighted=0,tracked=0,trackedSessions=0;
  const trackedBySource={timer:0,manual:0,idle_adjusted:0};
  const measuredRecords=new Set<string>();
  const completedHours=Array.from({length:7},()=>Array.from({length:24},()=>0));
  const intervals:{start:number;end:number}[]=[];
  const statuses:Record<string,number>={scheduled:0,completed:0,returned_unfinished:0,skipped:0,cancelled:0};
  for(const entry of allocation.taskEntries){
    const t=tasks.get(entry.taskId);if(!t)continue;
    const record=t.timelineRecords?.find(r=>r.id===entry.recordId);
    const status=entry.isHabit?(entry.completed?"completed":record?.executionStatus==="completed"?"scheduled":record?.executionStatus||"scheduled"):record?.executionStatus || (entry.completed?"completed":"scheduled");
    if(options.completion==="completed"&&status!=="completed" || options.completion==="incomplete"&&status==="completed")continue;
    const score=record?record.engagement:entry.recordId===`legacy-${t.id}`||entry.recordId.startsWith("metric-all-day-")?t.engagement:undefined;
    const raw=intervalMinutes(entry.scheduledStart.getTime(),entry.scheduledEnd.getTime());
    const key=entry.taskId+":"+entry.recordId;
    const projectId=t.projectId||"__unassigned__";
    const item=executions.get(key)||{status,minutes:0,score:typeof score==="number"&&Number.isFinite(score)?normalizeEngagement(score):undefined,projectId};
    item.minutes+=raw;executions.set(key,item);
    scheduled+=raw;project(projectId).scheduled+=raw;intervals.push({start:entry.scheduledStart.getTime(),end:entry.scheduledEnd.getTime()});
    if(status==="completed"){let cursor=entry.scheduledStart.getTime();const end=entry.scheduledEnd.getTime();while(cursor<end){const d=new Date(cursor);const step=60-d.getMinutes();const next=Math.min(end,cursor+step*60000-d.getSeconds()*1000-d.getMilliseconds());if(next<=cursor)break;completedHours[(d.getDay()+6)%7][d.getHours()]+=(next-cursor)/60000;cursor=next;}}
    if(status==="completed"){completed+=raw;project(projectId).completed+=raw;if(item.score!==undefined){ratedMinutes+=raw;ratedWeighted+=raw*item.score/100;}}
    eachDay(entry.scheduledStart.getTime(),entry.scheduledEnd.getTime(),options.dayStartMinutes,(date,ms)=>{const d=day(date);d.scheduled+=ms/60000;if(status==="completed")d.completed+=ms/60000;});
  }
  for(const e of executions.values()) { statuses[e.status]=(statuses[e.status]||0)+1; project(e.projectId).executions++; if(e.status==="completed"&&e.score!==undefined){const bucket=engagementBuckets[e.score/10-1];bucket.count++;bucket.minutes+=e.minutes;} }
  const start=allocation.range.start.getTime(),end=allocation.range.end.getTime();
  if(options.completion!=="completed")for(const task of data.tasks){if(projectFilter.size&&!projectFilter.has(task.projectId||"__unassigned__"))continue;for(const r of task.timelineRecords||[]){if(r.executionStatus!=="cancelled")continue;const habit=task.id.startsWith("habit-task-")||r.id.startsWith("habit-record-")||Boolean(data.habitDailyStates?.some(h=>h.timelineRecordId===r.id));if(options.habitMode==="exclude"&&habit||options.habitMode==="only"&&!habit)continue;const a=recordStartDateTime(r).getTime(),b=recordEndDateTime(r).getTime();if((b>a&&Math.min(end,b)>Math.max(start,a))||(!r.scheduledStart&&a>=start&&a<end))statuses.cancelled++;}}
  for(const entry of data.timeEntries||[]){
    const task=tasks.get(entry.taskId);
    const projectId=task?task.projectId||"__unassigned__":entry.projectId||"__unassigned__";
    if(projectFilter.size&&!projectFilter.has(projectId))continue;
    const habit=entry.taskId.startsWith("habit-task-")||Boolean((data.habitDailyStates||[]).find(h=>h.timelineRecordId===entry.timelineRecordId&&entry.timelineRecordId));
    if(options.habitMode==="exclude"&&habit || options.habitMode==="only"&&!habit)continue;
    const record=task?.timelineRecords?.find(r=>r.id===entry.timelineRecordId);
    const isCompleted=record?record.executionStatus==="completed":task?.completed;
    if(options.completion!=="all"&&(isCompleted===undefined||(options.completion==="completed")!==isCompleted))continue;
    const a=Date.parse(entry.startAt),b=Date.parse(entry.endAt);
    if(!Number.isFinite(a)||!Number.isFinite(b)||b<=a||!Number.isFinite(entry.durationMinutes)||entry.durationMinutes<=0)continue;
    const lo=Math.max(a,start),hi=Math.min(b,end);if(hi<=lo)continue;
    trackedSessions++;
    if(entry.timelineRecordId&&executions.has(entry.taskId+":"+entry.timelineRecordId))measuredRecords.add(entry.taskId+":"+entry.timelineRecordId);
    const p=project(projectId);p.trackedSessions++;
    eachDay(lo,hi,options.dayStartMinutes,(date,ms)=>{const minutes=entry.durationMinutes*ms/(b-a);const d=day(date);d.tracked+=minutes;d.trackedSessions++;tracked+=minutes;p.tracked+=minutes;if(entry.source in trackedBySource)trackedBySource[entry.source]+=minutes;});
  }
  let occupied=0,lo=0,hi=0;for(const interval of intervals.sort((a,b)=>a.start-b.start)){if(interval.start>hi){occupied+=hi-lo;lo=interval.start;hi=interval.end;}else hi=Math.max(hi,interval.end);}occupied=(occupied+hi-lo)/60000;
  return {scheduled,completed,tracked,trackedSessions,trackedBySource,occupied,completedHours,measuredExecutionCount:measuredRecords.size,measurementCoverage:executions.size?measuredRecords.size/executions.size*100:null,executionCount:executions.size,statuses,ratedMinutes,ratedWeighted,engagementBuckets,projects:[...projects.values()].sort((a,b)=>b.scheduled-a.scheduled||b.tracked-a.tracked),explicitEngagement:ratedMinutes>0?ratedWeighted/ratedMinutes*100:null,ratingCoverage:completed>0?ratedMinutes/completed*100:null,days:[...days.values()].sort((a,b)=>a.date.localeCompare(b.date))};
}
