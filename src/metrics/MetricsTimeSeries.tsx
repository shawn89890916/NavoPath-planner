import { useEffect,useMemo,useState } from "react";
import type { Language,PlannerData } from "../types";
import type { TimeAllocationMetrics } from "./timeAllocation";
import type { buildInsights } from "./insightFacts";
import type { TimeChart,TimeGrain } from "./savedViews";
import { timeBuckets,overlapMinutes,type TimeBucket } from "./timeSeries";
type Props={data:PlannerData;allocation:TimeAllocationMetrics;result:ReturnType<typeof buildInsights>;dayStartMinutes:number;weekStartsOn?:0|1;lang:Language;chart:TimeChart;grain:TimeGrain;setChart:(v:TimeChart)=>void;setGrain:(v:TimeGrain)=>void};
const minutes=(m:number)=>Math.round(m)+" min";
export default function MetricsTimeSeries(p:Props){
  const t=(zh:string,en:string)=>p.lang==="zh"?zh:en,r=p.result;
  const [selected,setSelected]=useState<string|null>(null);
  const grain=p.chart==="trend"?p.grain:"day",weekStart=p.weekStartsOn??1;
  const buckets=useMemo(()=>timeBuckets(r.days,p.allocation.range,grain,p.dayStartMinutes,weekStart),[r.days,p.allocation.range,grain,p.dayStartMinutes,weekStart]);
  const {rows}=buckets,active=rows.find(x=>x.date===selected);
  useEffect(()=>setSelected(null),[p.allocation.range,grain,p.chart]);
  const max=Math.max(1,...rows.flatMap(d=>[d.scheduled,d.completed,d.tracked])),heatMax=Math.max(1,...rows.map(d=>d.completed));
  const toggle=(d:TimeBucket)=>setSelected(v=>v===d.date?null:d.date);
  const label=(d:TimeBucket)=>d.date+" · "+minutes(d.scheduled)+" / "+minutes(d.completed)+" / "+(d.trackedSessions?minutes(d.tracked):"—");
  const taskNames=useMemo(()=>new Map(p.data.tasks.map(x=>[x.id,x.title])),[p.data.tasks]);
  const details=useMemo(()=>{if(!active)return {scheduled:[],tracked:[]};return {
    scheduled:p.allocation.taskEntries.flatMap(e=>{const m=overlapMinutes(e.scheduledStart,e.scheduledEnd,active.start,active.end);return m>0?[{...e,minutes:m}]:[];}),
    tracked:r.trackedEntries.flatMap(e=>{const m=overlapMinutes(e.start,e.end,active.start,active.end);const span=(e.end.getTime()-e.start.getTime())/60000;return m>0&&span>0?[{...e,minutes:e.minutes*m/span}]:[];})
  };},[active,p.allocation.taskEntries,r.trackedEntries]);
  function exportCsv(){
    const zone=Intl.DateTimeFormat().resolvedOptions().timeZone;
    const quote=(x:string)=>'"'+x.replaceAll('"','""')+'"';
    const text=["Period,Start UTC,End UTC,Timezone,Day start minutes,Grain,Scheduled minutes,Completed scheduled minutes,Tracked minutes,Has records",...rows.map(d=>[d.date,d.start.toISOString(),d.end.toISOString(),quote(zone),p.dayStartMinutes,grain,d.scheduled.toFixed(2),d.completed.toFixed(2),d.trackedSessions?d.tracked.toFixed(2):"",d.hasRecords].join(","))].join("\r\n");
    const url=URL.createObjectURL(new Blob([text],{type:"text/csv;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download="navopath-metrics.csv";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  const weekdays=p.lang==="zh"?["日","一","二","三","四","五","六"]:["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const pad=rows.length?(new Date(rows[0].date+"T12:00:00").getDay()-weekStart+7)%7:0;
  return <>
    <div className="df-metric-insight-stats">{[[t("排程时长","Scheduled"),minutes(r.scheduled)],[t("已完成排程","Completed scheduled"),minutes(r.completed)],[t("实际计时","Tracked"),r.trackedSessions?minutes(r.tracked):"—"],[t("时间轴占用","Occupied timeline"),minutes(r.occupied)],[t("计时关联覆盖","Linked measurement coverage"),r.measurementCoverage===null?"—":Math.round(r.measurementCoverage)+"%"]].map(([k,v])=><div key={k}><span>{k}</span><strong>{v}</strong></div>)}</div>
    <p>{t("排程时长不代表实测时长；跨日计时按记录区间比例分配。","Scheduled time is not measured time; cross-day tracked duration is apportioned by interval.")}</p>
    {r.trackedSessions>0&&<p>{t("计时来源：秒表 / 手动 / 空闲调整","Tracked sources: timer / manual / idle-adjusted")}: {Object.values(r.trackedBySource).map(minutes).join(" / ")}</p>}
    <h3>{t("时间趋势","Time trend")}</h3>
    <div className="df-metric-insight-tabs">{(["trend","heatmap","table"] as const).map(v=><button key={v} type="button" className="df-metrics-text-action" aria-pressed={p.chart===v} onClick={()=>p.setChart(v)}>{v==="trend"?t("趋势","Trend"):v==="heatmap"?t("日历热力图","Calendar heatmap"):t("数据表","Table")}</button>)}<button type="button" className="df-metrics-text-action" onClick={exportCsv} disabled={!rows.length}>{t("导出当前图表 CSV","Export chart CSV")}</button></div>
    {p.chart==="trend"&&<div className="df-metric-insight-tabs">{(["day","week","month"] as const).map(g=><button key={g} type="button" className="df-metrics-text-action" aria-pressed={p.grain===g} onClick={()=>p.setGrain(g)}>{g==="day"?t("日","Day"):g==="week"?t("周","Week"):t("月","Month")}</button>)}</div>}
    <p>{t("排程 / 完成 / 计时；空白计时表示没有测量记录。","Scheduled / Completed / Tracked; blank tracked time means no measurement.")}</p>
    {buckets.truncated&&<p>{t("仅显示最近 366 个连续时间区间，汇总仍涵盖完整筛选范围。","Showing the latest 366 consecutive buckets; totals still cover the full range.")}</p>}
    {p.chart==="trend"?<div className="df-metric-insight-trend">{rows.map(d=><button type="button" key={d.date} aria-pressed={selected===d.date} onClick={()=>toggle(d)} title={label(d)} aria-label={label(d)}><span>{grain==="month"?d.date:d.date.slice(5)}</span><span className="df-metric-insight-bars">{[d.scheduled,d.completed,d.trackedSessions?d.tracked:null].map((v,i)=><i key={i} data-missing={v===null||undefined} style={{height:v===null?"0":(v/max*100)+"%"}}/>)}</span></button>)}</div>:p.chart==="heatmap"?<div className="df-metric-insight-heatmap df-metric-calendar-grid" aria-label={t("日历热力图","Calendar heatmap")}>{Array.from({length:7},(_,i)=><span key={"day"+i}>{weekdays[(i+weekStart)%7]}</span>)}{Array.from({length:pad},(_,i)=><span aria-hidden="true" key={"pad"+i}/>)}{rows.map(d=><button type="button" key={d.date} aria-pressed={selected===d.date} onClick={()=>toggle(d)} style={{backgroundColor:d.hasRecords?"color-mix(in srgb, var(--accent-active) "+Math.round(d.completed/heatMax*85)+"%, var(--paper-rule))":"transparent"}} title={label(d)} aria-label={label(d)}>{d.date.slice(5)}</button>)}</div>:<div className="df-metric-insight-table"><table><thead><tr><th>{t("日期","Date")}</th><th>{t("排程","Scheduled")}</th><th>{t("完成","Completed")}</th><th>{t("计时","Tracked")}</th></tr></thead><tbody>{rows.map(d=><tr key={d.date}><td><button type="button" className="df-metrics-text-action" aria-pressed={selected===d.date} onClick={()=>toggle(d)}>{d.date}</button></td><td>{minutes(d.scheduled)}</td><td>{minutes(d.completed)}</td><td>{d.trackedSessions?minutes(d.tracked):"—"}</td></tr>)}</tbody></table></div>}
    {active&&<><h3>{active.date} · {t("明细","Details")}</h3><p>{label(active)}</p><div className="df-metric-insight-table"><table><thead><tr><th>{t("任务","Task")}</th><th>{t("记录类型","Record")}</th><th>{t("时长","Duration")}</th></tr></thead><tbody>{details.scheduled.slice(0,200).map((e,i)=><tr key={e.recordId+":"+i}><td>{e.title}</td><td>{e.completed?t("完成排程","Completed schedule"):t("排程","Schedule")}</td><td>{minutes(e.minutes)}</td></tr>)}{details.tracked.slice(0,200).map(e=><tr key={"tracked:"+e.id}><td>{taskNames.get(e.taskId)||t("已删除任务","Deleted task")}</td><td>{t("计时","Tracked")} · {e.source}</td><td>{minutes(e.minutes)}</td></tr>)}</tbody></table></div>{details.scheduled.length+details.tracked.length===0&&<p>{t("该区间没有记录。","No records in this interval.")}</p>}{(details.scheduled.length>200||details.tracked.length>200)&&<p>{t("各类型最多显示前 200 条记录。","Showing up to 200 records of each type.")}</p>}</>}
    <h3>{t("星期 × 时段：已完成排程","Weekday × hour: completed schedules")}</h3><p>{t("按本地钟表时间分布；颜色表示已完成排程分钟，不代表实测专注时间。","Local clock hours; intensity is completed scheduled minutes, not measured focus.")}</p><div className="df-metric-hour-grid" role="table" aria-label={t("星期与小时热力图","Weekday-hour heatmap")}>{r.completedHours.map((hours,i)=><div key={i} role="row"><span role="rowheader">{weekdays[(i+1)%7]}</span>{hours.map((m,h)=><span role="cell" key={h} title={h+":00 · "+minutes(m)} aria-label={h+":00 "+minutes(m)} style={{backgroundColor:"color-mix(in srgb, var(--accent-active) "+Math.round(m/Math.max(1,...r.completedHours.flat())*85)+"%, var(--paper-rule))"}}/>)}</div>)}</div>
  </>;
}
