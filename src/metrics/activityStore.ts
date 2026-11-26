import type { PlannerData } from "../types";
import type { AnalyticsEvent, AnalyticsSource, TimerTransition } from "./activityEvents";
import { analyticsPreference, analyticsPreferenceKey as key } from "./activityBridge";
export { analyticsPreference } from "./activityBridge";

const DB = "navopath-local-analytics-v1";
const STORE = "events";
const PLANS = "dailyPlans";
import type { PlanBaseline } from "./planBaseline";
const CHANGE = "navopath-analytics-change";
type StoredEvent = AnalyticsEvent & { scope: string };
const errors = new Map<string,Set<string>>();
function setError(scope:string,kind:string,failed:boolean){const current=errors.get(scope)||new Set<string>();if(failed)current.add(kind);else current.delete(kind);if(current.size)errors.set(scope,current);else errors.delete(scope);}
function signal(scope:string) { window.dispatchEvent(new CustomEvent(CHANGE,{detail:scope})); }
export function subscribeAnalytics(scope:string, listener:()=>void) {
  const event = (e: Event) => { if ((e as CustomEvent).detail === scope) listener(); };
  const storage = (e: StorageEvent) => { if (e.key === key(scope)) listener(); };
  window.addEventListener(CHANGE,event); window.addEventListener("storage",storage);
  return () => { window.removeEventListener(CHANGE,event); window.removeEventListener("storage",storage); };
}
export function analyticsError(scope:string) { return Boolean(errors.get(scope)?.size); }
export function setAnalyticsEnabled(scope:string,enabled:boolean) {
  const old=analyticsPreference(scope);
  if(old.purgePending)throw Error("History clear must finish before recording can resume");
  const now=new Date().toISOString();
  const next={enabled,since:old.since || (enabled?now:undefined),generation:old.generation || crypto.randomUUID(),lastEnabledAt:enabled?now:old.lastEnabledAt,pausedAt:enabled?undefined:now,hasGaps:Boolean(old.hasGaps||old.pausedAt||(!enabled&&old.since))};
  window.localStorage.setItem(key(scope),JSON.stringify(next)); signal(scope);
}
function open():Promise<IDBDatabase> {
  return new Promise((resolve,reject)=>{
    let blocked=false;
    const req=indexedDB.open(DB,2);
    req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(STORE)){const store=db.createObjectStore(STORE,{keyPath:"id"});store.createIndex("scopeDate",["scope","occurredAt"]);}if(!db.objectStoreNames.contains(PLANS)){const plans=db.createObjectStore(PLANS,{keyPath:"id"});plans.createIndex("scopeDate",["scope","capturedAt"]);}};
    req.onsuccess=()=>{req.result.onversionchange=()=>req.result.close();if(blocked){req.result.close();return;}resolve(req.result);};
    req.onerror=()=>reject(req.error);
    req.onblocked=()=>{blocked=true;reject(new Error("Analytics database is blocked"));};
  });
}
function finished(tx:IDBTransaction):Promise<void> {
  return new Promise((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error || Error("Analytics transaction aborted"));});
}
async function append(scope:string, generation:string, events:AnalyticsEvent[]) {
  const db=await open();
  try {
    const p=analyticsPreference(scope);
    if (p.generation!==generation) return;
    const tx=db.transaction(STORE,"readwrite"), done=finished(tx), store=tx.objectStore(STORE);
    const seen=new Set<string>();
    for(const e of events){const id=scope+":"+e.id;if(seen.has(id))continue;seen.add(id);const existing=store.get(id);existing.onsuccess=()=>{if(!existing.result)store.add({...e,scope,id} satisfies StoredEvent);};}
    await done;
  } finally { db.close(); }
}
const queues=new Map<string,Promise<void>>();
const journalPrefix=(scope:string)=>"navopath.analytics.pending."+encodeURIComponent(scope)+".";
type Journal={generation:string;events:AnalyticsEvent[]};
function queue(scope:string,work:()=>Promise<void|boolean>,kind="write"){
  const pending=(queues.get(scope)||Promise.resolve()).then(work).then(changed=>{const failed=errors.get(scope)?.has(kind);setError(scope,kind,false);if(changed!==false||failed)signal(scope);},()=>{setError(scope,kind,true);signal(scope);});
  queues.set(scope,pending);void pending.finally(()=>{if(queues.get(scope)===pending)queues.delete(scope);});return pending;
}
async function journalAndAppend(scope:string,generation:string,events:AnalyticsEvent[]){
  if(!events.length||analyticsPreference(scope).generation!==generation)return;
  const journalKey=journalPrefix(scope)+events[0].operationId;
  let journaled=false;
  let batch=events;
  let existing:string|null=null;
  try{existing=window.localStorage.getItem(journalKey);}catch{/* IndexedDB can still succeed */}
  if(existing){
    const prior=parseJournal(existing);
    if(prior.generation===generation){
      const first=new Map<string,AnalyticsEvent>();
      for(const e of [...prior.events,...events])if(!first.has(e.id))first.set(e.id,e);
      batch=[...first.values()];
    }
  }
  try{window.localStorage.setItem(journalKey,JSON.stringify({generation,events:batch} satisfies Journal));journaled=true;}catch{/* IndexedDB can still succeed */}
  await append(scope,generation,batch);
  // Another renderer may have updated the journal while this append was pending.
  if(journaled&&window.localStorage.getItem(journalKey)===JSON.stringify({generation,events:batch}))window.localStorage.removeItem(journalKey);
  if(pendingKeys(scope).length)throw Error("Earlier analytics writes are pending");
}
function parseJournal(raw:string):Journal{
  const j=JSON.parse(raw) as Journal;
  if(typeof j?.generation!=="string"||!Array.isArray(j.events)||!j.events.every(e=>e?.schemaVersion===1&&typeof e.id==="string"&&typeof e.operationId==="string"&&typeof e.occurredAt==="string"))throw Error("Invalid pending analytics record");
  return j;
}
function pendingKeys(scope:string){return Array.from({length:localStorage.length},(_,i)=>localStorage.key(i)).filter((k):k is string=>Boolean(k?.startsWith(journalPrefix(scope))));}
export function recoverAnalytics(scope:string){
  if(analyticsPreference(scope).purgePending)return clearAnalytics(scope).catch(()=>undefined);
  return queue(scope,async()=>{
    const p=analyticsPreference(scope);if(!p.generation)return false;
    const keys=pendingKeys(scope);let failed=false;
    for(const k of keys){
      try{const raw=localStorage.getItem(k);if(!raw)continue;const j=parseJournal(raw);
        if(j.generation!==p.generation){if(localStorage.getItem(k)===raw)localStorage.removeItem(k);continue;}
        await append(scope,j.generation,j.events);if(localStorage.getItem(k)===raw)localStorage.removeItem(k);
      }catch{failed=true;}
    }
    if(failed||pendingKeys(scope).length)throw Error("Analytics recovery incomplete");return Boolean(keys.length);
  });
}
/** Observe accepted renderer mutations, not remote replay. Recording never blocks planning. */
export function recordLocalAnalyticsChange(scope:string,previous:PlannerData,next:PlannerData,occurredAt:string,source:AnalyticsSource="client",operationId:string=crypto.randomUUID(),generation=analyticsPreference(scope).generation) {
  if(analyticsPreference(scope).generation!==generation)return;
  return queue(scope,async()=>{const {diffAnalyticsEvents}=await import("./activityEvents");await journalAndAppend(scope,generation,diffAnalyticsEvents(previous,next,occurredAt,operationId,source));});
}
export function recordTimerTransition(scope:string,taskId:string|undefined,transition:TimerTransition,at:string,elapsedSeconds:number,projectId:string|undefined,generation:string){
  return queue(scope,async()=>{const {makeTimerAnalyticsEvent}=await import("./activityEvents");await journalAndAppend(scope,generation,[makeTimerAnalyticsEvent(taskId,transition,at,elapsedSeconds,crypto.randomUUID(),projectId)]);});
}
export type AnalyticsPageCursor={occurredAt:string;id:string};
/** One account-scoped snapshot transaction. Consume rows without materializing the entire log. */
export async function scanAnalyticsEvents(scope:string,start:Date,end:Date,visit:(event:AnalyticsEvent)=>boolean|void,options:{signal?:AbortSignal;before?:AnalyticsPageCursor}={}):Promise<void>{
  if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||end<=start)return;
  const {signal,before}=options;
  if(signal?.aborted||analyticsPreference(scope).purgePending)return;
  if(before&&(!Number.isFinite(Date.parse(before.occurredAt))||before.occurredAt<start.toISOString()||before.occurredAt>=end.toISOString()))return;
  const db=await open();
  try{
    if(signal?.aborted)return;
    const tx=db.transaction(STORE,"readonly"),idx=tx.objectStore(STORE).index("scopeDate");
    const bounds=IDBKeyRange.bound([scope,start.toISOString()],[scope,before?.occurredAt||end.toISOString()],false,!before);
    await new Promise<void>((resolve,reject)=>{
      const stop=()=>{try{tx.abort();}catch{/* already completed */}};
      signal?.addEventListener("abort",stop,{once:true});
      const cleanup=()=>signal?.removeEventListener("abort",stop);
      tx.oncomplete=()=>{cleanup();resolve();};
      tx.onabort=()=>{cleanup();if(signal?.aborted)resolve();else reject(tx.error||Error("Analytics read aborted"));};
      const req=idx.openCursor(bounds,"prev");
      req.onsuccess=()=>{
        const c=req.result;if(!c||signal?.aborted)return;
        const {scope:_,...event}=c.value as StoredEvent;
        if(before&&event.occurredAt===before.occurredAt){const cmp=indexedDB.cmp(c.primaryKey,scope+":"+before.id);if(cmp>0){c.continuePrimaryKey([scope,before.occurredAt],scope+":"+before.id);return;}if(cmp===0){c.continue();return;}}
        try{if(visit({...event,id:event.id.startsWith(scope+":")?event.id.slice(scope.length+1):event.id})!==false)c.continue();}
        catch(error){cleanup();reject(error);stop();}
      };
    });
  }finally{db.close();}
}
export async function readAnalyticsEvents(scope:string,start:Date,end:Date,limit=501,projectIds:string[]=[],filters?:{source?:string;entity?:string},options:{signal?:AbortSignal;before?:AnalyticsPageCursor}={}):Promise<AnalyticsEvent[]>{
  const projects=new Set(projectIds),out:AnalyticsEvent[]=[];
  if(limit<=0)return out;
  await scanAnalyticsEvents(scope,start,end,event=>{
    if((!projects.size||projects.has(event.projectId||"__unassigned__"))&&(!filters?.source||filters.source===event.source)&&(!filters?.entity||filters.entity===event.entityType))out.push(event);
    return out.length<limit;
  },options);
  return out;
}
type StoredPlan=PlanBaseline & {scope:string};
const captured=new Set<string>();
export function captureDailyPlan(scope:string,data:PlannerData,at:string,dayStartTime:string|undefined,generation:string){
  return queue(scope,async()=>{
    const p=analyticsPreference(scope);if(!p.enabled||p.generation!==generation)return;
    const {baselineIdentity,buildPlanBaseline}=await import("./planBaseline");const time=new Date(at);if(!Number.isFinite(time.getTime()))return;
    const identity=baselineIdentity(time,dayStartTime),id=scope+":"+identity.id,cacheKey=id+":"+generation;
    if(captured.has(cacheKey))return false;
    const db=await open();
    try{
      const tx=db.transaction(PLANS,"readwrite"),done=finished(tx),store=tx.objectStore(PLANS);
      const req=store.get(id);req.onsuccess=()=>{const current=analyticsPreference(scope);if(!req.result&&current.enabled&&current.generation===generation)store.add({...buildPlanBaseline(data,time,dayStartTime),scope,id} satisfies StoredPlan);};
      await done;captured.add(cacheKey);if(captured.size>400)captured.delete(captured.values().next().value!);
    }finally{db.close();}
  },"snapshot");
}
export async function readDailyPlans(scope:string,start:Date,end:Date):Promise<PlanBaseline[]>{
  if(analyticsPreference(scope).purgePending)return [];
  if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||end<=start)return [];
  const db=await open();try{
    const tx=db.transaction(PLANS,"readonly"),idx=tx.objectStore(PLANS).index("scopeDate"),bounds=IDBKeyRange.bound([scope,start.toISOString()],[scope,end.toISOString()],false,true);
    return await new Promise((resolve,reject)=>{const out:PlanBaseline[]=[];const req=idx.openCursor(bounds,"prev");req.onerror=()=>reject(req.error);req.onsuccess=()=>{const c=req.result;if(!c||out.length>=366){resolve(out);return;}const {scope:_,...plan}=c.value as StoredPlan;out.push(plan);c.continue();};});
  }finally{db.close();}
}
const purges=new Map<string,Promise<void>>();
/** A confirmed purge remains pending until IndexedDB and the journal are cleared. */
export function clearAnalytics(scope:string):Promise<void>{
  const active=purges.get(scope);if(active)return active;
  const work=performPurge(scope).finally(()=>{if(purges.get(scope)===work)purges.delete(scope);});
  purges.set(scope,work);return work;
}
async function performPurge(scope:string){
  try{
    const old=analyticsPreference(scope);
    const generation=old.purgePending?old.generation:crypto.randomUUID();
    localStorage.setItem(key(scope),JSON.stringify({enabled:false,generation,purgePending:true}));
    signal(scope);
    await queues.get(scope);
    const pending=pendingKeys(scope);
    const db=await open();
    try{
      const current=analyticsPreference(scope);
      if(!current.purgePending||current.generation!==generation)return;
      const tx=db.transaction([STORE,PLANS],"readwrite"),done=finished(tx);
      for(const name of [STORE,PLANS]){
        const req=tx.objectStore(name).index("scopeDate").openCursor(IDBKeyRange.bound([scope,""],[scope,"\uffff"]));
        req.onsuccess=()=>{const c=req.result;if(c){c.delete();c.continue();}};
      }
      await done;
      const after=analyticsPreference(scope);
      if(after.purgePending&&after.generation===generation){
        for(const k of pending.concat(pendingKeys(scope)))localStorage.removeItem(k);
        localStorage.setItem(key(scope),JSON.stringify({enabled:false,generation}));
        errors.delete(scope);
      }
    }finally{db.close();}
  }catch(error){setError(scope,"purge",true);throw error;}
  finally{signal(scope);}
}
