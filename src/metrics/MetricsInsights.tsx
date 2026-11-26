import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { PlannerData, Language } from "../types";
import type { TimeAllocationMetrics, MetricHabitMode, MetricCompletionFilter } from "./timeAllocation";
import { buildInsights } from "./insightFacts";
import { analyticsError, analyticsPreference, clearAnalytics, readAnalyticsEvents, setAnalyticsEnabled, subscribeAnalytics } from "./activityStore";
import type { AnalyticsEvent } from "./activityEvents";
import { buildObservedPlanHistory } from "./historyAnalysis";
import { readSavedViews, writeSavedViews, type SavedMetricsView, type MetricsQuery, type InsightView, type TimeChart } from "./savedViews";
import "./MetricsInsights.css";

type View = InsightView;
function downloadCsv(rows: {date:string;scheduled:number;completed:number;tracked:number;trackedSessions:number}[]) {
  const text=["Date,Scheduled minutes,Completed scheduled minutes,Tracked minutes",...rows.map(d=>[d.date,d.scheduled.toFixed(2),d.completed.toFixed(2),d.trackedSessions?d.tracked.toFixed(2):""].join(","))].join("\r\n");
  const url=URL.createObjectURL(new Blob([text],{type:"text/csv;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download="navopath-metrics.csv";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
type Props = { scope?:string; data:PlannerData; allocation:TimeAllocationMetrics; dayStartMinutes:number; projectIds:string[]; habitMode:MetricHabitMode; completion:MetricCompletionFilter; lang:Language; children:ReactNode; query:MetricsQuery; onApplyQuery:(query:MetricsQuery)=>void };
function minutes(n:number) { return (Math.round(n/6)/10).toFixed(1)+" h"; }
function percent(n:number|null) {return n===null?"—":Math.round(n)+"%";}
function downloadJson(events:AnalyticsEvent[]) {
  const url=URL.createObjectURL(new Blob([JSON.stringify(events,null,2)],{type:"application/json"}));
  const a=document.createElement("a");a.href=url;a.download="navopath-activity.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function MetricsInsights(p:Props) {
  const [view,setView]=useState<View>("allocation");
  const [timeChart,setTimeChart]=useState<TimeChart>("trend");
  const [savedViews,setSavedViews]=useState(()=>p.scope?readSavedViews(p.scope):[]);
  const [viewName,setViewName]=useState("");
  const [selectedSaved,setSelectedSaved]=useState("");
  const [saveViewError,setSaveViewError]=useState(false);
  const [events,setEvents]=useState<AnalyticsEvent[]>([]);
  const [historyState,setHistoryState]=useState<"loading"|"ready"|"error">("loading");
  const [revision,setRevision]=useState(0);
  const [confirmClear,setConfirmClear]=useState(false);
  const [error,setError]=useState(false);
  const [selectedDate,setSelectedDate]=useState<string|null>(null);
  const t=(zh:string,en:string)=>p.lang==="zh"?zh:en;
  const preference=p.scope?analyticsPreference(p.scope):null;
  const result=useMemo(()=>buildInsights(p.data,p.allocation,p),[p.data,p.allocation,p.dayStartMinutes,p.projectIds,p.habitMode,p.completion]);
  const start=p.allocation.range.start.getTime(),end=p.allocation.range.end.getTime();
  useEffect(()=>p.scope?subscribeAnalytics(p.scope,()=>setRevision(n=>n+1)):undefined,[p.scope]);
  useEffect(()=>{
    if((view!=="history"&&view!=="execution")||!p.scope)return;
    let live=true;setHistoryState("loading");
    readAnalyticsEvents(p.scope,new Date(start),new Date(end),501,p.projectIds).then(rows=>{if(live){setEvents(rows);setHistoryState("ready");}},()=>{if(live){setEvents([]);setHistoryState("error");}});
    return()=>{live=false;};
  },[view,p.scope,start,end,revision,p.projectIds]);
  useEffect(()=>setSelectedDate(null),[start,end]);
  const tabs: [View,string][]=[["allocation",t("分布","Allocation")],["time",t("时间","Time")],["execution",t("执行","Execution")],["engagement",t("投入度","Engagement")],["projects",t("项目","Projects")],["history",t("历史","History")]];
  const visibleDays=result.days.slice(-366),max=Math.max(1,...visibleDays.flatMap(d=>[d.scheduled,d.completed,d.tracked]));
  const historyRows=events.slice(0,500);
  const observed=useMemo(()=>buildObservedPlanHistory(historyRows,p.data,p.allocation.range),[events,p.data,p.allocation.range]);
  const comparisonScale=Math.max(1,...observed.comparisons.flatMap(x=>[x.initial,x.tracked]));
  function persistViews(next:SavedMetricsView[]){if(!p.scope)return;try{writeSavedViews(p.scope,next);setSavedViews(next);setSaveViewError(false);}catch{setSaveViewError(true);}}
  function applySaved(saved:SavedMetricsView){setSelectedSaved(saved.id);setView(saved.view);setTimeChart(saved.chart);setViewName(saved.name);p.onApplyQuery(saved.query);}
  function saveCurrent(){if(!p.scope||!viewName.trim()||savedViews.length>=50)return;const saved={id:crypto.randomUUID(),name:viewName.trim().slice(0,80),view,chart:timeChart,query:p.query};persistViews([...savedViews,saved]);setSelectedSaved(saved.id);}
  function changeOrder(delta:number){const at=savedViews.findIndex(x=>x.id===selectedSaved),to=at+delta;if(at<0||to<0||to>=savedViews.length)return;const next=[...savedViews];[next[at],next[to]]=[next[to],next[at]];persistViews(next);}
  const stat=(label:string,value:string)=><div><span>{label}</span><strong>{value}</strong></div>;
  const action=(label:string,fn:()=>void,disabled=false)=><button type="button" className="df-metrics-text-action" disabled={disabled} onClick={fn}>{label}</button>;
  return <>
    <nav className="df-metric-insight-tabs" aria-label={t("统计视图","Metrics views")}>{tabs.map(([id,label])=><button type="button" key={id} className="df-metrics-text-action" aria-pressed={view===id} onClick={()=>setView(id)}>{label}</button>)}</nav>
    {p.scope&&<details className="df-metric-saved-views"><summary>{t("保存的统计视图","Saved metrics views")}</summary><div className="df-metric-insight-actions">
      <select aria-label={t("选择统计视图","Select a saved view")} value={selectedSaved} onChange={e=>{const saved=savedViews.find(x=>x.id===e.target.value);if(saved)applySaved(saved);else {setSelectedSaved("");setViewName("");}}}><option value="">{t("自定义视图","Custom view")}</option>{savedViews.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select>
      <input aria-label={t("视图名称","View name")} placeholder={t("视图名称","View name")} maxLength={80} value={viewName} onChange={e=>setViewName(e.target.value)}/>
      {action(t("保存为新视图","Save as new"),saveCurrent,!viewName.trim()||savedViews.length>=50)}
      {action(t("更新所选视图","Update selected"),()=>persistViews(savedViews.map(x=>x.id===selectedSaved?{...x,name:viewName.trim(),view,chart:timeChart,query:p.query}:x)),!selectedSaved||!viewName.trim())}
      {action(t("上移","Move up"),()=>changeOrder(-1),savedViews.findIndex(x=>x.id===selectedSaved)<=0)}
      {action(t("下移","Move down"),()=>changeOrder(1),!selectedSaved||savedViews.findIndex(x=>x.id===selectedSaved)>=savedViews.length-1)}
      {action(t("删除视图","Delete view"),()=>{persistViews(savedViews.filter(x=>x.id!==selectedSaved));setSelectedSaved("");setViewName("");},!selectedSaved)}
      {action(t("每日复盘","Daily review"),()=>{setView("execution");p.onApplyQuery({...p.query,range:"today",completion:"all"});})}
      {action(t("本周时间","Weekly time"),()=>{setView("time");setTimeChart("trend");p.onApplyQuery({...p.query,range:"thisWeek",completion:"all"});})}
      {action(t("本月投入度","Monthly engagement"),()=>{setView("engagement");p.onApplyQuery({...p.query,range:"thisMonth",completion:"all"});})}
      {saveViewError&&<span role="alert">{t("无法保存视图","Could not save view")}</span>}
    </div></details>}
    {view==="allocation"?p.children:<section className="df-metric-insight-content">
      {view==="time"&&<>
        <div className="df-metric-insight-stats">{stat(t("排程时长","Scheduled"),minutes(result.scheduled))}{stat(t("已完成排程","Completed scheduled"),minutes(result.completed))}{stat(t("实际计时","Tracked"),result.trackedSessions?minutes(result.tracked):"—")}</div>
        <p>{t("排程时长不代表实测时长；跨日计时按记录区间比例分配。","Scheduled time is not measured time; cross-day tracked duration is apportioned by interval.")}</p>
        <h3>{t("每日时长","Daily time")}</h3>
        <div className="df-metric-insight-tabs">{(["trend","heatmap","table"] as const).map(v=><button key={v} type="button" className="df-metrics-text-action" aria-pressed={timeChart===v} onClick={()=>setTimeChart(v)}>{v==="trend"?t("趋势","Trend"):v==="heatmap"?t("热力图","Heatmap"):t("数据表","Table")}</button>)}{action(t("导出 CSV","Export CSV"),()=>downloadCsv(result.days),!result.days.length)}</div>
        <p>{t("排程 / 完成 / 计时","Scheduled / Completed / Tracked")}</p>
        {result.days.length>366&&<p>{t("图表显示最近 366 个有记录的日期；汇总涵盖所选范围。","Chart shows the latest 366 recorded dates; totals cover the selected range.")}</p>}
        {visibleDays.length===0?<p>{t("暂无记录","No records")}</p>:timeChart==="trend"?<div className="df-metric-insight-trend">{visibleDays.map(d=><button type="button" key={d.date} aria-pressed={selectedDate===d.date} onClick={()=>setSelectedDate(selectedDate===d.date?null:d.date)} title={d.date+" · "+[d.scheduled,d.completed,d.tracked].map(minutes).join(" / ")} aria-label={d.date+" "+[d.scheduled,d.completed,d.tracked].map(minutes).join(" / ")}><span>{d.date.slice(5)}</span><span className="df-metric-insight-bars">{[d.scheduled,d.completed,d.tracked].map((v,i)=><i key={i} style={{height:(v/max*100)+"%"}}/>)}</span></button>)}</div>:timeChart==="heatmap"?<div className="df-metric-insight-heatmap" aria-label={t("已完成排程热力图","Completed scheduled time heatmap")}>{visibleDays.map(d=><button type="button" key={d.date} aria-pressed={selectedDate===d.date} onClick={()=>setSelectedDate(selectedDate===d.date?null:d.date)} style={{backgroundColor:"color-mix(in srgb, var(--accent-active) "+Math.round(10+d.completed/max*85)+"%, var(--paper-rule))"}} title={d.date+" · "+minutes(d.completed)} aria-label={d.date+" "+minutes(d.completed)}>{d.date.slice(5)}</button>)}</div>:<div className="df-metric-insight-table"><table><thead><tr><th>{t("日期","Date")}</th><th>{t("排程","Scheduled")}</th><th>{t("完成","Completed")}</th><th>{t("计时","Tracked")}</th></tr></thead><tbody>{visibleDays.map(d=><tr key={d.date}><td>{d.date}</td><td>{minutes(d.scheduled)}</td><td>{minutes(d.completed)}</td><td>{d.trackedSessions?minutes(d.tracked):"—"}</td></tr>)}</tbody></table></div>}
        {selectedDate&&<div>{visibleDays.filter(d=>d.date===selectedDate).map(d=><p key={d.date}>{d.date} · {minutes(d.scheduled)} / {minutes(d.completed)} / {minutes(d.tracked)}</p>)}</div>}
      </>}
      {view==="execution"&&<><div className="df-metric-insight-stats">{stat(t("独立执行","Executions"),String(result.executionCount))}{stat(t("完成执行","Completed"),String(result.statuses.completed))}{stat(t("完成比例","Completed share"),result.executionCount?percent(result.statuses.completed/result.executionCount*100):"—")}</div>
        {([["scheduled",t("已安排","Scheduled")],["completed",t("完成","Completed")],["returned_unfinished",t("返回规划","Returned")],["skipped",t("跳过","Skipped")]] as const).map(([id,label])=><div className="df-metric-insight-row" key={id}><span>{label}</span><progress max={Math.max(1,result.executionCount)} value={result.statuses[id]||0}/><strong>{result.statuses[id]||0}</strong></div>)}
        <p>{t("以独立时间轴记录计数，不将跨日片段重复计数；取消的排程不进入现有分布统计。","Counts individual timeline records, not cross-day slices. Cancelled schedules are excluded by the existing allocation report.")}</p>
      <h3>{t("已观察到的计划变更","Observed plan changes")}</h3>
      {(!p.scope||historyState!=="ready"||!historyRows.length)?<p>{historyState==="loading"&&p.scope?t("读取历史中…","Loading history…"):t("暂无可验证的本机历史，请在历史视图启用详细记录。","No verified local history; enable detailed recording in History.")}</p>:<>
        <div className="df-metric-insight-stats">{stat(t("改期次数","Observed moves"),String(observed.moveCount))}{stat(t("时长调整次数","Observed resizes"),String(observed.resizeCount))}{stat(t("被移除的执行","Removed executions"),String(observed.removed))}</div>
        <p>{t("按操作发生日期统计，限本机记录，最多 500 条；不能代表完整改期率或其他设备的操作。","By change date, local records only (up to 500); not a complete reschedule rate or other-device history.")}</p>
        <h3>{t("首次观察排程与实际计时","First observed schedule vs tracked time")}</h3>
        {observed.comparisons.length?<><p>{t("横轴：首次观察排程分钟；纵轴：已记录计时分钟。只包含记录到创建、完成且具有关联计时的执行。","X: first observed scheduled minutes; Y: tracked minutes. Requires observed creation, completion and linked time entries.")}</p><svg className="df-metric-insight-scatter" viewBox="0 0 300 220" role="img" aria-label={t("排程和计时时长散点图","Scheduled vs tracked time scatterplot")}><path d="M30 15V195H285" fill="none" stroke="currentColor" opacity=".45"/><path d="M30 195L285 15" fill="none" stroke="currentColor" strokeDasharray="4 4" opacity=".4"/>{observed.comparisons.map(x=><circle key={x.taskId+":"+x.recordId} cx={30+255*x.initial/comparisonScale} cy={195-180*x.tracked/comparisonScale} r="4" fill="var(--accent-active)"><title>{x.initial+" / "+x.tracked}</title></circle>)}</svg>
        <div className="df-metric-insight-table"><table><thead><tr><th>{t("任务","Task")}</th><th>{t("首次排程","First plan")}</th><th>{t("原估时","Estimate")}</th><th>{t("计时","Tracked")}</th></tr></thead><tbody>{observed.comparisons.map(x=><tr key={x.taskId+":"+x.recordId}><td>{p.data.tasks.find(q=>q.id===x.taskId)?.title||x.taskId}</td><td>{minutes(x.initial)}</td><td>{x.estimate===null?"—":minutes(x.estimate)}</td><td>{minutes(x.tracked)}</td></tr>)}</tbody></table></div></>:<p>{t("尚无同时具备首次排程、完成与关联计时的记录。","No comparable observed records yet.")}</p>}
      </>}</>}
      {view==="engagement"&&<><div className="df-metric-insight-stats">{stat(t("明确评分均值","Explicit weighted mean"),percent(result.explicitEngagement))}{stat(t("评分时长覆盖率","Rated time coverage"),percent(result.ratingCoverage))}{stat(t("明确评分加权时长","Explicit weighted time"),result.ratedMinutes?minutes(result.ratedWeighted):"—")}</div><p>{t("只计算已完成且明确评分的排程时长；默认 80% 不作为用户评分。","Uses completed scheduled intervals with explicit ratings only; default 80% is not a user rating.")}</p>{result.ratingCoverage!==null&&<progress max={100} value={result.ratingCoverage}/>}<h3>{t("明确评分分布","Explicit rating distribution")}</h3>{result.engagementBuckets.map(b=><div key={b.score} className="df-metric-insight-row"><span>{b.score}%</span><progress max={Math.max(1,...result.engagementBuckets.map(x=>x.minutes))} value={b.minutes}/><strong>{b.count}</strong></div>)}</>}
      {view==="projects"&&<><h3>{t("项目时间与执行","Project time and executions")}</h3><p>{t("按任务当前归属统计；实际计时缺失显示 —。","Grouped by current project; missing tracked time is shown as —.")}</p><div className="df-metric-insight-table"><table><thead><tr><th>{t("项目","Project")}</th><th>{t("排程","Scheduled")}</th><th>{t("完成","Completed")}</th><th>{t("计时","Tracked")}</th><th>{t("执行","Executions")}</th></tr></thead><tbody>{result.projects.map(pj=><tr key={pj.id}><td>{pj.id==="__unassigned__"?t("未归属","Unassigned"):pj.label}</td><td>{minutes(pj.scheduled)}</td><td>{minutes(pj.completed)}</td><td>{pj.trackedSessions?minutes(pj.tracked):"—"}</td><td>{pj.executions}</td></tr>)}</tbody></table></div></>}
      {view==="history"&&<><h3>{t("本机详细记录","Local detailed history")}</h3>
        {!p.scope?<p>{t("演示模式不记录活动。","Demo mode does not record activity.")}</p>:<>
          <p>{t("主动启用后记录本机提交的任务、排程、计时记录和属性变更。不上传云端，不追踪应用外活动。远端同步、撤销来源和计时过程尚未完整覆盖。","Opt in to record local task, schedule, time-entry and property changes. No new cloud upload or external activity tracking. Remote mutations, undo provenance and timer lifecycle are not fully covered.")}</p>
          {preference?.since&&<p>{t("开始记录","Recording started")}: {new Date(preference.since).toLocaleString()}</p>}
          <div className="df-metric-insight-actions">{action(preference?.enabled?t("暂停记录","Pause recording"):t("启用记录","Enable recording"),()=>{try{setAnalyticsEnabled(p.scope!,!preference?.enabled);setError(false);}catch{setError(true);}})}{action(t("导出显示的历史","Export visible history"),()=>downloadJson(historyRows),!historyRows.length)}{action(confirmClear?t("确认清除并暂停","Confirm clear & pause"):t("清除本机历史","Clear local history"),()=>{if(!confirmClear){setConfirmClear(true);return;}setConfirmClear(false);void clearAnalytics(p.scope!).catch(()=>setError(true));})}{confirmClear&&action(t("取消","Cancel"),()=>setConfirmClear(false))}</div>
          {(error||analyticsError(p.scope)||historyState==="error")&&<p role="alert">{t("历史记录存储不可用；任务操作不受影响。","History storage unavailable; task operations are unaffected.")}</p>}
          {historyState==="loading"?<p aria-live="polite">{t("读取中…","Loading…")}</p>:historyState==="ready"&&<><p>{events.length>500?t("显示所选日期及项目范围内最新 500 条记录。","Showing latest 500 records in the selected date and project range."):t("此处只显示所选时间与项目范围的本机历史。","Local history for selected date and project range.")}</p>{!historyRows.length?<p>{t("暂无已记录的变化","No recorded changes")}</p>:<div className="df-metric-insight-history">{historyRows.map(e=><details key={e.id}><summary>{new Date(e.occurredAt).toLocaleString()} · {e.entityType} · {e.action}</summary><p>{p.data.tasks.find(x=>x.id===e.taskId)?.title||e.entityId}</p><pre>{JSON.stringify({before:e.before,after:e.after},null,2)}</pre></details>)}</div>}</>}
        </>}
      </>}
    </section>}
  </>;
}
