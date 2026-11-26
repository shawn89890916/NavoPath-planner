import type { TimeAllocationMetrics } from "./timeAllocation";
import type { buildInsights } from "./insightFacts";
type Tracked=ReturnType<typeof buildInsights>["trackedEntries"];
export type ProjectExecutionRow={id:string;taskId:string;recordId?:string;scheduled:number;completed:number;tracked:number;trackedSessions:number;projected:boolean;estimatedAllDay:boolean};
export type ProjectTaskRow={taskId:string;scheduled:number;completed:number;tracked:number;trackedSessions:number;executions:number;rows:ProjectExecutionRow[]};
const blank={scheduled:0,completed:0,tracked:0,trackedSessions:0};
const overlap=(a:Date,b:Date,range:{start:Date;end:Date})=>Math.max(0,Math.min(b.getTime(),range.end.getTime())-Math.max(a.getTime(),range.start.getTime()))/60000;
/** Project -> task -> independent schedule, plus explicit linked and unlinked tracking.
 * Tracking-only records are retained; projections are never counted as actual executions.
 */
export function projectTaskDetails(allocation:TimeAllocationMetrics,tracked:Tracked,projectId:string,range=allocation.range){
  const tasks=new Map<string,ProjectTaskRow>(),records=new Map<string,ProjectExecutionRow>();
  const getTask=(taskId:string)=>{let t=tasks.get(taskId);if(!t){t={taskId,...blank,executions:0,rows:[]};tasks.set(taskId,t);}return t;};
  const getRecord=(taskId:string,recordId:string|undefined)=>{const id=JSON.stringify([taskId,recordId??null]);let r=records.get(id);if(!r){r={id,taskId,recordId,...blank,projected:false,estimatedAllDay:false};records.set(id,r);getTask(taskId).rows.push(r);}return r;};
  for(const e of allocation.taskEntries){
    if((e.projectId||"__unassigned__")!==projectId)continue;
    const minutes=overlap(e.scheduledStart,e.scheduledEnd,range);if(!minutes)continue;
    const r=getRecord(e.taskId,e.recordId),t=getTask(e.taskId);
    r.scheduled+=minutes;t.scheduled+=minutes;
    if(e.completed){r.completed+=minutes;t.completed+=minutes;}
    r.projected=Boolean(e.isProjectedRecurrence);r.estimatedAllDay=Boolean(e.isEstimatedAllDay);
  }
  for(const e of tracked){
    if(e.projectId!==projectId)continue;
    const span=(e.end.getTime()-e.start.getTime())/60000,m=overlap(e.start,e.end,range);
    if(span<=0||m<=0)continue;
    const minutes=e.minutes*m/span,r=getRecord(e.taskId,e.recordId),t=getTask(e.taskId);
    r.tracked+=minutes;t.tracked+=minutes;r.trackedSessions++;t.trackedSessions++;
  }
  for(const t of tasks.values())t.executions=t.rows.filter(r=>r.scheduled>0&&!r.projected).length;
  return [...tasks.values()].sort((a,b)=>b.scheduled-a.scheduled||b.tracked-a.tracked||a.taskId.localeCompare(b.taskId));
}
export function safeCsvCell(value:string|number|null|undefined){
  if(value===null||value===undefined)return "";
  if(typeof value==="number")return Number.isFinite(value)?String(value):"";
  // Spreadsheet formula injection includes leading whitespace and control characters.
  const text=/^[\s\u0000-\u001f]*[=+\-@]|^[\t\r\n]/.test(value)?"'"+value:value;
  return '"'+text.replaceAll('"','""')+'"';
}
