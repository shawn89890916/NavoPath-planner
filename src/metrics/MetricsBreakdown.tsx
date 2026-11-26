import { lazy,Suspense,useEffect,useMemo,useState } from "react";
const MetricsProjectDetails=lazy(()=>import("./MetricsProjectDetails"));
import type { Language,PlannerData } from "../types";
import type { TimeAllocationMetrics } from "./timeAllocation";
import type { buildInsights } from "./insightFacts";
import { buildEngagementBreakdown,ratingMean,ratingCoverage,projectActivityTrend,type RatingRow } from "./engagementBreakdown";
import type { MetricsQuery } from "./savedViews";

type Props={view:"engagement"|"projects";data:PlannerData;allocation:TimeAllocationMetrics;result:ReturnType<typeof buildInsights>;dayStartMinutes:number;lang:Language;query:MetricsQuery;onApplyQuery:(q:MetricsQuery)=>void};
const duration=(n:number)=>Math.round(n)+" min";
const pct=(n:number|null)=>n===null?"—":n.toFixed(1)+"%";
const empty:RatingRow={id:"",completedMinutes:0,ratedMinutes:0,weightedMinutes:0,completedExecutions:0,ratedExecutions:0};
type Sort="scheduled"|"completed"|"tracked"|"rating";
export default function MetricsBreakdown(p:Props){
  const t=(zh:string,en:string)=>p.lang==="zh"?zh:en;
  const r=p.result;
  const ratings=useMemo(()=>buildEngagementBreakdown(p.data,p.allocation,p.dayStartMinutes),[p.data,p.allocation,p.dayStartMinutes]);
  const projectLabels=useMemo(()=>new Map(p.data.projects.map(x=>[x.id,x.title])),[p.data.projects]);
  const label=(id:string)=>id==="__unassigned__"?t("未归属","Unassigned"):projectLabels.get(id)||id;
  const projectRatings=useMemo(()=>new Map(ratings.projects.map(x=>[x.id,x])),[ratings.projects]);
  const [sort,setSort]=useState<Sort>("scheduled"),[selected,setSelected]=useState<string|null>(null),[page,setPage]=useState(0);
  useEffect(()=>{setPage(0);setSelected(null);},[p.view,p.allocation.range,p.query.projects,p.query.habit,p.query.completion]);
  const projects=useMemo(()=>[...r.projects].sort((a,b)=>{
    const value=(x:typeof a)=>sort==="rating"?ratingMean(projectRatings.get(x.id)||empty)??-1:sort==="tracked"&&!x.trackedSessions?-1:x[sort];
    return value(b)-value(a)||a.id.localeCompare(b.id);
  }),[r.projects,sort,projectRatings]);
  const active=projects.find(x=>x.id===selected);
  const trend=useMemo(()=>active?projectActivityTrend(p.allocation,r.trackedEntries,active.id,p.dayStartMinutes):[],[p.allocation,r.trackedEntries,active?.id,p.dayStartMinutes]);
  const visibleTrend=trend.slice(-60);
  const ratingRows=(rows:RatingRow[],name:(x:RatingRow)=>string)=><div className="df-metric-insight-table"><table><thead><tr><th>{t("分组","Group")}</th><th>{t("评分均值","Mean")}</th><th>{t("评分覆盖","Coverage")}</th><th>{t("已评分时长","Rated minutes")}</th><th>{t("样本数","Rated / done")}</th></tr></thead><tbody>{rows.map(x=><tr key={x.id}><td>{name(x)}</td><td>{pct(ratingMean(x))}</td><td>{pct(ratingCoverage(x))}</td><td>{duration(x.ratedMinutes)}</td><td>{x.ratedExecutions}/{x.completedExecutions}</td></tr>)}</tbody></table></div>;
  const stat=(name:string,value:string)=><div><span>{name}</span><strong>{value}</strong></div>;
  const pager=(count:number)=><div className="df-metric-insight-actions"><button type="button" className="df-metrics-text-action" disabled={page===0} onClick={()=>setPage(n=>Math.max(0,n-1))}>{t("上一页","Previous")}</button><span>{page+1} / {Math.max(1,Math.ceil(count/25))}</span><button type="button" className="df-metrics-text-action" disabled={(page+1)*25>=count} onClick={()=>setPage(n=>n+1)}>{t("下一页","Next")}</button></div>;
  const hourNames=["00:00–06:00","06:00–12:00","12:00–18:00","18:00–24:00"];
  const bandNames=[t("少于 30 分钟","Under 30 min"),"30–59 min","60–119 min",t("120 分钟及以上","120+ min")];
  if(p.view==="engagement"){
    const recent=ratings.days.slice(-60);
    return <>
      <div className="df-metric-insight-stats">{stat(t("明确评分均值","Explicit weighted mean"),pct(ratingMean(ratings.overall)))}{stat(t("评分时长覆盖","Rated time coverage"),pct(ratingCoverage(ratings.overall)))}{stat(t("加权时长","Rated weighted time"),ratings.overall.ratedMinutes?duration(ratings.overall.weightedMinutes):"—")}{stat(t("已评分执行","Rated executions"),ratings.overall.ratedExecutions+"/"+ratings.overall.completedExecutions)}</div>
      <p>{t("按已完成排程的原始分钟加权；默认 80% 不算明确评分。评分只反映用户填写的投入度，不能推断实际专注时长。","Weighted by raw completed scheduled minutes. Default 80% is not an explicit rating. Ratings are self-reported, not measured focus time.")}</p>
      {ratingCoverage(ratings.overall)!==null&&<progress max={100} value={ratingCoverage(ratings.overall)!}/>}
      <h3>{t("明确评分分布","Explicit rating distribution")}</h3>
      {r.engagementBuckets.map(b=><div key={b.score} className="df-metric-insight-row"><span>{b.score}%</span><progress aria-label={duration(b.minutes)} max={Math.max(1,...r.engagementBuckets.map(x=>x.minutes))} value={b.minutes}/><strong>{b.count}</strong></div>)}
      <p>{t("条形表示已评分排程时长，右侧为独立执行数。","Bars show rated scheduled time; numbers are independent execution counts.")}</p>
      <h3>{t("日趋势","Daily rating trend")}</h3>
      {recent.length?<><div className="df-metric-insight-trend">{recent.map(x=><button type="button" key={x.id} onClick={()=>p.onApplyQuery({...p.query,range:"custom",customStart:x.id,customEnd:x.id})} title={x.id+" · "+pct(ratingMean(x))+" · "+t("覆盖","Coverage")+" "+pct(ratingCoverage(x))}><span>{x.id.slice(5)}</span><span className="df-metric-insight-bars"><i style={{height:(ratingMean(x)??0)+"%",background:"var(--accent-active)"}}/><i style={{height:(ratingCoverage(x)??0)+"%",background:"var(--text-muted)"}}/></span></button>)}</div><p>{t("强调色为评分均值，灰色为覆盖率。点击日期筛选。仅显示有完成排程的最近 60 天记录，无评分均值显示 —。","Accent: mean rating; gray: coverage. Select a day to filter. Latest 60 days with completed schedules; missing means are —.")}</p>{ratingRows(recent,x=>x.id)}</>:<p>{t("没有已完成排程。","No completed schedules.")}</p>}
      <h3>{t("按钟表时段","By local clock period")}</h3><p>{t("按实际排程区间拆分；全天估时不进入时段统计，跨时段执行可出现在多行。","Split by scheduled intervals; all-day estimates are excluded. Executions spanning periods may appear in multiple rows.")}</p>{ratingRows(ratings.hours,x=>hourNames[Number(x.id)])}
      <h3>{t("按执行时长","By execution duration")}</h3><p>{t("按单条完成执行在所选范围内的原始排程时长分类，跨日不会重复计数。","Grouped by each completed execution's raw scheduled overlap with the selected range, without double-counting across days.")}</p>{ratingRows(ratings.bands,x=>bandNames[ratings.bands.indexOf(x)])}
      <h3>{t("按项目","By project")}</h3>{ratingRows(ratings.projects.slice(page*25,page*25+25),x=>label(x.id))}{pager(ratings.projects.length)}
    </>;
  }
  const visible=projects.slice(page*25,page*25+25);
  const val=(x:typeof projects[number])=>sort==="rating"?ratingMean(projectRatings.get(x.id)||empty):sort==="tracked"?(x.trackedSessions?x.tracked:null):x[sort];
  const max=sort==="rating"?100:projects.reduce((m,x)=>Math.max(m,val(x)??0),1);
  const sortLabel=(x:Sort)=>x==="scheduled"?t("排程","Scheduled"):x==="completed"?t("完成排程","Completed schedule"):x==="tracked"?t("计时","Tracked"):t("投入度","Rating");
  return <>
    <h3>{t("项目对比","Project comparison")}</h3><p>{t("按当前项目归属；已删除任务的存留计时使用记录中的归属。无计时或评分显示 —。点击项目展开明细。","Current project attribution; surviving time entries of deleted tasks use recorded attribution. Missing time or rating is —. Select a project for details.")}</p>
    <div className="df-metric-insight-tabs">{(["scheduled","completed","tracked","rating"] as Sort[]).map(k=><button type="button" key={k} className="df-metrics-text-action" aria-pressed={sort===k} onClick={()=>{setSort(k);setPage(0);}}>{sortLabel(k)}</button>)}</div>
    {visible.map(x=><button type="button" className="df-metric-group-row" key={x.id} aria-pressed={selected===x.id} onClick={()=>setSelected(id=>id===x.id?null:x.id)}><span>{label(x.id)}</span><progress max={max} value={val(x)??0}/><strong>{val(x)===null?"—":sort==="rating"?pct(val(x)):duration(val(x)!)}</strong></button>)}
    {!visible.length&&<p>{t("所选范围没有项目活动。","No project activity in this range.")}</p>}{pager(projects.length)}
    <div className="df-metric-insight-table"><table><thead><tr><th>{t("项目","Project")}</th><th>{t("排程","Scheduled")}</th><th>{t("完成","Completed")}</th><th>{t("计时","Tracked")}</th><th>{t("完成执行","Done / all")}</th><th>{t("评分覆盖","Rating coverage")}</th></tr></thead><tbody>{visible.map(x=>{const a=projectRatings.get(x.id)||empty;return <tr key={x.id}><td><button type="button" className="df-metrics-text-action" aria-pressed={selected===x.id} onClick={()=>setSelected(id=>id===x.id?null:x.id)}>{label(x.id)}</button></td><td>{duration(x.scheduled)}</td><td>{duration(x.completed)}</td><td>{x.trackedSessions?duration(x.tracked):"—"}</td><td>{a.completedExecutions}/{x.executions}</td><td>{pct(ratingCoverage(a))}</td></tr>;})}</tbody></table></div>
    {active&&<><h3>{label(active.id)} · {t("活动趋势","Activity trend")}</h3><div className="df-metric-insight-actions"><button type="button" className="df-metrics-text-action" onClick={()=>p.onApplyQuery({...p.query,projects:p.query.projects.length===1&&p.query.projects[0]===active.id?[]:[active.id]})}>{p.query.projects.length===1&&p.query.projects[0]===active.id?t("清除项目筛选","Clear project filter"):t("筛选此项目","Filter to project")}</button><button type="button" className="df-metrics-text-action" onClick={()=>setSelected(null)}>{t("收起","Collapse")}</button></div>
      <p>{t("显示有活动的最近 60 个日期；按设置的日界线统计。计时缺失显示 —。","Latest 60 dates with activity, using the configured day boundary. Missing tracked time is —.")}</p>
      <div className="df-metric-insight-trend">{visibleTrend.map(d=>{const m=visibleTrend.reduce((n,v)=>Math.max(n,v.scheduled,v.completed,v.tracked),1);return <button type="button" key={d.date} onClick={()=>p.onApplyQuery({...p.query,projects:[active.id],range:"custom",customStart:d.date,customEnd:d.date})} title={d.date+" · "+duration(d.scheduled)+" / "+duration(d.completed)+" / "+(d.trackedSessions?duration(d.tracked):"—")}><span>{d.date.slice(5)}</span><span className="df-metric-insight-bars">{[d.scheduled,d.completed,d.tracked].map((v,i)=><i key={i} style={{height:v/m*100+"%"}}/>)}</span></button>;})}</div>
      <p>{t("依次为排程、完成排程、计时。点击日期下钻。","Scheduled / completed schedule / tracked. Select a date to drill down.")}</p><div className="df-metric-insight-table"><table><thead><tr><th>{t("日期","Date")}</th><th>{t("排程","Scheduled")}</th><th>{t("完成","Completed")}</th><th>{t("计时","Tracked")}</th></tr></thead><tbody>{visibleTrend.map(d=><tr key={d.date}><td>{d.date}</td><td>{duration(d.scheduled)}</td><td>{duration(d.completed)}</td><td>{d.trackedSessions?duration(d.tracked):"—"}</td></tr>)}</tbody></table></div>
      <Suspense fallback={<p role="status">{t("正在加载项目明细…","Loading project details…")}</p>}><MetricsProjectDetails key={active.id} data={p.data} allocation={p.allocation} result={r} projectId={active.id} dayStartMinutes={p.dayStartMinutes} lang={p.lang} query={p.query}/></Suspense>
    </>}
  </>;
}
