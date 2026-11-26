import React,{ useEffect, useMemo, useState } from "react";
import type { PlannerData, Language } from "../types";
import { buildTimeAllocationMetrics, parseDayStartMinutes, type MetricHabitMode, type MetricCompletionFilter } from "./timeAllocation";
const MetricsAllocation=React.lazy(()=>import("./MetricsAllocation"));
import { buildInsights } from "./insightFacts";
import { analyticsError, analyticsPreference, clearAnalytics, readAnalyticsEvents, recoverAnalytics, captureDailyPlan, readDailyPlans, setAnalyticsEnabled, subscribeAnalytics } from "./activityStore";
import type { AnalyticsEvent } from "./activityEvents";
import { buildObservedPlanHistory } from "./historyAnalysis";
import { accuracySummary } from "./reviewMetrics";
const MetricsReview=React.lazy(()=>import("./MetricsReview"));
import { comparePlanBaseline, type PlanBaseline } from "./planBaseline";
import { readSavedViews, writeSavedViews, type SavedMetricsView, type MetricsQuery, type InsightView, type TimeChart } from "./savedViews";
import "./MetricsInsights.css";

type View = InsightView;
function downloadCsv(rows: {date:string;scheduled:number;completed:number;tracked:number;trackedSessions:number}[]) {
  const text=["Date,Scheduled minutes,Completed scheduled minutes,Tracked minutes",...rows.map(d=>[d.date,d.scheduled.toFixed(2),d.completed.toFixed(2),d.trackedSessions?d.tracked.toFixed(2):""].join(","))].join("\r\n");
  const url=URL.createObjectURL(new Blob([text],{type:"text/csv;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download="navopath-metrics.csv";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
type Props = { scope?:string; data:PlannerData; referenceDate?:string; dayStartTime?:string; weekStartsOn?:0|1; engagementEnabled?:boolean; projectIds:string[]; habitMode:MetricHabitMode; completion:MetricCompletionFilter; lang:Language; query:MetricsQuery; onApplyQuery:(query:MetricsQuery)=>void };
function minutes(n:number) { return (Math.round(n/6)/10).toFixed(1)+" h"; }
function percent(n:number|null) {return n===null?"—":Math.round(n)+"%";}
function downloadJson(events:unknown) {
  const url=URL.createObjectURL(new Blob([JSON.stringify(events,null,2)],{type:"application/json"}));
  const a=document.createElement("a");a.href=url;a.download="navopath-activity.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function MetricsInsights(props:Props) {
  const {data,query,referenceDate,weekStartsOn,engagementEnabled}=props;
  const dayStartMinutes=parseDayStartMinutes(props.dayStartTime);
  const allocation=useMemo(()=>buildTimeAllocationMetrics({data,range:{preset:query.range,anchorDate:referenceDate,customStart:query.customStart,customEnd:query.customEnd},dayStartMinutes,weekStartsOn,engagementEnabled,groupBy:query.group,habitMode:query.habit,completion:query.completion,projectIds:query.projects}),[data,query.range,query.customStart,query.customEnd,query.group,query.habit,query.completion,query.projects,referenceDate,dayStartMinutes,weekStartsOn,engagementEnabled]);
  const p={...props,allocation,dayStartMinutes};
  const [view,setView]=useState<View>("allocation");
  const [timeChart,setTimeChart]=useState<TimeChart>("trend");
  const [grain,setGrain]=useState<"day"|"week"|"month">("day");
  const [savedViews,setSavedViews]=useState(()=>p.scope?readSavedViews(p.scope):[]);
  const [viewName,setViewName]=useState("");
  const [selectedSaved,setSelectedSaved]=useState("");
  const [saveViewError,setSaveViewError]=useState(false);
  const [events,setEvents]=useState<AnalyticsEvent[]>([]);
  const [plans,setPlans]=useState<PlanBaseline[]>([]);
  const [historyState,setHistoryState]=useState<"loading"|"ready"|"error">("loading");
  const [revision,setRevision]=useState(0);
  const [confirmClear,setConfirmClear]=useState(false);
  const [historySource,setHistorySource]=useState("");
  const [historyEntity,setHistoryEntity]=useState("");
  const [historyLimit,setHistoryLimit]=useState(50);
  const [error,setError]=useState(false);
  const [selectedDate,setSelectedDate]=useState<string|null>(null);
  const t=(zh:string,en:string)=>p.lang==="zh"?zh:en;
  const preference=p.scope?analyticsPreference(p.scope):null;
  const result=useMemo(()=>buildInsights(p.data,p.allocation,p),[p.data,p.allocation,p.dayStartMinutes,p.projectIds,p.habitMode,p.completion]);
  const start=p.allocation.range.start.getTime(),end=p.allocation.range.end.getTime();
  const historyStart=p.query.range==="all"?Date.parse("2000-01-01T00:00:00Z"):start,historyEnd=p.query.range==="all"?Date.parse("2100-01-01T00:00:00Z"):end;
  useEffect(()=>p.scope?subscribeAnalytics(p.scope,()=>setRevision(n=>n+1)):undefined,[p.scope]);
  useEffect(()=>{
    if((view!=="history"&&view!=="execution")||!p.scope)return;
    let live=true;setHistoryState("loading");
    Promise.all([readAnalyticsEvents(p.scope,new Date(historyStart),new Date(historyEnd),view==="history"?historyLimit+1:501,p.projectIds,view==="history"?{source:historySource,entity:historyEntity}:undefined),readDailyPlans(p.scope,new Date(historyStart),new Date(historyEnd))]).then(([rows,baselines])=>{if(live){setEvents(rows);setPlans(baselines);setHistoryState("ready");}},()=>{if(live){setEvents([]);setPlans([]);setHistoryState("error");}});
    return()=>{live=false;};
  },[view,p.scope,historyStart,historyEnd,revision,p.projectIds,historySource,historyEntity,historyLimit]);
  useEffect(()=>setHistoryLimit(50),[historySource,historyEntity,start,end,p.projectIds]);
  useEffect(()=>setSelectedDate(null),[start,end]);
  const tabs: [View,string][]=[["overview",t("概览","Overview")],["allocation",t("分布","Allocation")],["time",t("时间","Time")],["execution",t("执行","Execution")],["engagement",t("投入度","Engagement")],["projects",t("项目","Projects")],["history",t("历史","History")]];
  const visibleDays=result.days.slice(-366),max=Math.max(1,...visibleDays.flatMap(d=>[d.scheduled,d.completed,d.tracked]));
  const groupedDays=useMemo(()=>{const map=new Map<string,typeof result.days[number]>();for(const d of result.days){let date=d.date;if(grain==="month")date=date.slice(0,7);if(grain==="week"){const dt=new Date(date+"T12:00:00");dt.setDate(dt.getDate()-(dt.getDay()-(p.weekStartsOn??1)+7)%7);date=[dt.getFullYear(),String(dt.getMonth()+1).padStart(2,"0"),String(dt.getDate()).padStart(2,"0")].join("-");}const prev=map.get(date)||{date,scheduled:0,completed:0,tracked:0,trackedSessions:0};prev.scheduled+=d.scheduled;prev.completed+=d.completed;prev.tracked+=d.tracked;prev.trackedSessions+=d.trackedSessions;map.set(date,prev);}return [...map.values()].slice(-366);},[result.days,grain,p.weekStartsOn]);
  const trendMax=Math.max(1,...groupedDays.flatMap(d=>[d.scheduled,d.completed,d.tracked]));
  const historyRows=events.slice(0,view==="history"?historyLimit:500);
  const observed=useMemo(()=>buildObservedPlanHistory(historyRows,p.data,p.allocation.range),[events,p.data,p.allocation.range]);
  const comparisonScale=Math.max(1,...observed.comparisons.flatMap(x=>[x.initial,x.tracked]));
  const accuracy=accuracySummary(observed.comparisons);
  function persistViews(next:SavedMetricsView[]){if(!p.scope)return;try{writeSavedViews(p.scope,next);setSavedViews(next);setSaveViewError(false);}catch{setSaveViewError(true);}}
  function applySaved(saved:SavedMetricsView){setSelectedSaved(saved.id);setView(saved.view);setTimeChart(saved.chart);setGrain(saved.grain||"day");setViewName(saved.name);p.onApplyQuery(saved.query);}
  function saveCurrent(){if(!p.scope||!viewName.trim()||savedViews.length>=50)return;const saved={id:crypto.randomUUID(),name:viewName.trim().slice(0,80),view,chart:timeChart,grain,query:p.query};persistViews([...savedViews,saved]);setSelectedSaved(saved.id);}
  function changeOrder(delta:number){const at=savedViews.findIndex(x=>x.id===selectedSaved),to=at+delta;if(at<0||to<0||to>=savedViews.length)return;const next=[...savedViews];[next[at],next[to]]=[next[to],next[at]];persistViews(next);}
  const stat=(label:string,value:string)=><div><span>{label}</span><strong>{value}</strong></div>;
  const action=(label:string,fn:()=>void,disabled=false)=><button type="button" className="df-metrics-text-action" disabled={disabled} onClick={fn}>{label}</button>;
  return <>
    <nav className="df-metric-insight-tabs" aria-label={t("统计视图","Metrics views")}>{tabs.map(([id,label])=><button type="button" key={id} className="df-metrics-text-action" aria-pressed={view===id} onClick={()=>setView(id)}>{label}</button>)}</nav>
    {p.scope&&<details className="df-metric-saved-views"><summary>{t("保存的统计视图","Saved metrics views")}</summary><div className="df-metric-insight-actions">
      <select aria-label={t("选择统计视图","Select a saved view")} value={selectedSaved} onChange={e=>{const saved=savedViews.find(x=>x.id===e.target.value);if(saved)applySaved(saved);else {setSelectedSaved("");setViewName("");}}}><option value="">{t("自定义视图","Custom view")}</option>{savedViews.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select>
      <input aria-label={t("视图名称","View name")} placeholder={t("视图名称","View name")} maxLength={80} value={viewName} onChange={e=>setViewName(e.target.value)}/>
      {action(t("保存为新视图","Save as new"),saveCurrent,!viewName.trim()||savedViews.length>=50)}
      {action(t("更新所选视图","Update selected"),()=>persistViews(savedViews.map(x=>x.id===selectedSaved?{...x,name:viewName.trim(),view,chart:timeChart,grain,query:p.query}:x)),!selectedSaved||!viewName.trim())}
      {action(t("上移","Move up"),()=>changeOrder(-1),savedViews.findIndex(x=>x.id===selectedSaved)<=0)}
      {action(t("下移","Move down"),()=>changeOrder(1),!selectedSaved||savedViews.findIndex(x=>x.id===selectedSaved)>=savedViews.length-1)}
      {action(t("删除视图","Delete view"),()=>{persistViews(savedViews.filter(x=>x.id!==selectedSaved));setSelectedSaved("");setViewName("");},!selectedSaved)}
      {action(t("每日复盘","Daily review"),()=>{setView("execution");p.onApplyQuery({...p.query,range:"today",completion:"all"});})}
      {action(t("本周时间","Weekly time"),()=>{setView("time");setTimeChart("trend");p.onApplyQuery({...p.query,range:"thisWeek",completion:"all"});})}
      {action(t("本月投入度","Monthly engagement"),()=>{setView("engagement");p.onApplyQuery({...p.query,range:"thisMonth",completion:"all"});})}
      {saveViewError&&<span role="alert">{t("无法保存视图","Could not save view")}</span>}
    </div></details>}
    {view==="allocation"?<React.Suspense fallback={<p role="status">{t("正在加载分布…","Loading allocation…")}</p>}><MetricsAllocation lang={p.lang} engagementEnabled={p.engagementEnabled} metricsResult={allocation} display={p.query.display} onAdjustRange={()=>p.onApplyQuery({...p.query,range:"today"})}/></React.Suspense>:<section className="df-metric-insight-content">
      {view==="overview"&&<React.Suspense fallback={<p role="status">{t("正在加载概览…","Loading overview…")}</p>}><MetricsReview data={p.data} allocation={allocation} result={result} query={p.query} dayStartMinutes={dayStartMinutes} weekStartsOn={weekStartsOn} lang={p.lang} onApplyQuery={p.onApplyQuery}/></React.Suspense>}
      {view==="time"&&<>
        <div className="df-metric-insight-stats">{stat(t("排程时长","Scheduled"),minutes(result.scheduled))}{stat(t("已完成排程","Completed scheduled"),minutes(result.completed))}{stat(t("实际计时","Tracked"),result.trackedSessions?minutes(result.tracked):"—")}{stat(t("时间轴占用","Occupied timeline"),minutes(result.occupied))}{stat(t("计时关联覆盖","Linked measurement coverage"),percent(result.measurementCoverage))}</div>
        <p>{t("排程时长不代表实测时长；跨日计时按记录区间比例分配。","Scheduled time is not measured time; cross-day tracked duration is apportioned by interval.")}</p>
        {result.trackedSessions>0&&<p>{t("计时来源：秒表 / 手动 / 空闲调整","Tracked sources: timer / manual / idle-adjusted")}: {Object.values(result.trackedBySource).map(minutes).join(" / ")}</p>}
        <h3>{t("时间趋势","Time trend")}</h3>
        {timeChart==="trend"&&<div className="df-metric-insight-tabs">{(["day","week","month"] as const).map(g=><button key={g} type="button" className="df-metrics-text-action" aria-pressed={grain===g} onClick={()=>{setGrain(g);setSelectedDate(null);}}>{g==="day"?t("日","Day"):g==="week"?t("周","Week"):t("月","Month")}</button>)}</div>}
        <div className="df-metric-insight-tabs">{(["trend","heatmap","table"] as const).map(v=><button key={v} type="button" className="df-metrics-text-action" aria-pressed={timeChart===v} onClick={()=>setTimeChart(v)}>{v==="trend"?t("趋势","Trend"):v==="heatmap"?t("热力图","Heatmap"):t("数据表","Table")}</button>)}{action(t("导出 CSV","Export CSV"),()=>downloadCsv(timeChart==="trend"?groupedDays:result.days),!result.days.length)}</div>
        <p>{t("排程 / 完成 / 计时","Scheduled / Completed / Tracked")}</p>
        {result.days.length>366&&<p>{t("图表显示最近 366 个有记录的日期；汇总涵盖所选范围。","Chart shows the latest 366 recorded dates; totals cover the selected range.")}</p>}
        {visibleDays.length===0?<p>{t("暂无记录","No records")}</p>:timeChart==="trend"?<div className="df-metric-insight-trend">{groupedDays.map(d=><button type="button" key={d.date} aria-pressed={selectedDate===d.date} onClick={()=>setSelectedDate(selectedDate===d.date?null:d.date)} title={d.date+" · "+[d.scheduled,d.completed,d.tracked].map(minutes).join(" / ")} aria-label={d.date+" "+[d.scheduled,d.completed,d.tracked].map(minutes).join(" / ")}><span>{d.date.slice(5)}</span><span className="df-metric-insight-bars">{[d.scheduled,d.completed,d.tracked].map((v,i)=><i key={i} style={{height:(v/trendMax*100)+"%"}}/>)}</span></button>)}</div>:timeChart==="heatmap"?<div className="df-metric-insight-heatmap" aria-label={t("已完成排程热力图","Completed scheduled time heatmap")}>{visibleDays.map(d=><button type="button" key={d.date} aria-pressed={selectedDate===d.date} onClick={()=>setSelectedDate(selectedDate===d.date?null:d.date)} style={{backgroundColor:"color-mix(in srgb, var(--accent-active) "+Math.round(10+d.completed/max*85)+"%, var(--paper-rule))"}} title={d.date+" · "+minutes(d.completed)} aria-label={d.date+" "+minutes(d.completed)}>{d.date.slice(5)}</button>)}</div>:<div className="df-metric-insight-table"><table><thead><tr><th>{t("日期","Date")}</th><th>{t("排程","Scheduled")}</th><th>{t("完成","Completed")}</th><th>{t("计时","Tracked")}</th></tr></thead><tbody>{visibleDays.map(d=><tr key={d.date}><td>{d.date}</td><td>{minutes(d.scheduled)}</td><td>{minutes(d.completed)}</td><td>{d.trackedSessions?minutes(d.tracked):"—"}</td></tr>)}</tbody></table></div>}
        {selectedDate&&<div>{(timeChart==="trend"?groupedDays:visibleDays).filter(d=>d.date===selectedDate).map(d=><p key={d.date}>{d.date} · {minutes(d.scheduled)} / {minutes(d.completed)} / {minutes(d.tracked)}</p>)}</div>}
      </>}
      {view==="execution"&&<><div className="df-metric-insight-stats">{stat(t("独立执行","Executions"),String(result.executionCount))}{stat(t("完成执行","Completed"),String(result.statuses.completed))}{stat(t("完成比例","Completed share"),result.executionCount?percent(result.statuses.completed/result.executionCount*100):"—")}</div>
        {([["scheduled",t("已安排","Scheduled")],["completed",t("完成","Completed")],["returned_unfinished",t("返回规划","Returned")],["skipped",t("跳过","Skipped")]] as const).map(([id,label])=><div className="df-metric-insight-row" key={id}><span>{label}</span><progress max={Math.max(1,result.executionCount)} value={result.statuses[id]||0}/><strong>{result.statuses[id]||0}</strong></div>)}
        <p>{t("取消执行（单独计数）","Cancelled executions (separate count)")}: {result.statuses.cancelled}. {t("取消不进入完成比例分母。","Cancelled records are excluded from the completion-share denominator.")}</p>
      <h3>{t("每日首次观察计划","First observed daily plan")}</h3>
      <p>{t("只保存启用记录后每日第一次观察到的计划；捕获时间晚于日界线时不代表原始计划。未捕获日期不补造。","Only the first observed plan each day after opt-in is saved. A late capture is not an original day-start plan; missing days are not reconstructed.")}</p>
      {plans.length?<div className="df-metric-insight-table"><table><thead><tr><th>{t("日期 / 捕获时间","Date / captured")}</th><th>{t("首次观察","First observed")}</th><th>{t("当前计划","Current plan")}</th><th>{t("后来新增","Added later")}</th></tr></thead><tbody>{plans.map(plan=>{const d=comparePlanBaseline(plan,p.allocation.taskEntries,p.query);return <tr key={plan.id}><td title={plan.timezone}>{plan.date} · {new Date(plan.capturedAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</td><td>{minutes(d.baselineMinutes)}</td><td>{minutes(d.currentMinutes)}</td><td>{minutes(d.addedMinutes)}</td></tr>;})}</tbody></table></div>:<p>{t("暂无已捕获快照","No captured snapshots")}</p>}
      <h3>{t("已观察到的计划变更","Observed plan changes")}</h3>
      {(!p.scope||historyState!=="ready"||!historyRows.length)?<p>{historyState==="loading"&&p.scope?t("读取历史中…","Loading history…"):t("暂无可验证的本机历史，请在历史视图启用详细记录。","No verified local history; enable detailed recording in History.")}</p>:<>
        <div className="df-metric-insight-stats">{stat(t("改期次数","Observed moves"),String(observed.moveCount))}{stat(t("时长调整次数","Observed resizes"),String(observed.resizeCount))}{stat(t("被移除的执行","Removed executions"),String(observed.removed))}</div>
        <p>{t("按本机操作日期统计，排除撤销及远端观察，最多 500 条；不能代表完整改期率。","By local change date, excluding undo and remote observations (up to 500); not a complete reschedule rate.")}</p>
        <h3>{t("首次观察排程与实际计时","First observed schedule vs tracked time")}</h3>
        {accuracy.schedule.count>0&&<div className="df-metric-insight-table"><table><thead><tr><th>{t("对比基准","Reference")}</th><th>{t("样本","Samples")}</th><th>{t("平均偏差","Mean bias")}</th><th>{t("平均绝对误差","Mean absolute error")}</th></tr></thead><tbody>{([[t("首次排程","First schedule"),accuracy.schedule],[t("任务估时","Task estimate"),accuracy.estimate]] as const).map(([label,a])=><tr key={label}><td>{label}</td><td>{a.count}</td><td>{a.bias===null?"—":(a.bias>0?"+":"")+Math.round(a.bias)+" min"}</td><td>{a.mae===null?"—":Math.round(a.mae)+" min"}</td></tr>)}</tbody></table><p>{t("偏差 = 实际 − 基准。任务估时只对当前仅有一条独立排程且有完整观察证据的任务计算；排除撤销和远端不确定变化。","Bias = tracked − reference. Task estimates require one current execution and observed evidence; undo and uncertain remote changes are excluded.")}</p></div>}
        {observed.comparisons.length?<><p>{t("横轴：首次观察排程分钟；纵轴：已记录计时分钟。只包含记录到创建、完成且具有关联计时的执行。","X: first observed scheduled minutes; Y: tracked minutes. Requires observed creation, completion and linked time entries.")}</p><svg className="df-metric-insight-scatter" viewBox="0 0 300 220" role="img" aria-label={t("排程和计时时长散点图","Scheduled vs tracked time scatterplot")}><path d="M30 15V195H285" fill="none" stroke="currentColor" opacity=".45"/><path d="M30 195L285 15" fill="none" stroke="currentColor" strokeDasharray="4 4" opacity=".4"/>{observed.comparisons.map(x=><circle key={x.taskId+":"+x.recordId} cx={30+255*x.initial/comparisonScale} cy={195-180*x.tracked/comparisonScale} r="4" fill="var(--accent-active)"><title>{x.initial+" / "+x.tracked}</title></circle>)}</svg>
        <div className="df-metric-insight-table"><table><thead><tr><th>{t("任务","Task")}</th><th>{t("首次排程","First plan")}</th><th>{t("原估时","Estimate")}</th><th>{t("计时","Tracked")}</th></tr></thead><tbody>{observed.comparisons.map(x=><tr key={x.taskId+":"+x.recordId}><td>{p.data.tasks.find(q=>q.id===x.taskId)?.title||x.taskId}</td><td>{minutes(x.initial)}</td><td>{x.estimate===null?"—":minutes(x.estimate)}</td><td>{minutes(x.tracked)}</td></tr>)}</tbody></table></div></>:<p>{t("尚无同时具备首次排程、完成与关联计时的记录。","No comparable observed records yet.")}</p>}
      </>}</>}
      {view==="engagement"&&<><div className="df-metric-insight-stats">{stat(t("明确评分均值","Explicit weighted mean"),percent(result.explicitEngagement))}{stat(t("评分时长覆盖率","Rated time coverage"),percent(result.ratingCoverage))}{stat(t("明确评分加权时长","Explicit weighted time"),result.ratedMinutes?minutes(result.ratedWeighted):"—")}</div><p>{t("只计算已完成且明确评分的排程时长；默认 80% 不作为用户评分。","Uses completed scheduled intervals with explicit ratings only; default 80% is not a user rating.")}</p>{result.ratingCoverage!==null&&<progress max={100} value={result.ratingCoverage}/>}<h3>{t("明确评分分布","Explicit rating distribution")}</h3>{result.engagementBuckets.map(b=><div key={b.score} className="df-metric-insight-row"><span>{b.score}%</span><progress max={Math.max(1,...result.engagementBuckets.map(x=>x.minutes))} value={b.minutes}/><strong>{b.count}</strong></div>)}</>}
      {view==="time"&&<><h3>{t("星期 × 时段：已完成排程","Weekday × hour: completed schedules")}</h3><p>{t("按本地钟表时间分布；颜色表示已完成排程分钟，不代表实测专注时间。","Local clock hours; intensity is completed scheduled minutes, not measured focus.")}</p><div className="df-metric-hour-grid" role="table" aria-label={t("星期与小时热力图","Weekday-hour heatmap")}>{result.completedHours.map((hours,i)=><div key={i} role="row"><span role="rowheader">{(p.lang==="zh"?["一","二","三","四","五","六","日"]:["Mon","Tue","Wed","Thu","Fri","Sat","Sun"])[i]}</span>{hours.map((m,h)=><span role="cell" key={h} title={h+":00 · "+minutes(m)} aria-label={h+":00 "+minutes(m)} style={{backgroundColor:"color-mix(in srgb, var(--accent-active) "+Math.round(m/Math.max(1,...result.completedHours.flat())*85)+"%, var(--paper-rule))"}}/>)}</div>)}</div></>}
      {view==="projects"&&<><h3>{t("项目时间与执行","Project time and executions")}</h3><p>{t("按任务当前归属统计，已删除任务的存留计时使用记录中的归属；缺失计时显示 —。","Grouped by current project; surviving entries of deleted tasks use recorded attribution. Missing tracked time is shown as —.")}</p><div className="df-metric-insight-table"><table><thead><tr><th>{t("项目","Project")}</th><th>{t("排程","Scheduled")}</th><th>{t("完成","Completed")}</th><th>{t("计时","Tracked")}</th><th>{t("执行","Executions")}</th></tr></thead><tbody>{result.projects.map(pj=><tr key={pj.id}><td>{pj.id==="__unassigned__"?t("未归属","Unassigned"):pj.label}</td><td>{minutes(pj.scheduled)}</td><td>{minutes(pj.completed)}</td><td>{pj.trackedSessions?minutes(pj.tracked):"—"}</td><td>{pj.executions}</td></tr>)}</tbody></table></div></>}
      {view==="history"&&<><h3>{t("本机详细记录","Local detailed history")}</h3>
        {!p.scope?<p>{t("演示模式不记录活动。","Demo mode does not record activity.")}</p>:<>
          <p>{t("主动启用后记录本机任务、排程、计时及属性变化，包括部分撤销、插件、系统操作和秒表状态。远端变化只记录观察时间，不推断操作者。不上传云端，不追踪应用外活动。","Opt in to local task, schedule, time-entry and property changes, including supported undo, plugin, system and stopwatch transitions. Remote changes are observations, not attributed to an actor. No new cloud upload or external activity tracking.")}</p>
          {preference?.since&&<p>{t("开始记录","Recording started")}: {new Date(preference.since).toLocaleString()}{preference.hasGaps&&" · "+t("曾暂停，历史存在覆盖缺口","Recording has been paused; coverage has gaps")}</p>}
          <div className="df-metric-insight-actions">{action(preference?.enabled?t("暂停记录","Pause recording"):t("启用记录","Enable recording"),()=>{try{setAnalyticsEnabled(p.scope!,!preference?.enabled);if(!preference?.enabled){void recoverAnalytics(p.scope!);captureDailyPlan(p.scope!,p.data,new Date().toISOString(),p.dayStartTime,analyticsPreference(p.scope!).generation);}setError(false);}catch{setError(true);}})}{action(t("导出显示的历史","Export visible history"),()=>downloadJson({schemaVersion:1,exportedAt:new Date().toISOString(),timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,range:{start:new Date(historyStart).toISOString(),end:new Date(historyEnd).toISOString()},filters:{projectIds:p.projectIds,source:historySource||null,entity:historyEntity||null},limited:events.length>historyLimit,events:historyRows}),!historyRows.length)}{action(confirmClear?t("确认清除并暂停","Confirm clear & pause"):t("清除本机历史","Clear local history"),()=>{if(!confirmClear){setConfirmClear(true);return;}setConfirmClear(false);void clearAnalytics(p.scope!).catch(()=>setError(true));})}{confirmClear&&action(t("取消","Cancel"),()=>setConfirmClear(false))}</div>
          {(error||analyticsError(p.scope)||historyState==="error")&&<p role="alert">{t("历史记录存储不可用；任务操作不受影响。","History storage unavailable; task operations are unaffected.")}</p>}
          <div className="df-metric-insight-actions df-metric-history-filters"><label>{t("来源","Source")} <select value={historySource} onChange={e=>setHistorySource(e.target.value)}>{[["",t("全部","All")],["client",t("本机","Local")],["plugin",t("插件","Plugin")],["sync",t("同步","Sync")],["system",t("系统","System")],["undo",t("撤销","Undo")],["remote-observed",t("远端观察","Remote observation")]].map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></label><label>{t("记录类型","Entity")} <select value={historyEntity} onChange={e=>setHistoryEntity(e.target.value)}>{[["",t("全部","All")],["task",t("任务","Task")],["subtask",t("子任务","Subtask")],["execution",t("排程","Execution")],["timeEntry",t("计时","Time entry")],["timer",t("计时状态","Timer")],["habit",t("习惯","Habit")],["project",t("项目","Project")]].map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></label></div>
          {historyState==="loading"?<p aria-live="polite">{t("读取中…","Loading…")}</p>:historyState==="ready"&&<><p>{events.length>historyLimit?t("显示筛选后的最近记录，可加载更多。","Showing recent matching records; load more below."):t("显示所选范围及筛选条件的本机历史。","Local history for the selected range and filters.")}</p>{!historyRows.length?<p>{t("暂无已记录的变化","No recorded changes")}</p>:<div className="df-metric-insight-history">{historyRows.map(e=><details key={e.id}><summary>{new Date(e.occurredAt).toLocaleString()} · {e.entityType} · {e.action} · {e.source}</summary><p>{p.data.tasks.find(x=>x.id===e.taskId)?.title||e.entityId}</p><pre>{JSON.stringify({before:e.before,after:e.after},null,2)}</pre></details>)}</div>}{events.length>historyLimit&&historyLimit<500&&action(t("加载更多","Load more"),()=>setHistoryLimit(n=>Math.min(500,n+50)))}{events.length>historyLimit&&historyLimit>=500&&<p>{t("已达到 500 条显示上限；请缩小筛选范围。","500-record display limit; narrow the filters.")}</p>}</>}
        </>}
      </>}
    </section>}
  </>;
}
