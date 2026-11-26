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
export function createObservedPlanAccumulator(data:PlannerData,range:{start:Date;end:Date},projectIds:string[]=[]){
  const projects=new Set(projectIds);
  let eventCount=0;
  type Group={first:AnalyticsEvent;last:AnalyticsEvent;observed:boolean;uncertain:boolean;firstAmbiguous:boolean;lastAmbiguous:boolean};
  const groups=new Map<string,Group>(),moves=new Set<string>(),resizes=new Set<string>();
  const recordKey=(taskId:string|undefined,recordId:string)=>JSON.stringify([taskId||"",recordId]);
  const isUncertain=(e:AnalyticsEvent)=>e.source==="undo"||e.source==="remote-observed"||e.source==="sync";
  // Most lifecycle changes leave the schedule untouched. Memoize durations of
  // repeated schedules within this query, with bounded memory for long histories.
  const durations=new Map<string,number|null>();
  const duration=(v:AnalyticsSnapshot|undefined)=>{
    if(!v)return null;
    const key=JSON.stringify([v.scheduledDate,v.scheduledStart,v.scheduledEndDate,v.scheduledEnd]);
    if(durations.has(key))return durations.get(key)!;
    const result=observedScheduleMinutes(v);
    if(durations.size<2048)durations.set(key,result);
    return result;
  };
  const completedRecords=new Set<string>();
  const singleExecutionTasks=new Set<string>();
  for(const t of data.tasks){
    if(t.timelineRecords?.length===1)singleExecutionTasks.add(t.id);
    for(const r of t.timelineRecords||[])if(r.executionStatus==="completed")completedRecords.add(recordKey(t.id,r.id));
  }
  const collect=(e:AnalyticsEvent,selected=true)=>{
    const key=recordKey(e.taskId,e.entityId),existing=groups.get(key),uncertain=isUncertain(e)||!selected;
    if(existing){
      if(e.occurredAt<existing.first.occurredAt){existing.first=e;existing.firstAmbiguous=false;}
      else if(e.occurredAt===existing.first.occurredAt&&e.id!==existing.first.id)existing.firstAmbiguous=true;
      if(e.occurredAt>existing.last.occurredAt){existing.last=e;existing.lastAmbiguous=false;}
      else if(e.occurredAt===existing.last.occurredAt&&e.id!==existing.last.id)existing.lastAmbiguous=true;
      existing.observed ||= !uncertain;
      existing.uncertain ||= uncertain;
    }else groups.set(key,{first:e,last:e,observed:!uncertain,uncertain,firstAmbiguous:false,lastAmbiguous:false});
    return key;
  };
  let moveCount=0,resizeCount=0,created=0,removed=0,taskCompleted=0,taskReopened=0;
  function add(e:AnalyticsEvent){
    const selected=!projects.size||projects.has(e.projectId||"__unassigned__");
    if(selected)eventCount++;
    if(!selected||isUncertain(e)){if(e.entityType==="execution"){collect(e,selected);}return;}
    if(e.entityType==="task"&&e.action==="changed"){if(e.before?.completed===false&&e.after?.completed===true)taskCompleted++;if(e.before?.completed===true&&e.after?.completed===false)taskReopened++;}
    if(e.entityType!=="execution")return;
    const key=collect(e);
    if(e.action==="created")created++;if(e.action==="removed")removed++;
    if(e.action!=="changed"||!e.before||!e.after)return;
    if(e.before.scheduledDate!==e.after.scheduledDate||e.before.scheduledStart!==e.after.scheduledStart){moves.add(key);moveCount++;}
    if(e.before.scheduledDate!==e.after.scheduledDate||e.before.scheduledStart!==e.after.scheduledStart||e.before.scheduledEndDate!==e.after.scheduledEndDate||e.before.scheduledEnd!==e.after.scheduledEnd){
      const before=duration(e.before),after=duration(e.after);
      if(before!==null&&after!==null&&before!==after){resizes.add(key);resizeCount++;}
    }
  }
  function finish(){
  const comparisons:{taskId:string;recordId:string;initial:number;final:number;tracked:number;estimate:number|null}[]=[];
  let completedPlanSamples=0,planLengthened=0,planShortened=0,planUnchanged=0,planChangeMinutes=0,eligibleObserved=0,eligibleMoved=0,eligibleResized=0;
  const trackedByRecord=new Map<string,number>();
  for(const entry of data.timeEntries||[]){
    if(!entry.timelineRecordId)continue;
    const a=Date.parse(entry.startAt),b=Date.parse(entry.endAt);
    if(!Number.isFinite(a)||!Number.isFinite(b)||b<=a||a<range.start.getTime()||b>range.end.getTime()||!Number.isFinite(entry.durationMinutes)||entry.durationMinutes<=0)continue;
    const key=recordKey(entry.taskId,entry.timelineRecordId);trackedByRecord.set(key,(trackedByRecord.get(key)||0)+entry.durationMinutes);
  }
  for(const [key,{first,last,uncertain,observed,firstAmbiguous,lastAmbiguous}] of groups){
    if(observed&&!uncertain){eligibleObserved++;if(moves.has(key))eligibleMoved++;if(resizes.has(key))eligibleResized++;}
    if(firstAmbiguous||lastAmbiguous)continue;
    if(first.action!=="created"||uncertain||last.after?.executionStatus!=="completed"||!first.taskId||!completedRecords.has(key))continue;
    const initial=duration(first.after),final=duration(last.after),tracked=trackedByRecord.get(key);
    if(initial===null||final===null)continue;
    completedPlanSamples++;planChangeMinutes+=final-initial;
    if(final>initial)planLengthened++;else if(final<initial)planShortened++;else planUnchanged++;
    if(tracked===undefined)continue;
    const estimate=singleExecutionTasks.has(first.taskId)&&typeof first.estimateMinutes==="number"&&first.estimateMinutes>0?first.estimateMinutes:null;
    comparisons.push({taskId:first.taskId,recordId:first.entityId,initial,final,tracked,estimate});
  }
  return {eventCount,observedExecutions:[...groups.values()].filter(g=>g.observed).length,created,removed,movedExecutions:moves.size,resizedExecutions:resizes.size,moveCount,resizeCount,taskCompleted,taskReopened,eligibleObserved,eligibleMoved,eligibleResized,completedPlanSamples,planLengthened,planShortened,planUnchanged,planChangeMinutes,comparisons};
  }
  return {add,finish};
}
export type ObservedPlanHistory=ReturnType<ReturnType<typeof createObservedPlanAccumulator>["finish"]>;
export function buildObservedPlanHistory(events:AnalyticsEvent[],data:PlannerData,range:{start:Date;end:Date}){
  const accumulator=createObservedPlanAccumulator(data,range);
  for(const e of events)accumulator.add(e);
  return accumulator.finish();
}
