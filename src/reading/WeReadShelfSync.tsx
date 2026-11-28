import {useEffect,useRef,useState} from "react";
import {Button,Input} from "../components/UiPrimitives";
import {extensionService} from "../extensions/service";
import type {ReadingLibrary,ReadingBook} from "./model";
import {weReadDesktopAvailable,WEREAD_CONNECTION_EVENT,type WeReadItem,type WeReadProgress} from "./wereadConnection";
import {applyWeReadProgress,importWeRead,recentLinkedItems,sourceKey,sourceMatches,suggestedBook,matchingBooks,syncWeReadShelf} from "./wereadSync";
import type {ReadingMutate} from "./ReadingShelf";
import WeReadStatisticsPanel from "./WeReadStatisticsPanel";
export default function WeReadShelfSync({account,library,mutate,zh,busy,refreshToken}:{account:string;library:ReadingLibrary;mutate:ReadingMutate;zh:boolean;busy:boolean;refreshToken:string}){
  const [connected,setConnected]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState(""),[synced,setSynced]=useState("");
  const [preview,setPreview]=useState<{connectionId:string;items:WeReadItem[]}|null>(null);
  const [choices,setChoices]=useState<Record<string,string>>({}),[search,setSearch]=useState(""),[limit,setLimit]=useState(60),[autoImport,setAutoImport]=useState(false);

  const current=useRef({library,mutate,busy});current.current={library,mutate,busy};
  const lock=useRef(false),epoch=useRef(0),last=useRef(0),previewOpen=useRef(false);previewOpen.current=!!preview;
  const tr=(a:string,b:string)=>zh?a:b;
  const request=async(action:"status"|"shelf"|"progress",arg?:string)=>extensionService.readingWeRead(action,arg,account);
  async function run(open=false){
    if(lock.current||current.current.busy||!weReadDesktopAvailable())return;
    lock.current=true;const e=epoch.current;setLoading(true);setError("");
    try{
      const result=await request("shelf");
      if(e!==epoch.current)return;
      if(!result.ok){if(result.code==="not-connected"){setConnected(false);setPreview(null);}else setError(result.code);return;}
      if(!result.shelf||!result.connectionId)throw Error("Invalid shelf");
      const connectionId=result.connectionId,items=result.shelf;
      setConnected(true);setSynced(result.checkedAt??new Date().toISOString());last.current=Date.now();
      let next=current.current.library;
      if(next.books.some(b=>b.weread?.connectionId===connectionId)||next.wereadPreferences?.connectionId===connectionId){
        next=await current.current.mutate(value=>syncWeReadShelf(value,connectionId,items,new Date().toISOString()));
      }
      if(e!==epoch.current)return;
      if(open){
        setPreview({connectionId,items});setChoices({});setSearch("");setLimit(60);
        setAutoImport(next.wereadPreferences?.connectionId===connectionId&&next.wereadPreferences.autoImport);
      }else{
        const updates:WeReadProgress[]=[];
        for(const item of recentLinkedItems(next,connectionId,items)){
          if(e!==epoch.current)return;
          const data=await request("progress",item.id);
          if(data.ok&&data.connectionId===connectionId&&data.progress)updates.push(data.progress);
          else if(!data.ok&&data.code==="rate-limit")break;
        }
        if(e===epoch.current&&updates.length)await current.current.mutate(value=>updates.reduce((v,update)=>applyWeReadProgress(v,connectionId,update,new Date().toISOString()),value));
      }
    }catch{if(e===epoch.current)setError("unavailable");}
    finally{if(e===epoch.current){lock.current=false;setLoading(false);}}
  }
  useEffect(()=>{
    const e=++epoch.current;lock.current=false;last.current=0;setConnected(false);setPreview(null);setError("");setLoading(false);setSynced("");
    if(!weReadDesktopAvailable())return;
    const status=()=>void request("status").then(result=>{if(e!==epoch.current)return;if(result.ok){setConnected(result.connected);if(result.connected&&(current.current.library.books.some(b=>b.weread)||current.current.library.wereadPreferences?.autoImport)&&!previewOpen.current)void run();else if(!result.connected)setPreview(null);}}).catch(()=>{});
    status();
    const focus=()=>{if(!previewOpen.current&&Date.now()-last.current>5*60_000)status();};
    const changed=()=>{setPreview(null);setSynced("");last.current=0;status();};
    window.addEventListener("focus",focus);window.addEventListener(WEREAD_CONNECTION_EVENT,changed);
    return()=>{++epoch.current;lock.current=false;window.removeEventListener("focus",focus);window.removeEventListener(WEREAD_CONNECTION_EVENT,changed);};
  },[account]);
  useEffect(()=>{if(connected&&!preview&&Date.now()-last.current>5*60_000&&(current.current.library.books.some(b=>b.weread)||current.current.library.wereadPreferences?.autoImport))void run();},[refreshToken]);
  const unlinked=preview?.items.filter(item=>!library.books.some(book=>sourceMatches(book,preview.connectionId,item)))??[];
  const filtered=unlinked.filter(item=>(item.title+" "+item.author).toLocaleLowerCase().includes(search.toLocaleLowerCase()));const visible=filtered.slice(0,limit);
  const selected=Object.keys(choices).length;
  async function save(){
    if(!preview||lock.current||current.current.busy)return;
    lock.current=true;setLoading(true);const e=epoch.current;setError("");
    try{
      const {connectionId,items}=preview;
      // Recheck the credential before committing; replacement keys must never apply old previews.
      const check=await request("shelf");
      if(!check.ok||check.connectionId!==connectionId||!check.shelf)throw Error("Connection changed");
      if(e!==epoch.current)return;
      const latest=new Map(check.shelf.map(item=>[sourceKey(item),item]));
      const selectedItems=items.filter(item=>Object.hasOwn(choices,sourceKey(item))).map(item=>{
        const fresh=latest.get(sourceKey(item));if(!fresh||fresh.private!==item.private)throw Error("Shelf changed");
        return {item:fresh,localId:choices[sourceKey(item)]||undefined};
      });
      const updates:WeReadProgress[]=[];
      for(const {item} of selectedItems.filter(x=>x.item.kind==="book").sort((a,b)=>(b.item.recent??0)-(a.item.recent??0)).slice(0,5)){
        if(e!==epoch.current)return;
        const result=await request("progress",item.id);
        if(result.ok&&result.connectionId===connectionId&&result.progress)updates.push(result.progress);
        else if(!result.ok&&result.code==="rate-limit")break;
      }
      if(e!==epoch.current)return;
      await current.current.mutate(value=>{
        const next=updates.reduce((v,update)=>applyWeReadProgress(v,connectionId,update,new Date().toISOString()),importWeRead(value,connectionId,selectedItems,new Date().toISOString()));
        return {...next,wereadPreferences:{connectionId,autoImport,seenKeys:[...new Set([...(value.wereadPreferences?.connectionId===connectionId?value.wereadPreferences.seenKeys??[]:[]),...check.shelf!.map(sourceKey)])].sort()}};
      });
      if(e===epoch.current){setPreview(null);setChoices({});last.current=Date.now();setSynced(check.checkedAt??new Date().toISOString());}
    }catch{if(e===epoch.current)setError("unavailable");}
    finally{if(e===epoch.current){lock.current=false;setLoading(false);}}
  }
  if(!weReadDesktopAvailable())return null;
  return <div className="reading-sync">
    <div className="reading-heading"><span className="reading-muted">{connected?(synced?tr("微信读书 · 已同步 ","WeRead · Synced ")+new Date(synced).toLocaleTimeString():tr("微信读书 · 已连接","WeRead · Connected")):tr("微信读书 · 未连接（在阅读设置中连接）","WeRead · Not connected (connect in Reading settings)")}</span>
    {connected&&<div className="reading-actions"><Button variant="ghost" disabled={busy||loading} onClick={()=>void run()}>{tr("同步","Sync")}</Button><Button variant="secondary" disabled={busy||loading} onClick={()=>void run(true)}>{tr("导入书籍","Import books")}</Button></div>}</div>
    {error&&<p role="alert" className="reading-muted">{tr("微信读书同步失败，原有数据已保留。","WeRead sync failed. Existing data is preserved.")} ({error})</p>}
    {loading&&<p role="status" className="reading-muted">{tr("正在读取微信读书…","Reading WeRead…")}</p>}
    {preview&&<div className="reading-import">
      <h3>{tr("导入预览","Import preview")}</h3><p className="reading-muted">{tr("选中的书籍将保存到 NavoPath 书架并随书库同步。私密书籍默认不选中；已有任务关联会保留。","Selected books are saved and synced with your NavoPath library. Private books are unselected by default. Existing task links are preserved.")}</p>
      <Input value={search} placeholder={tr("搜索书籍","Search books")} onChange={e=>{setSearch(e.target.value);setLimit(60);}}/>
      <div className="reading-actions"><Button variant="ghost" disabled={loading} onClick={()=>setChoices(Object.fromEntries(unlinked.filter(item=>!item.private&&!matchingBooks(library,item).length).map(item=>[sourceKey(item),""])))}>{tr("选择公开新书","Select public new books")}</Button><Button variant="ghost" onClick={()=>setChoices({})}>{tr("清空选择","Clear selection")}</Button></div>
      {visible.map(item=>{
        const key=sourceKey(item),isSelected=Object.hasOwn(choices,key),suggested=suggestedBook(library,item);
        const candidates=library.books.filter(b=>!b.weread||b.weread.connectionId!==preview.connectionId);
        return <div className="reading-import-row" key={key}><label><input type="checkbox" checked={isSelected} disabled={loading} onChange={e=>setChoices(prev=>{const next={...prev};if(e.target.checked)next[key]=suggested&&candidates.some(b=>b.id===suggested.id)?suggested.id:"";else delete next[key];return next;})}/><span>{item.title}<small className="reading-muted"> · {item.author}{item.private?tr(" · 私密/未知权限"," · Private/unknown privacy"):""}{item.kind==="audio"?tr(" · 有声书"," · Audiobook"):""}</small></span></label>
        {isSelected&&<select className="ui-input" aria-label={tr("关联已有书籍","Link existing book")+" "+item.title} value={choices[key]} onChange={e=>setChoices(prev=>({...prev,[key]:e.target.value}))}><option value="">{tr("创建新书籍","Create new book")}</option>{candidates.map(b=><option key={b.id} value={b.id}>{b.title} · {b.author}</option>)}</select>}</div>;
      })}
      {filtered.length>limit&&<Button variant="ghost" onClick={()=>setLimit(n=>n+60)}>{tr("显示更多","Show more")}</Button>}
      <label className="reading-muted"><input type="checkbox" checked={autoImport} onChange={e=>setAutoImport(e.target.checked)}/>{tr("自动导入以后新增的公开书籍（不自动合并同名书）","Automatically import future public books (no automatic title merge)")}</label>
      <div className="reading-actions"><Button variant="ghost" onClick={()=>setPreview(null)} disabled={loading}>{tr("取消","Cancel")}</Button><Button variant="primary" disabled={loading||busy} onClick={()=>void save()}>{tr("确认","Confirm")} ({selected})</Button></div>
    </div>}
    {connected&&!preview&&<WeReadStatisticsPanel account={account} zh={zh} disabled={loading}/>}
  </div>;
}
export function WeReadBookActions({book,account,mutate,zh,busy}:{book:ReadingBook;account:string;mutate:ReadingMutate;zh:boolean;busy:boolean}){
  const [pending,setPending]=useState(false),[error,setError]=useState(false);
  const source=book.weread;if(!source)return null;
  async function refresh(){if(!source||pending)return;setPending(true);setError(false);try{
    const result=await extensionService.readingWeRead("progress",source.externalId,account);
    if(!result.ok||result.connectionId!==source.connectionId||!result.progress)throw Error("Connection changed");
    const value=result.progress,connectionId=source.connectionId;
    await mutate(library=>applyWeReadProgress(library,connectionId,value,new Date().toISOString()));
  }catch{setError(true);}finally{setPending(false);}}
  return <><p className="reading-muted">{zh?"微信读书":"WeRead"}{source.kind==="audio"?(zh?" · 有声书":" · Audiobook"):""}{!source.managed?(zh?" · 本地进度独立":" · Local progress independent"):""}{source.percent!==undefined?" · "+source.percent+"%":""}{source.seconds!==undefined?" · "+Math.round(source.seconds/60)+" min":""}</p>
    <div className="reading-actions">{source.readerLink&&/^https:\/\/(?:i\.)?weread\.qq\.com\//i.test(source.readerLink)&&<a href={source.readerLink} target="_blank" rel="noopener noreferrer">{zh?"打开阅读":"Open reading"}</a>}{source.kind==="book"&&weReadDesktopAvailable()&&<Button variant="ghost" disabled={busy||pending} onClick={()=>void refresh()}>{zh?"刷新进度":"Refresh progress"}</Button>}</div>
    {error&&<p role="alert" className="reading-muted">{zh?"无法刷新，请检查当前微信读书连接。":"Unable to refresh. Check the active WeRead connection."}</p>}</>;
}
