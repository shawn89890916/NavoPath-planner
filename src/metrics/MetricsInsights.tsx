import React,{ useEffect, useMemo, useState } from "react";
import type { PlannerData, Language } from "../types";
import { buildTimeAllocationMetrics, parseDayStartMinutes, type MetricHabitMode, type MetricCompletionFilter } from "./timeAllocation";
const MetricsAllocation=React.lazy(()=>import("./MetricsAllocation"));
import { buildInsights } from "./insightFacts";
import { analyticsError, analyticsPreference, clearAnalytics, readAnalyticsEvents, scanAnalyticsEvents, type AnalyticsPageCursor, recoverAnalytics, captureDailyPlan, readDailyPlans, setAnalyticsEnabled, subscribeAnalytics } from "./activityStore";
import type { AnalyticsEvent } from "./activityEvents";
import { createObservedPlanAccumulator, type ObservedPlanHistory } from "./historyAnalysis";
import { accuracySummary } from "./reviewMetrics";
const MetricsReview=React.lazy(()=>import("./MetricsReview"));
const MetricsTimeSeries=React.lazy(()=>import("./MetricsTimeSeries"));
const MetricsBreakdown=React.lazy(()=>import("./MetricsBreakdown"));
import { comparePlanBaseline, type PlanBaseline } from "./planBaseline";
import { readSavedViews, writeSavedViews, type SavedMetricsView, type MetricsQuery, type InsightView, type TimeChart } from "./savedViews";
import "./MetricsInsights.css";

