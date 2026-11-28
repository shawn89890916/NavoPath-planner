import {useEffect,useRef,useCallback} from "react";
import {useReadingLibrary} from "./useReadingLibrary";
import type {Task,TimeEntry} from "../types";
import {extensionService} from "../extensions/service";
import {weReadDesktopAvailable,type WeReadProgress} from "./wereadConnection";
import {applyWeReadProgress,recentLinkedItems,syncWeReadShelf} from "./wereadSync";
export type ReadingRuntimeSnapshot = ReturnType<typeof useReadingLibrary> & {account:string};
const REFRESH_MS=5*60_000;
/** Optional runtime owns background refresh; it never starts for an unimported library. */
export default function ReadingRuntime({account,onChange,tasks,entries,shelfVisible}:{account:string;onChange:(snapshot:ReadingRuntimeSnapshot|null)=>void;tasks:readonly Task[];entries:readonly TimeEntry[];shelfVisible:boolean}){
  const reading=useReadingLibrary(true,account);
  const state=useRef({reading,shelfVisible});state.current={reading,shelfVisible};
  const epoch=useRef(0),lock=useRef(false),last=useRef(0),previous=useRef("");
  const linked=reading.library?.books.some(b=>b.weread)||reading.library?.wereadPreferences?.autoImport===true;
  const taskIds=new Set(reading.library?.taskLinks.map(link=>link.taskId)??[]);
  const activityToken=JSON.stringify([tasks.filter(t=>t.completed&&taskIds.has(t.id)).map(t=>t.id).sort(),entries.filter(e=>taskIds.has(e.taskId)).map(e=>e.id).sort()]);
  const refresh=useCallback(async(force=false)=>{
    const current=state.current;
    if(lock.current||current.shelfVisible||current.reading.busy||!current.reading.library||(!current.reading.library.books.some(b=>b.weread)&&!current.reading.library.wereadPreferences?.autoImport)||!weReadDesktopAvailable()||Date.now()-last.current<(force?60_000:REFRESH_MS))return;
    lock.current=true;const generation=epoch.current;last.current=Date.now();
    const valid=()=>generation===epoch.current&&!state.current.shelfVisible;
    try{
      const result=await extensionService.readingWeRead("shelf",undefined,account);
      if(!valid()||!result.ok||!result.connectionId||!result.shelf)return;
      const connectionId=result.connectionId,items=result.shelf;
      const initial=state.current.reading.library;if(!initial)return;
      if(!initial.books.some(b=>b.weread?.connectionId===connectionId)&&initial.wereadPreferences?.connectionId!==connectionId)return;
      const next=syncWeReadShelf(initial,connectionId,items,new Date().toISOString());
      const updates:WeReadProgress[]=[];
      for(const item of recentLinkedItems(next,connectionId,items)){
        if(!valid())return;
        const data=await extensionService.readingWeRead("progress",item.id,account);
        if(data.ok&&data.connectionId===connectionId&&data.progress)updates.push(data.progress);
        else if(!data.ok&&data.code==="rate-limit")break;
      }
      if(!valid()||state.current.reading.busy)return;
      await state.current.reading.mutate(value=>updates.reduce((v,update)=>applyWeReadProgress(v,connectionId,update,new Date().toISOString()),syncWeReadShelf(value,connectionId,items,new Date().toISOString())));
    }catch{/* Failed external reads leave the local library intact. */}
    finally{if(generation===epoch.current)lock.current=false;}
  },[account]);
  useEffect(()=>{
    ++epoch.current;lock.current=false;last.current=0;previous.current="";
    const focus=()=>{void refresh();};
    window.addEventListener("focus",focus);
    return()=>{++epoch.current;lock.current=false;window.removeEventListener("focus",focus);};
  },[account,refresh]);
  useEffect(()=>{if(linked&&!shelfVisible)void refresh();},[linked,shelfVisible,refresh]);
  useEffect(()=>{
    const changed=previous.current!==""&&previous.current!==activityToken;previous.current=activityToken;
    if(changed&&linked&&!shelfVisible)void refresh(true);
  },[activityToken,linked,shelfVisible,refresh]);
  useEffect(()=>{onChange({account,...reading});},[account,reading.library,reading.error,reading.busy,onChange]);
  useEffect(()=>()=>onChange(null),[onChange]);
  return null;
}
