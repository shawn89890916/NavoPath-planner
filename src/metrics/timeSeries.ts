import type { DailyInsight } from "./insightFacts";
import { metricDay } from "./insightFacts";
import type { MetricDateRange } from "./timeAllocation";
import type { TimeGrain } from "./savedViews";
export type TimeBucket=DailyInsight & {start:Date;end:Date;hasRecords:boolean};
function localDay(iso:string,minute:number){const [y,m,d]=iso.split("-").map(Number);return new Date(y,m-1,d,Math.floor(minute/60),minute%60);}
function bucketStart(iso:string,grain:TimeGrain,minute:number,weekStart:0|1){
  const d=localDay(iso,minute);if(grain==="month")d.setDate(1);else if(grain==="week")d.setDate(d.getDate()-(d.getDay()-weekStart+7)%7);return d;
}
function shift(d:Date,grain:TimeGrain,n:number,minute:number){const next=new Date(d);if(grain==="month")next.setMonth(next.getMonth()+n,1);else next.setDate(next.getDate()+n*(grain==="week"?7:1));next.setHours(Math.floor(minute/60),minute%60,0,0);return next;}
function bucketKey(d:Date,grain:TimeGrain){const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,"0"),day=String(d.getDate()).padStart(2,"0");return grain==="month"?y+"-"+m:y+"-"+m+"-"+day;}
/** Preserve calendar gaps; cap visible buckets, not range totals. No measurement is not zero measurement. */
export function timeBuckets(days:DailyInsight[],range:MetricDateRange,grain:TimeGrain,minute:number,weekStart:0|1,limit=366){
  if(!Number.isFinite(range.start.getTime())||!Number.isFinite(range.end.getTime())||range.end<=range.start)return {rows:[] as TimeBucket[],truncated:false};
  const first=bucketStart(metricDay(range.start,minute),grain,minute,weekStart),last=bucketStart(metricDay(new Date(range.end.getTime()-1),minute),grain,minute,weekStart);
  const map=new Map<string,TimeBucket>();let cursor=last;
  while(cursor>=first&&map.size<limit){
    const date=bucketKey(cursor,grain),end=shift(cursor,grain,1,minute);
    map.set(date,{date,start:new Date(Math.max(cursor.getTime(),range.start.getTime())),end:new Date(Math.min(end.getTime(),range.end.getTime())),scheduled:0,completed:0,tracked:0,trackedSessions:0,hasRecords:false});
    const previous=shift(cursor,grain,-1,minute);if(previous>=cursor)break;cursor=previous;
  }
  for(const day of days){const key=bucketKey(bucketStart(day.date,grain,minute,weekStart),grain),row=map.get(key);if(!row)continue;row.hasRecords=true;row.scheduled+=day.scheduled;row.completed+=day.completed;row.tracked+=day.tracked;row.trackedSessions+=day.trackedSessions;}
  return {rows:[...map.values()].reverse(),truncated:cursor>=first};
}
export function overlapMinutes(a:Date,b:Date,start:Date,end:Date){return Math.max(0,Math.min(b.getTime(),end.getTime())-Math.max(a.getTime(),start.getTime()))/60000;}
