import {useMemo,useState} from "react";
import type {Language,PlannerData} from "../types";
import type {TimeAllocationMetrics} from "./timeAllocation";
import type {buildInsights} from "./insightFacts";
import {projectTaskDetails,projectDetailRange,safeCsvCell} from "./projectDetails";
import type {MetricsQuery} from "./savedViews";
type Props={data:PlannerData;allocation:TimeAllocationMetrics;result:ReturnType<typeof buildInsights>;projectId:string;date:string|null;dayStartMinutes:number;lang:Language;query:MetricsQuery};
const fmt=(n:number)=>Math.round(n)+" min";
export default function MetricsProjectDetails(p:Props){
  const t=(zh:string,en:string)=>p.lang==="zh"?zh:en;
  const names=useMemo(()=>new Map(p.data.tasks.map(x=>[x.id,x.title])),[p.data.tasks]);
  const range=useMemo(()=>projectDetailRange(p.allocation.range,p.date,p.dayStartMinutes),[p.allocation.range,p.date,p.dayStartMinutes]);
  const rows=useMemo(()=>projectTaskDetails(p.allocation,p.result.trackedEntries,p.projectId,range),[p.allocation,p.result.trackedEntries,p.projectId,range]);
  const [page,setPage]=useState(0),[task,setTask]=useState<string|null>(null),[detailPage,setDetailPage]=useState(0);
  const at=Math.min(page,Math.max(0,Math.ceil(rows.length/25)-1)),active=rows.find(x=>x.taskId===task);
  const detailAt=Math.min(detailPage,Math.max(0,Math.ceil((active?.rows.length||0)/25)-1));
  const name=(id:string)=>names.get(id)||t("已删除或不可用任务","Deleted or unavailable task");
  const action=(label:string,fn:()=>void,disabled=false)=><button type="button" className="df-metrics-text-action" disabled={disabled} onClick={fn}>{label}</button>;
  const pager=(n:number,at:number,change:(v:number)=>void)=><div className="df-metric-insight-actions">{action(t("上一页","Previous"),()=>change(at-1),at===0)}<span>{at+1} / {Math.max(1,Math.ceil(n/25))}</span>{action(t("下一页","Next"),()=>change(at+1),(at+1)*25>=n)}</div>;
  function exportCsv(){
    const zone=Intl.DateTimeFormat().resolvedOptions().timeZone;
    const headers=["Project ID","Task ID","Task","Record ID","Scheduled minutes","Completed scheduled minutes","Tracked minutes","Tracked sessions","Projected","All-day estimate","Range start UTC","Range end UTC","Timezone","Day start minutes","Habit filter","Completion filter"];
    const out=[headers.map(safeCsvCell).join(",")];
    for(const row of rows)for(const r of row.rows)out.push([p.projectId,row.taskId,name(row.taskId),r.recordId??"",r.scheduled,r.completed,r.trackedSessions?r.tracked:null,r.trackedSessions,r.projected?"yes":"no",r.estimatedAllDay?"yes":"no",range.start.toISOString(),range.end.toISOString(),zone,p.dayStartMinutes,p.query.habit,p.query.completion].map(safeCsvCell).join(","));
    const url=URL.createObjectURL(new Blob(["\ufeff"+out.join("\r\n")],{type:"text/csv;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download="navopath-project-executions.csv";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  return <>
    <h3>{t("任务与独立执行","Tasks and independent executions")}</h3>
    <p>{t("仅统计当前范围内有排程或计时的任务。重复预测不计入真实执行数；计时保留原记录关联，未关联计时单独列出。","Tasks with schedules or tracking in scope only. Recurring projections are excluded from actual execution counts; tracking retains recorded links, with unlinked entries separate.")}</p>
    <div className="df-metric-insight-actions">{action(t("导出所选范围全部执行 CSV","Export all executions in scope"),exportCsv,!rows.length)}</div>
    <div className="df-metric-insight-table" tabIndex={0} role="region" aria-label={t("统计数据表","Statistics table")}><table><thead><tr><th>{t("任务","Task")}</th><th>{t("排程","Scheduled")}</th><th>{t("完成","Completed")}</th><th>{t("计时","Tracked")}</th><th>{t("真实排程数","Actual schedules")}</th></tr></thead><tbody>{rows.slice(at*25,at*25+25).map(x=><tr key={x.taskId}><td><button type="button" className="df-metrics-text-action" aria-expanded={task===x.taskId} onClick={()=>{setTask(task===x.taskId?null:x.taskId);setDetailPage(0);}}>{name(x.taskId)}</button></td><td>{fmt(x.scheduled)}</td><td>{fmt(x.completed)}</td><td>{x.trackedSessions?fmt(x.tracked):"—"}</td><td>{x.executions}</td></tr>)}</tbody></table></div>
    {rows.length?pager(rows.length,at,setPage):<p>{t("没有符合范围的任务。","No tasks in scope.")}</p>}
    {active&&<><h3>{name(active.taskId)} · {t("独立执行明细","Execution details")}</h3>{action(t("收起任务明细","Close task details"),()=>setTask(null))}
      <div className="df-metric-insight-table" tabIndex={0} role="region" aria-label={t("统计数据表","Statistics table")}><table><thead><tr><th>{t("记录","Record")}</th><th>{t("排程","Scheduled")}</th><th>{t("完成","Completed")}</th><th>{t("计时","Tracked")}</th><th>{t("计时条数","Sessions")}</th></tr></thead><tbody>{active.rows.slice(detailAt*25,detailAt*25+25).map(r=><tr key={r.id}><td title={r.recordId}>{!r.recordId?t("未关联计时","Unlinked tracking"):r.projected?t("重复预测","Recurring projection"):r.estimatedAllDay?t("全天估时","All-day estimate"):r.scheduled?t("独立排程","Schedule"):t("仅计时记录","Tracking only")}</td><td>{fmt(r.scheduled)}</td><td>{fmt(r.completed)}</td><td>{r.trackedSessions?fmt(r.tracked):"—"}</td><td>{r.trackedSessions}</td></tr>)}</tbody></table></div>{pager(active.rows.length,detailAt,setDetailPage)}
    </>}
  </>;
}
