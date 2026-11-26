import type { PlannerData } from "../types";
import type { MetricDateRange, MetricHabitMode } from "./timeAllocation";

const DAY=86400000;
const civilDay=(d:Date)=>Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())/DAY;
/** Compare an elapsed selected window with the corresponding preceding calendar window.
 * Both samples have identical elapsed duration, including across DST boundaries.
 * Never treat future time as elapsed or turn the All range into a comparison.
 */
export function matchedPeriods(range:MetricDateRange,now:Date){
  if(range.preset==="all")return null;
  const start=range.start.getTime(),end=range.end.getTime(),at=now.getTime();
  if(![start,end,at].every(Number.isFinite)||end<=start||at<=start)return null;
  const days=Math.max(1,civilDay(range.end)-civilDay(range.start));
  const previousStart=new Date(range.start);previousStart.setDate(previousStart.getDate()-days);
  const duration=Math.min(end-start,at-start,start-previousStart.getTime());
  if(duration<=0)return null;
  return {current:{...range,end:new Date(start+duration)},previous:{...range,preset:"custom" as const,start:previousStart,end:new Date(previousStart.getTime()+duration)},partial:start+duration<end};
}
export function accuracySummary(rows:{initial:number;final?:number;tracked:number;estimate:number|null}[]){
  function summary(pairs:{base:number;actual:number}[]){
    const valid=pairs.filter(x=>Number.isFinite(x.base)&&x.base>0&&Number.isFinite(x.actual)&&x.actual>=0);
    if(!valid.length)return {count:0,bias:null,mae:null,relativeError:null};
    return {count:valid.length,bias:valid.reduce((n,x)=>n+x.actual-x.base,0)/valid.length,mae:valid.reduce((n,x)=>n+Math.abs(x.actual-x.base),0)/valid.length,relativeError:valid.reduce((n,x)=>n+Math.abs(x.actual-x.base)/x.base,0)/valid.length*100};
  }
  return {schedule:summary(rows.map(x=>({base:x.initial,actual:x.tracked}))),final:summary(rows.flatMap(x=>x.final===undefined?[]:[{base:x.final,actual:x.tracked}])),estimate:summary(rows.flatMap(x=>x.estimate===null?[]:[{base:x.estimate,actual:x.tracked}]))};
}
export function currentProjectProgress(data:PlannerData,projects:string[],habitMode:MetricHabitMode){
  const filter=new Set(projects),groups=new Map<string,{id:string;title:string;total:number;completed:number;estimated:number;estimatedCompleted:number;estimateCount:number}>();
  const ensure=(id:string)=>{let g=groups.get(id);if(!g){g={id,title:data.projects.find(p=>p.id===id)?.title||id,total:0,completed:0,estimated:0,estimatedCompleted:0,estimateCount:0};groups.set(id,g);}return g;};
  for(const t of data.tasks){const id=t.projectId||"__unassigned__",habit=t.id.startsWith("habit-task-");if(filter.size&&!filter.has(id)||habitMode==="exclude"&&habit||habitMode==="only"&&!habit)continue;
    const g=ensure(id);g.total++;if(t.completed)g.completed++;
    if(typeof t.estimatedHours==="number"&&Number.isFinite(t.estimatedHours)&&t.estimatedHours>0){g.estimateCount++;g.estimated+=t.estimatedHours*60;if(t.completed)g.estimatedCompleted+=t.estimatedHours*60;}
  }
  return [...groups.values()].sort((a,b)=>b.total-a.total||a.title.localeCompare(b.title));
}