type View = InsightView;
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
  const [loaded,setLoaded]=useState<{key:string;state:"ready"|"error"}|null>(null);
  const [observed,setObserved]=useState<ObservedPlanHistory|null>(null);
  const [revision,setRevision]=useState(0);
  const [confirmClear,setConfirmClear]=useState(false);
  const [historySource,setHistorySource]=useState("");
  const [historyEntity,setHistoryEntity]=useState("");
  const historyLimit=50;
  const [historyPage,setHistoryPage]=useState<{key:string;trail:(AnalyticsPageCursor|null)[]}>({key:"",trail:[null]});
  const [detailPage,setDetailPage]=useState(0);
  const [scatterReference,setScatterReference]=useState<"initial"|"final">("initial");
  const [error,setError]=useState(false);
  const t=(zh:string,en:string)=>p.lang==="zh"?zh:en;
  const preference=p.scope?analyticsPreference(p.scope):null;
  const result=useMemo(()=>buildInsights(p.data,p.allocation,p),[p.data,p.allocation,p.dayStartMinutes,p.projectIds,p.habitMode,p.completion]);
  const start=p.allocation.range.start.getTime(),end=p.allocation.range.end.getTime();
  const historyStart=p.query.range==="all"?Date.parse("2000-01-01T00:00:00Z"):start,historyEnd=p.query.range==="all"?Date.parse("2100-01-01T00:00:00Z"):end;
  const pageKey=JSON.stringify([p.scope,historyStart,historyEnd,p.projectIds,historySource,historyEntity]);
  const trail=historyPage.key===pageKey?historyPage.trail:[null];
  const before=trail[trail.length-1]||undefined;
  const requestKey=JSON.stringify([view,pageKey,view==="history"?before:null,revision]);
  const historyState=loaded?.key===requestKey?loaded.state:"loading";
  useEffect(()=>p.scope?subscribeAnalytics(p.scope,()=>setRevision(n=>n+1)):undefined,[p.scope]);
  useEffect(()=>{
    if((view!=="history"&&view!=="execution")||!p.scope)return;
    setLoaded(null);
    const controller=new AbortController(),scope=p.scope;
    const range={start:new Date(historyStart),end:new Date(historyEnd)};
    async function load(){
      if(view==="history"){
        const rows=await readAnalyticsEvents(scope,range.start,range.end,historyLimit+1,p.projectIds,{source:historySource,entity:historyEntity},{before,signal:controller.signal});
        if(!controller.signal.aborted)setEvents(rows);
      }else{
        const accumulator=createObservedPlanAccumulator(p.data,p.allocation.range,p.projectIds);
        const [,baselines]=await Promise.all([scanAnalyticsEvents(scope,range.start,range.end,accumulator.add,{signal:controller.signal}),readDailyPlans(scope,range.start,range.end)]);
        if(!controller.signal.aborted){setObserved(accumulator.finish());setPlans(baselines);setDetailPage(0);}
      }
      if(!controller.signal.aborted)setLoaded({key:requestKey,state:"ready"});
    }
    void load().catch(()=>{if(!controller.signal.aborted){setEvents([]);setPlans([]);setObserved(null);setLoaded({key:requestKey,state:"error"});}});
    return()=>controller.abort();
  },[requestKey,p.data,p.allocation.range]);
  const tabs: [View,string][]=[["overview",t("概览","Overview")],["allocation",t("分布","Allocation")],["time",t("时间","Time")],["execution",t("执行","Execution")],["engagement",t("投入度","Engagement")],["projects",t("项目","Projects")],["history",t("历史","History")]];
  const historyRows=historyState==="ready"&&view==="history"?events.slice(0,historyLimit):[];
  const comparisons=historyState==="ready"&&view==="execution"?observed?.comparisons||[]:[];
  const accuracy=useMemo(()=>accuracySummary(comparisons),[comparisons]);
  const comparisonScale=useMemo(()=>comparisons.reduce((max,x)=>Math.max(max,x.initial,x.final,x.tracked),1),[comparisons]);
  const scatter=useMemo(()=>comparisons.length<=500?comparisons:Array.from({length:500},(_,i)=>comparisons[Math.floor(i*comparisons.length/500)]),[comparisons]);
  const taskTitles=useMemo(()=>new Map(p.data.tasks.map(x=>[x.id,x.title])),[p.data.tasks]);
  const detailRows=comparisons.slice(detailPage*50,detailPage*50+50);
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
      {view==="time"&&<React.Suspense fallback={<p role="status">{t("正在加载时间统计…","Loading time statistics…")}</p>}><MetricsTimeSeries data={p.data} allocation={allocation} result={result} dayStartMinutes={dayStartMinutes} weekStartsOn={weekStartsOn} lang={p.lang} chart={timeChart} grain={grain} setChart={setTimeChart} setGrain={setGrain}/></React.Suspense>}
      {view==="execution"&&<><div className="df-metric-insight-stats">{stat(t("独立执行","Executions"),String(result.executionCount))}{stat(t("完成执行","Completed"),String(result.statuses.completed))}{stat(t("完成比例","Completed share"),result.executionCount?percent(result.statuses.completed/result.executionCount*100):"—")}</div>
        {([["scheduled",t("已安排","Scheduled")],["completed",t("完成","Completed")],["returned_unfinished",t("返回规划","Returned")],["skipped",t("跳过","Skipped")]] as const).map(([id,label])=><div className="df-metric-insight-row" key={id}><span>{label}</span><progress max={Math.max(1,result.executionCount)} value={result.statuses[id]||0}/><strong>{result.statuses[id]||0}</strong></div>)}
        <p>{t("取消执行（单独计数）","Cancelled executions (separate count)")}: {result.statuses.cancelled}. {t("取消不进入完成比例分母。","Cancelled records are excluded from the completion-share denominator.")}</p>
      <h3>{t("每日首次观察计划","First observed daily plan")}</h3>
      <p>{t("只保存启用记录后每日第一次观察到的计划；捕获时间晚于日界线时不代表原始计划。未捕获日期不补造。","Only the first observed plan each day after opt-in is saved. A late capture is not an original day-start plan; missing days are not reconstructed.")}</p>
      {historyState==="ready"&&plans.length?<div className="df-metric-insight-table"><table><thead><tr><th>{t("日期 / 捕获时间","Date / captured")}</th><th>{t("首次观察","First observed")}</th><th>{t("当前计划","Current plan")}</th><th>{t("后来新增","Added later")}</th><th>{t("同日保留","Retained same day")}</th><th>{t("进入筛选范围","Entered scope")}</th><th>{t("离开当前范围","Absent from current scope")}</th><th>{t("原待办已完成","Initially pending, now done")}</th></tr></thead><tbody>{plans.map(plan=>{const compatible=plan.dayStartMinutes===dayStartMinutes&&plan.timezone===Intl.DateTimeFormat().resolvedOptions().timeZone&&Date.parse(plan.dayStartAt)>=start&&Date.parse(plan.dayEndAt)<=end;const d=compatible?comparePlanBaseline(plan,p.allocation.taskEntries,p.query):null;return <tr key={plan.id}><td title={plan.timezone}>{plan.date} · {new Date(plan.capturedAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</td>{d?<><td>{minutes(d.baselineMinutes)}</td><td>{minutes(d.currentMinutes)}</td><td>{minutes(d.addedMinutes)}</td><td>{minutes(d.retainedMinutes)}</td><td>{minutes(d.enteredScopeMinutes)}</td><td>{d.absentExecutions}/{d.baselineExecutions}</td><td>{d.pendingExecutions===null||!d.pendingExecutions?"—":d.completedPending+"/"+d.pendingExecutions}</td></>:<td colSpan={7}>{t("日界线、时区或日期范围不一致，无法直接对比","Incompatible day boundary, timezone or date range")}</td>}</tr>;})}</tbody></table></div>:<p>{t("暂无已捕获快照","No captured snapshots")}</p>}
      {historyState==="ready"&&plans.length>0&&<p>{t("同日保留为原记录在当前筛选范围内的排程时长；离开范围可能是改期、删除或归属变化，并不等同取消。原待办已完成仅统计新格式快照中明确存在、当时未完成的真实执行，需选择全部完成状态；旧快照、预测实例及零分母显示 —。","Retained means current scheduled time of original records in scope. Absence can reflect moving, deletion or attribution changes, not necessarily cancellation. Initially pending completion uses explicitly existing, pending executions from new snapshots with all statuses selected; old snapshots, projections and zero denominators are unknown.")}</p>}
      {historyState==="ready"&&plans.length===366&&<p>{t("最多显示最近 366 个每日快照。","Showing up to the latest 366 daily snapshots.")}</p>}
      <h3>{t("已观察到的计划变更","Observed plan changes")}</h3>
      {(!p.scope||historyState!=="ready"||!observed?.eventCount)?<p>{historyState==="loading"&&p.scope?t("读取历史中…","Loading history…"):historyState==="error"?t("历史读取失败，请重试。","History could not be read; retry."):t("暂无可验证的本机历史，请在历史视图启用详细记录。","No verified local history; enable detailed recording in History.")}</p>:<>
        <div className="df-metric-insight-stats">{stat(t("改期次数","Observed moves"),String(observed!.moveCount))}{stat(t("时长调整次数","Observed resizes"),String(observed!.resizeCount))}{stat(t("被移除的执行","Removed executions"),String(observed!.removed))}</div>
        <p>{t("按所选范围内全部已记录事件统计，排除撤销和远端或同步观察；未记录时段不补造。","All recorded events in the selected range, excluding undo and remote or sync observations; unrecorded periods are not reconstructed.")}</p>
        <p>{t("排除存在不确定来源的执行后，发生过改期","With uncertain executions excluded, observed moves")}: {observed!.eligibleMoved}/{observed!.eligibleObserved} · {t("发生过时长调整","Observed resizes")}: {observed!.eligibleResized}/{observed!.eligibleObserved}。{t("分母仅为范围内有观察事件的执行，非全部计划。历史事件按发生时项目筛选，不应用当前习惯及完成状态筛选。","Denominator is executions with observed events in range, not all plans. Historical events use event-time project filters, not current habit/completion filters.")}</p>
        <h3>{t("首次与末次观察排程","First vs last observed schedule")}</h3>
        {observed!.completedPlanSamples?<div className="df-metric-insight-stats">{stat(t("可比完成执行","Comparable completed executions"),String(observed!.completedPlanSamples))}{stat(t("延长 / 缩短 / 不变","Longer / shorter / unchanged"),[observed!.planLengthened,observed!.planShortened,observed!.planUnchanged].join(" / "))}{stat(t("平均排程变化","Mean duration change"),Math.round(observed!.planChangeMinutes/observed!.completedPlanSamples)+" min")}</div>:<p>{t("暂无创建与完成均有明确观察证据的执行。","No executions with observed creation and completion evidence.")}</p>}
        <p>{t("末次观察为所选历史范围内最后记录的完成状态排程，并非未观测的最终安排；不需要有计时才能比较首次与末次时长。","Last observed is the last recorded completed schedule within the history window, not an unobserved final plan; tracking is not required for duration changes.")}</p>
        <h3>{t("观察排程与关联计时","Observed schedules vs linked tracking")}</h3>
        {accuracy.schedule.count>0&&<div className="df-metric-insight-table"><table><thead><tr><th>{t("对比基准","Reference")}</th><th>{t("样本","Samples")}</th><th>{t("平均偏差","Mean bias")}</th><th>{t("平均绝对误差","Mean absolute error")}</th></tr></thead><tbody>{([[t("首次排程","First schedule"),accuracy.schedule],[t("末次观察排程","Last observed schedule"),accuracy.final],[t("任务估时","Task estimate"),accuracy.estimate]] as const).map(([label,a])=><tr key={label}><td>{label}</td><td>{a.count}</td><td>{a.bias===null?"—":(a.bias>0?"+":"")+Math.round(a.bias)+" min"}</td><td>{a.mae===null?"—":Math.round(a.mae)+" min"}</td></tr>)}</tbody></table><p>{t("偏差 = 实际 − 基准。任务估时只对当前仅有一条独立排程且有完整观察证据的任务计算；排除撤销和远端不确定变化。","Bias = tracked − reference. Task estimates require one current execution and observed evidence; undo and uncertain remote changes are excluded.")}</p></div>}
        {comparisons.length?<><div className="df-metric-insight-tabs">{(["initial","final"] as const).map(ref=><button key={ref} className="df-metrics-text-action" type="button" aria-pressed={scatterReference===ref} onClick={()=>setScatterReference(ref)}>{ref==="initial"?t("首次排程","First schedule"):t("末次观察排程","Last observed schedule")}</button>)}</div><p>{t("横轴：所选排程基准分钟；纵轴：已记录计时分钟。切换基准时保持同一坐标尺度与样本。","X: selected schedule reference minutes; Y: tracked minutes. Both references use identical scale and samples.")}</p><svg className="df-metric-insight-scatter" viewBox="0 0 300 220" role="img" aria-label={t("排程和计时时长散点图","Scheduled vs tracked time scatterplot")}><path d="M30 15V195H285" fill="none" stroke="currentColor" opacity=".45"/><path d="M30 195L285 15" fill="none" stroke="currentColor" strokeDasharray="4 4" opacity=".4"/>{scatter.map(x=><circle key={JSON.stringify([x.taskId,x.recordId])} cx={30+255*x[scatterReference]/comparisonScale} cy={195-180*x.tracked/comparisonScale} r="4" fill="var(--accent-active)"><title>{x[scatterReference]+" / "+x.tracked}</title></circle>)}</svg>
        <div className="df-metric-insight-table"><table><thead><tr><th>{t("任务","Task")}</th><th>{t("首次排程","First plan")}</th><th>{t("末次观察","Last observed")}</th><th>{t("原估时","Estimate")}</th><th>{t("计时","Tracked")}</th></tr></thead><tbody>{detailRows.map(x=><tr key={JSON.stringify([x.taskId,x.recordId])}><td>{taskTitles.get(x.taskId)||x.taskId}</td><td>{minutes(x.initial)}</td><td>{minutes(x.final)}</td><td>{x.estimate===null?"—":minutes(x.estimate)}</td><td>{minutes(x.tracked)}</td></tr>)}</tbody></table></div><p>{t("完整统计样本","Total comparison samples")}: {comparisons.length}{comparisons.length>500&&" · "+t("散点图抽样显示 500 个点","Scatter displays 500 sampled points")}</p><div className="df-metric-insight-actions">{action(t("上一页","Previous"),()=>setDetailPage(n=>Math.max(0,n-1)),detailPage===0)}<span>{detailPage+1} / {Math.max(1,Math.ceil(comparisons.length/50))}</span>{action(t("下一页","Next"),()=>setDetailPage(n=>n+1),(detailPage+1)*50>=comparisons.length)}</div></>:<p>{t("尚无同时具备首次排程、完成与关联计时的记录。","No comparable observed records yet.")}</p>}
      </>}</>}
      {(view==="engagement"||view==="projects")&&<React.Suspense fallback={<p role="status">{t("正在加载统计…","Loading breakdown…")}</p>}><MetricsBreakdown key={view} view={view} data={p.data} allocation={allocation} result={result} dayStartMinutes={dayStartMinutes} lang={p.lang} query={p.query} onApplyQuery={p.onApplyQuery}/></React.Suspense>}
      {view==="history"&&<><h3>{t("本机详细记录","Local detailed history")}</h3>
        {!p.scope?<p>{t("演示模式不记录活动。","Demo mode does not record activity.")}</p>:<>
          <p>{t("主动启用后记录本机任务、排程、计时及属性变化，包括部分撤销、插件、系统操作和秒表状态。远端变化只记录观察时间，不推断操作者。不上传云端，不追踪应用外活动。","Opt in to local task, schedule, time-entry and property changes, including supported undo, plugin, system and stopwatch transitions. Remote changes are observations, not attributed to an actor. No new cloud upload or external activity tracking.")}</p>
          {preference?.since&&<p>{t("开始记录","Recording started")}: {new Date(preference.since).toLocaleString()}{preference.hasGaps&&" · "+t("曾暂停，历史存在覆盖缺口","Recording has been paused; coverage has gaps")}</p>}
          <div className="df-metric-insight-actions">{action(preference?.enabled?t("暂停记录","Pause recording"):t("启用记录","Enable recording"),()=>{try{setAnalyticsEnabled(p.scope!,!preference?.enabled);if(!preference?.enabled){void recoverAnalytics(p.scope!);captureDailyPlan(p.scope!,p.data,new Date().toISOString(),p.dayStartTime,analyticsPreference(p.scope!).generation);}setError(false);}catch{setError(true);}},Boolean(preference?.purgePending))}{action(t("导出显示的历史","Export visible history"),()=>downloadJson({schemaVersion:1,exportedAt:new Date().toISOString(),timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,range:{start:new Date(historyStart).toISOString(),end:new Date(historyEnd).toISOString()},filters:{projectIds:p.projectIds,source:historySource||null,entity:historyEntity||null},page:trail.length,limited:trail.length>1||events.length>historyLimit,events:historyRows}),!historyRows.length)}{action(confirmClear?t("确认清除并暂停","Confirm clear & pause"):t("清除本机历史","Clear local history"),()=>{if(!confirmClear){setConfirmClear(true);return;}setConfirmClear(false);void clearAnalytics(p.scope!).catch(()=>setError(true));})}{confirmClear&&action(t("取消","Cancel"),()=>setConfirmClear(false))}</div>
          {(error||preference?.purgePending||analyticsError(p.scope)||historyState==="error")&&<p role="alert">{preference?.purgePending?t("历史清除尚未完成，完成前暂停记录。","History clearing is incomplete; recording stays paused until it finishes."):t("历史记录写入或读取未完成；任务操作不受影响。","History storage or recovery is incomplete; task operations are unaffected.")} {action(t("重试恢复","Retry recovery"),()=>{setError(false);void recoverAnalytics(p.scope!);setRevision(n=>n+1);})}</p>}
          <div className="df-metric-insight-actions df-metric-history-filters"><label>{t("来源","Source")} <select value={historySource} onChange={e=>setHistorySource(e.target.value)}>{[["",t("全部","All")],["client",t("本机","Local")],["ai",t("AI 已确认操作","AI confirmed action")],["plugin",t("插件","Plugin")],["sync",t("同步","Sync")],["system",t("系统","System")],["undo",t("撤销","Undo")],["remote-observed",t("远端观察","Remote observation")]].map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></label><label>{t("记录类型","Entity")} <select value={historyEntity} onChange={e=>setHistoryEntity(e.target.value)}>{[["",t("全部","All")],["task",t("任务","Task")],["subtask",t("子任务","Subtask")],["execution",t("排程","Execution")],["timeEntry",t("计时","Time entry")],["timer",t("计时状态","Timer")],["habit",t("习惯","Habit")],["project",t("项目","Project")]].map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></label></div>
          {historyState==="loading"?<p aria-live="polite">{t("读取中…","Loading…")}</p>:historyState==="ready"&&<><p>{t("显示所选范围及筛选条件的本机历史，每页 50 条。","Local history for the selected range and filters, 50 per page.")}</p>{!historyRows.length?<p>{t("暂无已记录的变化","No recorded changes")}</p>:<div className="df-metric-insight-history">{historyRows.map(e=><details key={e.id}><summary>{new Date(e.occurredAt).toLocaleString()} · {e.entityType} · {e.action} · {e.source}</summary><p>{taskTitles.get(e.taskId||"")||e.entityId}</p><pre>{JSON.stringify({before:e.before,after:e.after},null,2)}</pre></details>)}</div>}<div className="df-metric-insight-actions">{action(t("上一页","Previous"),()=>setHistoryPage({key:pageKey,trail:trail.slice(0,-1)}),trail.length<=1)}<span>{t("第","Page ")}{trail.length}{t("页","")}</span>{action(t("下一页","Next"),()=>{const last=historyRows[historyRows.length-1];if(last)setHistoryPage({key:pageKey,trail:[...trail,{occurredAt:last.occurredAt,id:last.id}]});},events.length<=historyLimit)}</div></>}
        </>}
      </>}
    </section>}
  </>;
}
