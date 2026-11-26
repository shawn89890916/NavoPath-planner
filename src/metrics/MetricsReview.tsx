import { useMemo } from "react";
import type { PlannerData,Language } from "../types";
import { buildTimeAllocationMetrics,type TimeAllocationMetrics } from "./timeAllocation";
import { buildInsights,type InsightOptions } from "./insightFacts";
import { matchedPeriods,currentProjectProgress } from "./reviewMetrics";
import type { MetricsQuery } from "./savedViews";
type Props={data:PlannerData;allocation:TimeAllocationMetrics;result:ReturnType<typeof buildInsights>;query:MetricsQuery;dayStartMinutes:number;weekStartsOn?:0|1;lang:Language;onApplyQuery:(q:MetricsQuery)=>void};
const duration=(m:number|null)=>m===null?"—":Math.round(m)+" min";
const ratio=(n:number|null)=>n===null?"—":n.toFixed(1)+"%";
export default function MetricsReview(p:Props){
  const t=(zh:string,en:string)=>p.lang==="zh"?zh:en;
  const comparison=useMemo(()=>{
    const windows=matchedPeriods(p.allocation.range,new Date());if(!windows)return null;
    const options:InsightOptions={dayStartMinutes:p.dayStartMinutes,projectIds:p.query.projects,habitMode:p.query.habit,completion:p.query.completion};
    const run=(range:typeof windows.current)=>buildInsights(p.data,buildTimeAllocationMetrics({data:p.data,range:{preset:"custom"},rangeOverride:range,dayStartMinutes:p.dayStartMinutes,weekStartsOn:p.weekStartsOn,groupBy:p.query.group,habitMode:p.query.habit,completion:p.query.completion,projectIds:p.query.projects}),options);
    return {windows,current:run(windows.current),previous:run(windows.previous)};
  },[p.data,p.allocation.range,p.query,p.dayStartMinutes,p.weekStartsOn]);
  const progress=useMemo(()=>currentProjectProgress(p.data,p.query.projects,p.query.habit),[p.data,p.query.projects,p.query.habit]);
  const r=p.result;
  const share=(x:typeof r)=>x.executionCount?x.statuses.completed/x.executionCount*100:null;
  type Row={label:string;read:(x:typeof r)=>number|null;format:(v:number|null)=>string;unit:"min"|"pp"|"count"};
  const rows:Row[]=[
    {label:t("排程时长","Scheduled"),read:x=>x.scheduled,format:duration,unit:"min"},
    {label:t("完成排程时长","Completed scheduled"),read:x=>x.completed,format:duration,unit:"min"},
    {label:t("实际计时","Tracked"),read:x=>x.trackedSessions?x.tracked:null,format:duration,unit:"min"},
    {label:t("时间轴占用","Occupied"),read:x=>x.occupied,format:duration,unit:"min"},
    {label:t("完成执行数","Completed executions"),read:x=>x.statuses.completed,format:v=>v===null?"—":String(v),unit:"count"},
    {label:t("完成执行比例","Execution completion share"),read:share,format:ratio,unit:"pp"},
    {label:t("明确评分均值","Explicit rating mean"),read:x=>x.explicitEngagement,format:ratio,unit:"pp"},
    {label:t("明确评分覆盖","Rated time coverage"),read:x=>x.ratingCoverage,format:ratio,unit:"pp"},
  ];
  const stamp=(d:Date)=>d.toLocaleString(p.lang==="zh"?"zh-CN":"en",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});
  return <>
    <h3>{t("所选范围概览","Selected range")}</h3>
    <div className="df-metric-insight-stats">{rows.slice(0,6).map(row=><div key={row.label}><span>{row.label}</span><strong>{row.format(row.read(r))}</strong></div>)}</div>
    <p>{t("汇总包含所选范围的当前排程；实际计时无记录时显示 —。","Totals include current schedules in the selected range; missing tracked time is shown as —.")}</p>
    <h3>{t("等长周期对比","Matched-period comparison")}</h3>
    {!comparison?<p>{t("请选取有限且已开始的日期范围进行对比。","Choose a finite date range that has started.")}</p>:<>
      <p>{stamp(comparison.windows.current.start)} – {stamp(comparison.windows.current.end)} / {stamp(comparison.windows.previous.start)} – {stamp(comparison.windows.previous.end)}</p>
      <p>{comparison.windows.partial?t("当前周期尚未结束，双方只对比相同的已过去时长。","Current period is partial; both windows cover equal elapsed time."):t("对比前一段同等时长；跨夏令时按实际经过时间匹配。","Compared with the preceding equal-duration window; DST is matched by elapsed time.")}</p>
      <div className="df-metric-insight-table"><table><thead><tr><th>{t("指标","Metric")}</th><th>{t("本期","Current")}</th><th>{t("前期","Previous")}</th><th>{t("变化","Change")}</th></tr></thead><tbody>{rows.map(row=>{const a=row.read(comparison.current),b=row.read(comparison.previous),delta=a===null||b===null?null:a-b;return <tr key={row.label}><td>{row.label}</td><td>{row.format(a)}</td><td>{row.format(b)}</td><td>{delta===null?"—":(delta>0?"+":"")+(row.unit==="pp"?delta.toFixed(1)+" pp":Math.round(delta)+(row.unit==="min"?" min":""))}</td></tr>})}</tbody></table></div>
      <p>{t("排程以当前数据为准，不代表当时保存的原始计划。","Schedule comparisons use current data, not historical plan snapshots.")}</p>
    </>}
    <h3>{t("当前项目完成进度","Current project progress")}</h3>
    <p>{t("不受统计日期与完成状态筛选影响；估时进度仅使用有正数估时的任务。","Independent of date and completion filters; estimate-weighted progress uses only tasks with positive estimates.")}</p>
    {progress.length?<div className="df-metric-insight-table"><table><thead><tr><th>{t("项目","Project")}</th><th>{t("任务完成","Tasks done")}</th><th>{t("估时进度","Estimate-weighted")}</th><th>{t("估时覆盖","Estimate coverage")}</th></tr></thead><tbody>{progress.map(g=><tr key={g.id}><td><button type="button" className="df-metrics-text-action" onClick={()=>p.onApplyQuery({...p.query,projects:p.query.projects.length===1&&p.query.projects[0]===g.id?[]:[g.id]})}>{g.id==="__unassigned__"?t("未归属","Unassigned"):g.title}</button></td><td>{g.completed}/{g.total} · {ratio(g.completed/g.total*100)}</td><td>{ratio(g.estimated?g.estimatedCompleted/g.estimated*100:null)}</td><td>{g.estimateCount}/{g.total}</td></tr>)}</tbody></table></div>:<p>{t("暂无任务","No tasks")}</p>}
  </>;
}
