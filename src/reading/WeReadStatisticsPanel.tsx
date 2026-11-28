import {useEffect,useRef,useState} from "react";
import {Button} from "../components/UiPrimitives";
import {extensionService} from "../extensions/service";
import {weReadDesktopAvailable,WEREAD_CONNECTION_EVENT,type WeReadPeriod,type WeReadStatistics} from "./wereadConnection";
/** Source-native calendar buckets; never enter core TimeEntry or local task filters. */
export default function WeReadStatisticsPanel({account,zh,disabled=false}:{account:string;zh:boolean;disabled?:boolean}){
  const [period,setPeriod]=useState<WeReadPeriod>("weekly"),[stats,setStats]=useState<WeReadStatistics|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(false);
  const generation=useRef(0),lock=useRef(false);
  const tr=(a:string,b:string)=>zh?a:b;
  useEffect(()=>{generation.current++;setStats(null);setBusy(false);setError(false);lock.current=false;
    const reset=()=>{generation.current++;lock.current=false;setStats(null);setBusy(false);setError(false);};
    window.addEventListener(WEREAD_CONNECTION_EVENT,reset);
    return()=>{generation.current++;window.removeEventListener(WEREAD_CONNECTION_EVENT,reset);};
  },[account]);
  async function refresh(){if(lock.current)return;const epoch=generation.current;lock.current=true;setBusy(true);setError(false);
    try{const r=await extensionService.readingWeRead("statistics",period,account);if(epoch!==generation.current)return;if(r.ok&&r.statistics?.period===period)setStats(r.statistics);else{setStats(null);setError(true);}}
    catch{if(epoch===generation.current){setStats(null);setError(true);}}
    finally{if(epoch===generation.current){lock.current=false;setBusy(false);}}
  }
  if(!weReadDesktopAvailable())return null;
  const minutes=(seconds:number)=>Math.round(seconds/60)+tr(" 分钟"," min");
  const day=(value:number)=>{const date=new Date(value*1000);return date.toLocaleDateString(zh?"zh-CN":"en",{timeZone:"Asia/Shanghai",...(period==="overall"?{year:"numeric"}:period==="annually"?{year:"numeric",month:"short"}:{month:"short",day:"numeric"})});};
  const max=Math.max(1,...(stats?.days??[]).map(d=>d.seconds));
  return <div className="reading-week">
    <div className="reading-heading"><span className="reading-muted">{tr("微信读书统计","WeRead statistics")}</span><select className="ui-input" aria-label={tr("微信读书统计周期","WeRead period")} value={period} disabled={busy||disabled} onChange={e=>{setPeriod(e.target.value as WeReadPeriod);setStats(null);setError(false);}}>
      {([["weekly","本周","This week"],["lastWeek","上周","Last week"],["monthly","本月","This month"],["annually","今年","This year"],["overall","全部","All time"]] as const).map(([key,a,b])=><option key={key} value={key}>{tr(a,b)}</option>)}</select>
      <Button variant="ghost" disabled={disabled||busy} onClick={()=>void refresh()}>{busy?tr("读取中…","Loading…"):tr("查看统计","View statistics")}</Button></div>
    {error&&<p role="alert" className="reading-muted">{tr("统计暂不可用，请检查连接。","Statistics unavailable. Check the connection.")}</p>}
    {stats&&<><p><strong>{minutes(stats.totalSeconds)}</strong>{stats.readDays!==undefined?" · "+stats.readDays+tr(" 天阅读"," reading days"):""}</p>{stats.days.map(d=><div className="reading-stat-row" key={d.day}><span className="reading-muted">{day(d.day)}</span><progress max={max} value={d.seconds} aria-label={day(d.day)}/><span className="reading-muted">{minutes(d.seconds)}</span></div>)}<p className="reading-muted">{tr("微信读书自然周期（中国时区），含阅读/收听；不应用 NavoPath 项目筛选，也不与本地计时相加。","WeRead calendar periods (China timezone), reading/listening. Independent of NavoPath project filters and tracked time.")}</p></>}
  </div>;
}
