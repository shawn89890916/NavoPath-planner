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
  const now=new Date().toISOString();
  const next={enabled,since:old.since || (enabled?now:undefined),generation:old.generation || crypto.randomUUID(),lastEnabledAt:enabled?now:old.lastEnabledAt,pausedAt:enabled?undefined:now,hasGaps:Boolean(old.hasGaps||old.pausedAt||(!enabled&&old.since))};
  window.localStorage.setItem(key(scope),JSON.stringify(next)); signal(scope);
}
function open():Promise<IDBDatabase> {
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB,2);
    req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(STORE)){const store=db.createObjectStore(STORE,{keyPath:"id"});store.createIndex("scopeDate",["scope","occurredAt"]);}if(!db.objectStoreNames.contains(PLANS)){const plans=db.createObjectStore(PLANS,{keyPath:"id"});plans.createIndex("scopeDate",["scope","capturedAt"]);}};
    req.onsuccess=()=>{req.result.onversionchange=()=>req.result.close();resolve(req.result);};
    req.onerror=()=>reject(req.error);
    req.onblocked=()=>reject(new Error("Analytics database is blocked"));
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
    for(const e of events){const id=scope+":"+e.id;const existing=store.get(id);existing.onsuccess=()=>{if(!existing.result)store.add({...e,scope,id} satisfies StoredEvent);};}
    await done;
  } finally { db.close(); }
}
const queues=new Map<string,Promise<void>>();
const journalPrefix=(scope:string)=>"navopath.analytics.pending."+encodeURIComponent(scope)+".";
type Journal={generation:string;events:AnalyticsEvent[]};
function queue(scope:string,work:()=>Promise<void|boolean>,kind="write"){
  const pending=(queues.get(scope)||Promise.resolve()).then(work).then(changed=>{const failed=errors.get(scope)?.has(kind);setError(scope,kind,false);if(changed!==false||failed)signal(scope);},()=>{setError(scope,kind,true);signal(scope);});
  queues.set(scope,pending);void pending.finally(()=>{if(queues.get(scope)===pending)queues.delete(scope);});
}
async function journalAndAppend(scope:string,generation:string,events:AnalyticsEvent[]){
  if(!events.length||analyticsPreference(scope).generation!==generation)return;
  const journalKey=journalPrefix(scope)+events[0].operationId;
  let journaled=false;
  try{window.localStorage.setItem(journalKey,JSON.stringify({generation,events} satisfies Journal));journaled=true;}catch{/* IndexedDB can still succeed */}
  await append(scope,generation,events);
  if(journaled)window.localStorage.removeItem(journalKey);
  if(pendingKeys(scope).length)throw Error("Earlier analytics writes are pending");
}
function pendingKeys(scope:string){return Array.from({length:localStorage.length},(_,i)=>localStorage.key(i)).filter((k):k is string=>Boolean(k?.startsWith(journalPrefix(scope))));}
export async function recoverAnalytics(scope:string){
  queue(scope,async()=>{
    const p=analyticsPreference(scope);if(!p.generation)return false;
    const keys=pendingKeys(scope);let failed=false;
    for(const k of keys){
      try{const raw=localStorage.getItem(k);if(!raw)continue;const j=JSON.parse(raw) as Journal;
        if(j.generation!==p.generation){localStorage.removeItem(k);continue;}
        if(!Array.isArray(j.events)||!j.events.every(e=>e?.schemaVersion===1&&typeof e.id==="string"&&typeof e.operationId==="string"&&typeof e.occurredAt==="string"))throw Error("Invalid pending analytics record");
        await append(scope,j.generation,j.events);localStorage.removeItem(k);
      }catch{failed=true;}
    }
    if(failed)throw Error("Analytics recovery incomplete");return Boolean(keys.length);
  });
}
/** Observe accepted renderer mutations, not remote replay. Recording never blocks planning. */
export function recordLocalAnalyticsChange(scope:string,previous:PlannerData,next:PlannerData,occurredAt:string,source:AnalyticsSource="client",operationId:string=crypto.randomUUID(),generation=analyticsPreference(scope).generation) {
  if(analyticsPreference(scope).generation!==generation)return;
  queue(scope,async()=>{const {diffAnalyticsEvents}=await import("./activityEvents");await journalAndAppend(scope,generation,diffAnalyticsEvents(previous,next,occurredAt,operationId,source));});
}
export function recordTimerTransition(scope:string,taskId:string|undefined,transition:TimerTransition,at:string,elapsedSeconds:number,projectId:string|undefined,generation:string){
  queue(scope,async()=>{const {makeTimerAnalyticsEvent}=await import("./activityEvents");await journalAndAppend(scope,generation,[makeTimerAnalyticsEvent(taskId,transition,at,elapsedSeconds,crypto.randomUUID(),projectId)]);});
}
export async function readAnalyticsEvents(scope:string,start:Date,end:Date,limit=501,projectIds:string[]=[],filters?:{source?:string;entity?:string}):Promise<AnalyticsEvent[]> {
  if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||end<=start)return [];
  const projects=new Set(projectIds);
  const db=await open();
  try {
    const tx=db.transaction(STORE,"readonly"), idx=tx.objectStore(STORE).index("scopeDate");
    const bounds=IDBKeyRange.bound([scope,start.toISOString()],[scope,end.toISOString()],false,true);
    return await new Promise((resolve,reject)=>{
      const out:AnalyticsEvent[]=[]; const req=idx.openCursor(bounds,"prev");
      req.onerror=()=>reject(req.error);
      req.onsuccess=()=>{const c=req.result;if(!c || out.length>=limit){resolve(out);return;}const {scope:_,...event}=c.value as StoredEvent;if((!projects.size||projects.has(event.projectId||"__unassigned__"))&&(!filters?.source||filters.source===event.source)&&(!filters?.entity||filters.entity===event.entityType))out.push({...event,id:event.id.startsWith(scope+":")?event.id.slice(scope.length+1):event.id});c.continue();};
    });
  } finally {db.close();}
}
type StoredPlan=PlanBaseline & {scope:string};
const captured=new Set<string>();
export function captureDailyPlan(scope:string,data:PlannerData,at:string,dayStartTime:string|undefined,generation:string){
  queue(scope,async()=>{
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
  if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||end<=start)return [];
  const db=await open();try{
    const tx=db.transaction(PLANS,"readonly"),idx=tx.objectStore(PLANS).index("scopeDate"),bounds=IDBKeyRange.bound([scope,start.toISOString()],[scope,end.toISOString()],false,true);
    return await new Promise((resolve,reject)=>{const out:PlanBaseline[]=[];const req=idx.openCursor(bounds,"prev");req.onerror=()=>reject(req.error);req.onsuccess=()=>{const c=req.result;if(!c||out.length>=366){resolve(out);return;}const {scope:_,...plan}=c.value as StoredPlan;out.push(plan);c.continue();};});
  }finally{db.close();}
}
export async function clearAnalytics(scope:string) {
  window.localStorage.setItem(key(scope),JSON.stringify({enabled:false,generation:crypto.randomUUID()}));
  await queues.get(scope);
  const pending=Array.from({length:localStorage.length},(_,i)=>localStorage.key(i)).filter((k):k is string=>Boolean(k?.startsWith(journalPrefix(scope))));for(const k of pending)localStorage.removeItem(k);
  const db=await open();
  try {
    const tx=db.transaction([STORE,PLANS],"readwrite"),done=finished(tx);
    for(const name of [STORE,PLANS]){const req=tx.objectStore(name).index("scopeDate").openCursor(IDBKeyRange.bound([scope,""],[scope,"\uffff"]));req.onsuccess=()=>{const c=req.result;if(c){c.delete();c.continue();}};}
    await done; errors.delete(scope); signal(scope);
  } finally {db.close();}
}
