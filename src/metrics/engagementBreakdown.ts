import type { PlannerData } from "../types";
import { normalizeEngagement } from "../utils/engagement";
import { metricDay, type buildInsights } from "./insightFacts";
import type { TimeAllocationMetrics } from "./timeAllocation";

export type RatingTotals={completedMinutes:number;ratedMinutes:number;weightedMinutes:number;completedExecutions:number;ratedExecutions:number};
export type RatingRow=RatingTotals & {id:string};
const totals=():RatingTotals=>({completedMinutes:0,ratedMinutes:0,weightedMinutes:0,completedExecutions:0,ratedExecutions:0});
const row=(id:string):RatingRow=>({id,...totals()});
const rawMinutes=(a:Date,b:Date)=>Math.max(0,(b.getTime()-a.getTime())/60000);
function addMinutes(r:RatingTotals,minutes:number,score:number|undefined){
  r.completedMinutes+=minutes;
  if(score!==undefined){r.ratedMinutes+=minutes;r.weightedMinutes+=minutes*score/100;}
}
function count(r:RatingTotals,score:number|undefined){r.completedExecutions++;if(score!==undefined)r.ratedExecutions++;}
export function ratingMean(r:RatingTotals){return r.ratedMinutes>0?r.weightedMinutes/r.ratedMinutes*100:null;}
export function ratingCoverage(r:RatingTotals){return r.completedMinutes>0?r.ratedMinutes/r.completedMinutes*100:null;}
function ensure(map:Map<string,RatingRow>,id:string){let r=map.get(id);if(!r){r=row(id);map.set(id,r);}return r;}

/** Completed scheduled minutes, never weighted input durations or inferred ratings.
 * Day and hour slices can share executions; whole-range and project counts are unique.
 * Duration bands use each execution's raw overlap with the selected range.
 */
export function buildEngagementBreakdown(data:PlannerData,allocation:TimeAllocationMetrics,dayStartMinutes:number){
  const tasks=new Map(data.tasks.map(t=>[t.id,t]));
  const records=new Map(data.tasks.map(t=>[t.id,new Map((t.timelineRecords||[]).map(r=>[r.id,r]))]));
  const projects=new Map<string,RatingRow>(),days=new Map<string,RatingRow>();
  const hours=Array.from({length:4},(_,i)=>row(String(i)));
  const bands=["under30","30to59","60to119","120plus"].map(row);
  const overall=row("all"),timed=row("timed");
  const executions=new Map<string,{projectId:string;score?:number;minutes:number}>();
  const touchedDays=new Set<string>(),touchedHours=new Set<string>();
  for(const e of allocation.taskEntries){
    if(!e.completed||e.isProjectedRecurrence)continue;
    const task=tasks.get(e.taskId);if(!task)continue;
    const record=records.get(e.taskId)?.get(e.recordId);
    const value=record?record.engagement:e.recordId===`legacy-${task.id}`||e.recordId.startsWith("metric-all-day-")?task.engagement:undefined;
    const score=typeof value==="number"&&Number.isFinite(value)?normalizeEngagement(value):undefined;
    const minutes=rawMinutes(e.scheduledStart,e.scheduledEnd);if(!minutes)continue;
    const projectId=task.projectId||"__unassigned__",key=JSON.stringify([e.taskId,e.recordId]);
    let ex=executions.get(key);
    if(!ex){ex={projectId,score,minutes:0};executions.set(key,ex);count(overall,score);count(ensure(projects,projectId),score);}
    ex.minutes+=minutes;
    addMinutes(overall,minutes,score);addMinutes(ensure(projects,projectId),minutes,score);
    const date=metricDay(e.scheduledStart,dayStartMinutes),d=ensure(days,date);
    addMinutes(d,minutes,score);
    const dayKey=JSON.stringify([key,date]);if(!touchedDays.has(dayKey)){touchedDays.add(dayKey);count(d,score);}
    if(e.isEstimatedAllDay)continue;
    addMinutes(timed,minutes,score);
    let cursor=e.scheduledStart.getTime();const end=e.scheduledEnd.getTime();
    while(cursor<end){
      const clock=new Date(cursor),hour=clock.getHours(),index=Math.floor(hour/6);
      // Step to the next clock-hour boundary, including repeated/skipped DST hours.
      const next=Math.min(end,cursor+(60-clock.getMinutes())*60000-clock.getSeconds()*1000-clock.getMilliseconds());
      if(next<=cursor)break;
      const bucket=hours[index];addMinutes(bucket,(next-cursor)/60000,score);
      const hourKey=JSON.stringify([key,index]);if(!touchedHours.has(hourKey)){touchedHours.add(hourKey);count(bucket,score);}
      cursor=next;
    }
  }
  for(const e of executions.values()){
    const band=bands[e.minutes<30?0:e.minutes<60?1:e.minutes<120?2:3];addMinutes(band,e.minutes,e.score);count(band,e.score);
  }
  return {overall,timed,projects:[...projects.values()].sort((a,b)=>b.completedMinutes-a.completedMinutes||a.id.localeCompare(b.id)),days:[...days.values()].sort((a,b)=>a.id.localeCompare(b.id)),hours,bands};
}

type Tracked=ReturnType<typeof buildInsights>["trackedEntries"];
export function projectActivityTrend(allocation:TimeAllocationMetrics,tracked:Tracked,projectId:string,dayStartMinutes:number){
  const days=new Map<string,{date:string;scheduled:number;completed:number;tracked:number;trackedSessions:number}>();
  const get=(date:string)=>{let r=days.get(date);if(!r){r={date,scheduled:0,completed:0,tracked:0,trackedSessions:0};days.set(date,r);}return r;};
  for(const e of allocation.taskEntries){
    if((e.projectId||"__unassigned__")!==projectId)continue;
    const d=get(metricDay(e.scheduledStart,dayStartMinutes)),m=rawMinutes(e.scheduledStart,e.scheduledEnd);
    d.scheduled+=m;if(e.completed)d.completed+=m;
  }
  for(const e of tracked){
    if(e.projectId!==projectId)continue;
    let cursor=e.start.getTime();const end=e.end.getTime(),span=end-cursor;if(span<=0)continue;
    while(cursor<end){
      const d=get(metricDay(new Date(cursor),dayStartMinutes)),boundary=new Date(cursor);
      boundary.setHours(Math.floor(dayStartMinutes/60),dayStartMinutes%60,0,0);
      if(boundary.getTime()<=cursor)boundary.setDate(boundary.getDate()+1);
      const next=Math.min(end,boundary.getTime());if(next<=cursor)break;
      d.tracked+=e.minutes*(next-cursor)/span;d.trackedSessions++;cursor=next;
    }
  }
  return [...days.values()].sort((a,b)=>a.date.localeCompare(b.date));
}
