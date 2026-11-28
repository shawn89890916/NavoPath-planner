import React,{ useEffect, useMemo, useState } from "react";
import type { PlannerData, Language } from "../types";
import type { ReadingLibrary } from "../reading/model";
const ReadingMetrics = React.lazy(() => import("../reading/ReadingMetrics"));
import { buildTimeAllocationMetrics, parseDayStartMinutes, type MetricHabitMode, type MetricCompletionFilter } from "./timeAllocation";
const MetricsAllocation=React.lazy(()=>import("./MetricsAllocation"));
import { buildInsights } from "./insightFacts";
import { projectActivityFacts } from "./pluginActivityFacts";
import { PluginMetrics } from "./PluginMetrics";
import { analyticsError, analyticsPreference, clearAnalytics, readAnalyticsEvents, scanAnalyticsEvents, type AnalyticsPageCursor, recoverAnalytics, captureDailyPlan, readDailyPlans, setAnalyticsEnabled, subscribeAnalytics } from "./activityStore";
import type { AnalyticsEvent } from "./activityEvents";
import { createObservedPlanAccumulator, type ObservedPlanHistory } from "./historyAnalysis";
const MetricsReview=React.lazy(()=>import("./MetricsReview"));
const MetricsTimeSeries=React.lazy(()=>import("./MetricsTimeSeries"));
const MetricsBreakdown=React.lazy(()=>import("./MetricsBreakdown"));
import type { PlanBaseline } from "./planBaseline";
const MetricsExecution=React.lazy(()=>import("./MetricsExecution"));
import { readSavedViews, writeSavedViews, type SavedMetricsView, type MetricsQuery, type InsightView, type TimeChart } from "./savedViews";
import "./MetricsInsights.css";

type View = InsightView;
type Props = { scope?:string; readingLibrary?: ReadingLibrary; data:PlannerData; referenceDate?:string; dayStartTime?:string; weekStartsOn?:0|1; engagementEnabled?:boolean; projectIds:string[]; habitMode:MetricHabitMode; completion:MetricCompletionFilter; lang:Language; query:MetricsQuery; onApplyQuery:(query:MetricsQuery)=>void };
function downloadJson(events:unknown) {
  const url=URL.createObjectURL(new Blob([JSON.stringify(events,null,2)],{type:"application/json"}));
  const a=document.createElement("a");a.href=url;a.download="navopath-activity.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function MetricsInsights(props:Props) {
  return <ScopedMetricsInsights key={props.scope??null} {...props}/>;
}
function ScopedMetricsInsights(props:Props) {
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
  const [error,setError]=useState(false);
  const t=(zh:string,en:string)=>p.lang==="zh"?zh:en;
  const preference=p.scope?analyticsPreference(p.scope):null;
  const result=useMemo(()=>buildInsights(p.data,p.allocation,p),[p.data,p.allocation,p.dayStartMinutes,p.projectIds,p.habitMode,p.completion]);
  const pluginFacts=useMemo(()=>view==="overview"?projectActivityFacts(allocation,result.trackedEntries,data,engagementEnabled):null,[view,allocation,result,data,engagementEnabled]);
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
        if(!controller.signal.aborted){setObserved(accumulator.finish());setPlans(baselines);}
      }
      if(!controller.signal.aborted)setLoaded({key:requestKey,state:"ready"});
    }
    void load().catch(()=>{if(!controller.signal.aborted){setEvents([]);setPlans([]);setObserved(null);setLoaded({key:requestKey,state:"error"});}});
    return()=>controller.abort();
  },[requestKey,p.data,p.allocation.range]);
  const tabs: [View,string][]=[["overview",t("概览","Overview")],["allocation",t("分布","Allocation")],["time",t("时间","Time")],["execution",t("执行","Execution")],["engagement",t("投入度","Engagement")],["projects",t("项目","Projects")],["history",t("历史","History")]];
  const historyRows=historyState==="ready"&&view==="history"?events.slice(0,historyLimit):[];
  const taskTitles=useMemo(()=>new Map(p.data.tasks.map(x=>[x.id,x.title])),[p.data.tasks]);
  function persistViews(next:SavedMetricsView[]){if(!p.scope)return;try{writeSavedViews(p.scope,next);setSavedViews(next);setSaveViewError(false);}catch{setSaveViewError(true);}}
  function applySaved(saved:SavedMetricsView){setSelectedSaved(saved.id);setView(saved.view);setTimeChart(saved.chart);setGrain(saved.grain||"day");setViewName(saved.name);p.onApplyQuery(saved.query);}
  function saveCurrent(){if(!p.scope||!viewName.trim()||savedViews.length>=50)return;const saved={id:crypto.randomUUID(),name:viewName.trim().slice(0,80),view,chart:timeChart,grain,query:p.query};persistViews([...savedViews,saved]);setSelectedSaved(saved.id);}
  function changeOrder(delta:number){const at=savedViews.findIndex(x=>x.id===selectedSaved),to=at+delta;if(at<0||to<0||to>=savedViews.length)return;const next=[...savedViews];[next[at],next[to]]=[next[to],next[at]];persistViews(next);}
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
      {view==="overview"&&<React.Suspense fallback={<p role="status">{t("正在加载概览…","Loading overview…")}</p>}><MetricsReview data={p.data} allocation={allocation} result={result} query={p.query} dayStartMinutes={dayStartMinutes} weekStartsOn={weekStartsOn} lang={p.lang} onApplyQuery={p.onApplyQuery}/>{pluginFacts && <PluginMetrics facts={pluginFacts} lang={p.lang}/>}{p.readingLibrary && <React.Suspense fallback={null}><ReadingMetrics account={p.scope} library={p.readingLibrary} allocation={allocation} trackedEntries={result.trackedEntries} lang={p.lang} /></React.Suspense>}</React.Suspense>}
      {view==="time"&&<React.Suspense fallback={<p role="status">{t("正在加载时间统计…","Loading time statistics…")}</p>}><MetricsTimeSeries data={p.data} allocation={allocation} result={result} dayStartMinutes={dayStartMinutes} weekStartsOn={weekStartsOn} lang={p.lang} chart={timeChart} grain={grain} setChart={setTimeChart} setGrain={setGrain}/></React.Suspense>}
      {view==="execution"&&<React.Suspense fallback={<p role="status">{t("正在加载执行统计…","Loading execution statistics…")}</p>}><MetricsExecution key={requestKey} scope={p.scope} data={p.data} allocation={allocation} result={result} dayStartMinutes={dayStartMinutes} lang={p.lang} query={p.query} historyState={historyState} plans={plans} observed={observed} onRetry={()=>setRevision(n=>n+1)}/></React.Suspense>}
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
