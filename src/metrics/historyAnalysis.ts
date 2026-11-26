import type { AnalyticsEvent, AnalyticsSnapshot } from "./activityEvents";
import type { PlannerData } from "../types";
import { calendarDateTimeSpanMinutes } from "../utils/timelineRecords";
function validDate(v:unknown):v is string{return typeof v==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+"T00:00:00Z"));}
function validClock(v:unknown):v is string{return typeof v==="string"&&/^([01]\d|2[0-3]):[0-5]\d$/.test(v);}
export function observedScheduleMinutes(v?:AnalyticsSnapshot):number|null{
  if(!v||!validDate(v.scheduledDate)||!validClock(v.scheduledStart)||!validClock(v.scheduledEnd))return null;
  let end=validDate(v.scheduledEndDate)?v.scheduledEndDate:v.scheduledDate;
  if(!validDate(v.scheduledEndDate)&&v.scheduledEnd<=v.scheduledStart){const d=new Date(v.scheduledDate+"T00:00:00Z");d.setUTCDate(d.getUTCDate()+1);end=d.toISOString().slice(0,10);}
  const n=calendarDateTimeSpanMinutes(v.scheduledDate,v.scheduledStart,end,v.scheduledEnd);return Number.isFinite(n)&&n>0?n:null;
}
export function buildObservedPlanHistory(events:AnalyticsEvent[],data:PlannerData,range:{start:Date;end:Date}){
  const groups=new Map<string,AnalyticsEvent[]>(),moves=new Set<string>(),resizes=new Set<string>();
  let moveCount=0,resizeCount=0,created=0,removed=0,taskCompleted=0,taskReopened=0;
  for(const e of events){
    if(e.source==="undo"||e.source==="remote-observed")continue;
    if(e.entityType==="task"&&e.action==="changed"){if(e.before?.completed===false&&e.after?.completed===true)taskCompleted++;if(e.before?.completed===true&&e.after?.completed===false)taskReopened++;}
    if(e.entityType!=="execution")continue;
    const key=(e.taskId||"")+":"+e.entityId;const list=groups.get(key)||[];list.push(e);groups.set(key,list);
    if(e.action==="created")created++;if(e.action==="removed")removed++;
    if(e.action!=="changed"||!e.before||!e.after)continue;
    if(e.before.scheduledDate!==e.after.scheduledDate||e.before.scheduledStart!==e.after.scheduledStart){moves.add(key);moveCount++;}
    const before=observedScheduleMinutes(e.before),after=observedScheduleMinutes(e.after);
    if(before!==null&&after!==null&&before!==after){resizes.add(key);resizeCount++;}
  }
  const comparisons:{taskId:string;recordId:string;initial:number;tracked:number;estimate:number|null}[]=[];
  const trackedByRecord=new Map<string,number>();
  for(const entry of data.timeEntries||[]){
    if(!entry.timelineRecordId)continue;
    const a=Date.parse(entry.startAt),b=Date.parse(entry.endAt);
    if(!Number.isFinite(a)||!Number.isFinite(b)||b<=a||a<range.start.getTime()||b>range.end.getTime()||!Number.isFinite(entry.durationMinutes)||entry.durationMinutes<=0)continue;
    const key=entry.taskId+":"+entry.timelineRecordId;trackedByRecord.set(key,(trackedByRecord.get(key)||0)+entry.durationMinutes);
  }
  for(const [key,list] of groups){
    const ordered=[...list].sort((a,b)=>a.occurredAt.localeCompare(b.occurredAt));
    const first=ordered[0],last=ordered[ordered.length-1];
    if(first.action!=="created"||last.after?.executionStatus!=="completed"||!first.taskId)continue;
    const initial=observedScheduleMinutes(first.after),tracked=trackedByRecord.get(key);
    if(initial===null||tracked===undefined)continue;
    const estimate=typeof first.estimateMinutes==="number"&&first.estimateMinutes>0?first.estimateMinutes:null;
    comparisons.push({taskId:first.taskId,recordId:first.entityId,initial,tracked,estimate});
  }
  return {observedExecutions:groups.size,created,removed,movedExecutions:moves.size,resizedExecutions:resizes.size,moveCount,resizeCount,taskCompleted,taskReopened,comparisons};
}
