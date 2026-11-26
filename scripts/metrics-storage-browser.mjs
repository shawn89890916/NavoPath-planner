import { analyticsPreference, analyticsError, setAnalyticsEnabled, recoverAnalytics, readAnalyticsEvents, scanAnalyticsEvents, recordLocalAnalyticsChange, captureDailyPlan, readDailyPlans, clearAnalytics } from "../src/metrics/activityStore.ts";
import { analyticsPreferenceKey } from "../src/metrics/activityBridge.ts";
import { makeTimerAnalyticsEvent } from "../src/metrics/activityEvents.ts";

const A="metrics-test-account-a", B="metrics-test-account-b";
const at="2026-11-26T09:00:00.000Z", start=new Date("2026-11-26T00:00:00.000Z"), end=new Date("2026-11-27T00:00:00.000Z");
const dbName="navopath-local-analytics-v1";
const journal=(scope,op)=>"navopath.analytics.pending."+encodeURIComponent(scope)+"."+op;
const assert=(condition,message)=>{if(!condition)throw Error(message);};
const task={id:"t",title:"private title",notes:"private notes",dueDate:"",category:"personal",priority:null,goalId:"",completed:false,createdAt:at,updatedAt:at,timelineRecords:[{id:"r",taskId:"t",scheduledDate:"2026-11-26",scheduledStart:"09:00",scheduledEnd:"10:00",executionStatus:"scheduled",createdAt:at}]};
const empty={version:1,importedSeedVersion:"",generatedAt:"",goals:[],projects:[],tasks:[],longTasks:[],events:[],notes:[],drafts:[],chat:[],aiMemories:[]};
const data={...empty,tasks:[task]};
const timer=(n,seconds=10)=>makeTimerAnalyticsEvent("t","stop",at,seconds,"test-"+String(n).padStart(4,"0"),"p");
function putJournal(scope,op,events,generation=analyticsPreference(scope).generation){
  localStorage.setItem(journal(scope,op),JSON.stringify({generation,events}));
}
function openV1(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(dbName,1);
    req.onupgradeneeded=()=>{req.result.createObjectStore("events",{keyPath:"id"}).createIndex("scopeDate",["scope","occurredAt"]);};
    req.onerror=()=>reject(req.error);req.onsuccess=()=>resolve(req.result);
  });
}
export async function seedInterrupted(){
  setAnalyticsEnabled(A,true);
  const blocked=await openV1();
  try{
    putJournal(A,"interrupted",[timer(0),timer(0,999),...Array.from({length:619},(_,i)=>timer(i+1))]);
    await recoverAnalytics(A);
    assert(analyticsError(A),"blocked upgrade must surface recovery failure");
    assert(localStorage.getItem(journal(A,"interrupted")),"failed recovery must retain journal");
  }finally{blocked.close();}
  // Recreate renderer/module state in the next phase while keeping real storage.
  return {phase:"blocked upgrade",journalRetained:true};
}
export async function recoverAndExercise(){
  assert(localStorage.getItem(journal(A,"interrupted")),"journal survives renderer reload");
  setAnalyticsEnabled(A,false);
  await recoverAnalytics(A);
  assert(!analyticsError(A),"recovery after reload and pause must succeed");
  assert(!localStorage.getItem(journal(A,"interrupted")),"replayed journal removed only after commit");
  const all=await readAnalyticsEvents(A,start,end,1000);
  assert(all.length===620,"duplicate ID in one transaction must not abort batch");
  assert(all.find(e=>e.id===timer(0).id)?.after?.elapsedSeconds===10,"first immutable event wins");
  putJournal(A,"replay",[timer(0,999)]);
  await recoverAnalytics(A);
  assert((await readAnalyticsEvents(A,start,end,1000)).length===620,"replay must be idempotent");
  assert((await readAnalyticsEvents(A,start,end,1000)).find(e=>e.id===timer(0).id)?.after?.elapsedSeconds===10,"replay must preserve first payload");
  const visited=[];
  let before;
  for(;;){
    const rows=await readAnalyticsEvents(A,start,end,50,["p"],{entity:"timer"},{before});
    if(!rows.length)break;
    visited.push(...rows.map(e=>e.id));const last=rows[rows.length-1];before={occurredAt:last.occurredAt,id:last.id};
  }
  assert(visited.length===620&&new Set(visited).size===620,"equal-timestamp keyset pages must have no omissions or duplicates");
  assert(visited.join("|")===all.map(e=>e.id).join("|"),"page order must match full range");
  assert((await readAnalyticsEvents(A,start,end,50,["other"])).length===0,"project filter");
  assert((await readAnalyticsEvents(A,new Date(at),new Date(at),50)).length===0,"empty range");
  assert((await readAnalyticsEvents(A,start,new Date(at),50)).length===0,"end boundary exclusive");
  let scanned=0;const controller=new AbortController();
  await scanAnalyticsEvents(A,start,end,()=>{if(++scanned===17)controller.abort();},{signal:controller.signal});
  assert(scanned===17,"abort must stop cursor traversal");
  setAnalyticsEnabled(B,true);
  const gB=analyticsPreference(B).generation;
  await recordLocalAnalyticsChange(B,empty,data,at,"client","local-create",gB);
  await captureDailyPlan(B,data,at,"00:00",gB);
  await captureDailyPlan(B,empty,at,"00:00",gB);
  const other=await readAnalyticsEvents(B,start,end,1000);
  assert(other.length===2,"separate scope must retain task and record only");
  assert(!JSON.stringify(other).includes("private"),"history must omit task text");
  const plans=await readDailyPlans(B,start,end);
  assert(plans.length===1&&plans[0].rows.length===1,"first daily snapshot immutable");
  assert((await readAnalyticsEvents(A,start,end,1000)).length===620,"other scope must not affect A");
  const oldGeneration=analyticsPreference(A).generation;
  // Inject a storage-open interruption while executing the real confirmed purge.
  const original=indexedDB.open;
  indexedDB.open=()=>{throw Error("injected open failure");};
  try{let rejected=false;try{await clearAnalytics(A);}catch{rejected=true;}assert(rejected&&analyticsPreference(A).purgePending,"failed purge must persist retry marker");}
  finally{indexedDB.open=original;}
  assert((await readAnalyticsEvents(A,start,end,1000)).length===0,"pending purge must hide prior history");
  let blockedEnable=false;try{setAnalyticsEnabled(A,true);}catch{blockedEnable=true;}
  assert(blockedEnable,"cannot enable before purge completes");
  putJournal(A,"stale",[timer(700)],oldGeneration);
  return {phase:"recovery, paging, isolation and interrupted purge",events:all.length,pages:Math.ceil(visited.length/50),abortedAfter:scanned};
}
export async function recoverPurge(){
  assert(analyticsPreference(A).purgePending,"confirmed purge marker survives reload");
  await recoverAnalytics(A);
  assert(!analyticsPreference(A).purgePending&&!analyticsPreference(A).enabled,"purge retry completes and leaves recording paused");
  assert((await readAnalyticsEvents(A,start,end,1000)).length===0,"purge removes old history");
  assert(!localStorage.getItem(journal(A,"stale")),"purge removes stale journal");
  assert((await readAnalyticsEvents(B,start,end,1000)).length===2,"purge must preserve other scope");
  assert((await readDailyPlans(B,start,end)).length===1,"purge must preserve other scope snapshots");
  setAnalyticsEnabled(A,true);
  await recordLocalAnalyticsChange(A,empty,data,at,"client","fresh",analyticsPreference(A).generation);
  await captureDailyPlan(A,data,at,"00:00",analyticsPreference(A).generation);
  assert((await readAnalyticsEvents(A,start,end,1000)).length===2,"fresh opt-in records again");
  await clearAnalytics(A);
  assert((await readAnalyticsEvents(A,start,end,1000)).length===0&&(await readDailyPlans(A,start,end)).length===0,"normal clear deletes events and snapshots");
  return {phase:"purge recovery and fresh opt-in",otherScopePreserved:true};
}
