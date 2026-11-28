import { useEffect, useRef, useState } from "react";
import type { Language } from "../types";
import { SettingSection, SettingRow, SettingActionButton, SettingTextInput } from "../components/SettingsControls";
import { readingWeRead } from "./wereadConnectionService";
import { weReadDesktopAvailable, type WeReadAction, type WeReadResult } from "./wereadConnection";

export default function ReadingSettings({lang,active,connection=readingWeRead,desktopAvailable=weReadDesktopAvailable}:{lang:Language;active:boolean;connection?:typeof readingWeRead;desktopAvailable?:typeof weReadDesktopAvailable}){
  const tr=(zh:string,en:string)=>lang==="zh"?zh:en;
  const supported=desktopAvailable();
  const [key,setKey]=useState(""),[connected,setConnected]=useState(false),[verified,setVerified]=useState<Extract<WeReadResult,{ok:true}>|null>(null);
  const [busy,setBusy]=useState<WeReadAction|null>(null),[error,setError]=useState("");
  const epoch=useRef(0),lock=useRef(false);
  const run=async(action:WeReadAction,candidate?:string)=>{
    if(!supported||!active||lock.current)return;
    const current=epoch.current;lock.current=true;setBusy(action);setError("");
    try{
      const result=await connection(action,candidate);
      if(current!==epoch.current)return;
      if(!result.ok){setError(result.code);if(action==="test")setVerified(null);return;}
      setConnected(result.connected);
      if(action==="connect"||action==="test")setVerified(result);
      if(action==="disconnect"){setVerified(null);setKey("");}
      if(action==="connect"||action==="disconnect")window.dispatchEvent(new Event("navopath:weread-connection-changed"));
    }catch{if(current===epoch.current)setError("unavailable");}
    finally{if(current===epoch.current){lock.current=false;setBusy(null);}}
  };
  useEffect(()=>{
    epoch.current++;lock.current=false;setConnected(false);setVerified(null);setKey("");setError("");setBusy(null);
    if(active&&supported)void run("status");
    return ()=>{epoch.current++;lock.current=false;};
  },[active,supported,connection]);
  const errors:Record<string,string>={
    format:tr("请输入有效的 wrk- API Key。","Enter a valid wrk- API key."),
    auth:tr("微信读书拒绝了授权，请检查或重新生成密钥。","WeRead rejected authorization. Check or regenerate your key."),
    network:tr("无法连接微信读书，请检查网络后重试。","Unable to reach WeRead. Check your connection and retry."),
    "rate-limit":tr("请求过于频繁，请稍后再试。","Rate limited; try again later."),
    upgrade:tr("微信读书接口明确拒绝了当前版本请求，请检查官方接口要求。","WeRead explicitly rejected this API version. Check the official API requirements."),
    storage:tr("设备安全存储不可用，密钥未保存。","Secure device storage is unavailable; the key was not saved."),
    api:tr("微信读书返回错误，请检查授权或稍后重试。","WeRead returned an error. Check authorization or retry later."),
    response:tr("微信读书返回格式异常，未修改任何数据。","Unexpected WeRead response; no data changed."),
    busy:tr("连接操作正在进行，请稍后重试。","Another connection operation is in progress."),
    "not-connected":tr("请先连接微信读书。","Connect WeRead first."),
  };
  const counts=verified?.counts;
  return <SettingSection anchor="reading-weread" title={tr("微信读书","WeRead")} description={tr("使用官方 API Key 连接书架。仅在当前设备加密保存，不随账户设置同步。","Connect your bookshelf using the official API key. Encrypted on this device only, not synced with account settings.")}>
    {!supported?<SettingRow title={tr("连接仅支持桌面端","Desktop connection only")} description={tr("请使用新版 NavoPath 桌面应用配置密钥。","Configure the key in an updated NavoPath desktop app.")}/>:!active?<SettingRow title={tr("请先启用阅读插件","Enable Reading first")}/>:<>
      <SettingRow title={tr("连接状态","Connection status")} description={verified?.checkedAt?tr("最近验证：","Last verified: ")+new Date(verified.checkedAt).toLocaleString():connected?tr("已保存凭证，尚未验证本次会话。","Credential saved; not yet verified in this session."):tr("未连接","Not connected")} control={connected?<SettingActionButton pending={busy==="test"} disabled={!!busy} onClick={()=>void run("test")}>{tr("测试连接","Test connection")}</SettingActionButton>:undefined}/>
      <SettingRow layout="stacked" title={connected?tr("更换 API Key","Replace API key"):tr("API Key","API key")} description={<a href="https://weread.qq.com/r/weread-skills" target="_blank" rel="noopener noreferrer">{tr("获取微信读书 API Key","Get a WeRead API key")}</a>} control={<><SettingTextInput type="password" value={key} onChange={setKey} ariaLabel={tr("微信读书 API Key","WeRead API key")} placeholder="wrk-…" disabled={!!busy}/><SettingActionButton tone="primary" pending={busy==="connect"} disabled={!!busy||!key.trim()} onClick={()=>{const candidate=key;setKey("");void run("connect",candidate);}}>{connected?tr("验证并更换","Verify and replace"):tr("验证并连接","Verify and connect")}</SettingActionButton></>}/>
      {verified?.upgradeNotice&&<p role="status" className="df-extension-note">{tr("微信读书提供了可选的接口更新提示；本次书架数据已成功读取，可以稍后更新。","WeRead has an optional API update notice; this bookshelf check succeeded. You can update later.")}</p>}
      {counts&&<SettingRow title={tr("微信读书书架","WeRead bookshelf")} description={tr("电子书 ","Books ")+counts.books+tr(" · 有声书 "," · Audiobooks ")+counts.audiobooks+tr(" · 文章收藏入口 "," · Article collections ")+counts.articles} control={<span>{counts.books+counts.audiobooks+counts.articles}</span>}/>}
      {error&&<p role="alert" className="df-extension-error">{errors[error]??tr("连接暂不可用，请重试。","Connection unavailable; retry.")}</p>}
      {connected&&<SettingRow title={tr("断开连接","Disconnect")} description={tr("删除本机密钥；保留阅读书库和任务。","Remove the local credential; keep your library and tasks.")} control={<SettingActionButton tone="danger" disabled={!!busy} onClick={()=>void run("disconnect")}>{tr("断开","Disconnect")}</SettingActionButton>}/>}
      <SettingRow title={tr("数据范围","Data scope")} description={tr("在阅读书架中导入书籍并管理自动导入。书架打开、应用重新聚焦或书架内阅读任务记录更新时同步。私密书籍需单独选择，不会自动生成排程。","Import books and manage automatic import in the Reading shelf. Linked books refresh when the shelf opens, the app regains focus, or reading-task records change while the shelf is open. Private books require explicit selection. No timeline entries are generated.")}/>
    </>}
  </SettingSection>;
}
