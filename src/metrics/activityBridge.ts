import type { PlannerData } from "../types";
import type { AnalyticsSource, TimerTransition } from "./activityEvents";
export type AnalyticsPreference = { enabled: boolean; since?: string; generation: string; lastEnabledAt?:string; pausedAt?:string; hasGaps?:boolean; purgePending?:boolean };
export const analyticsPreferenceKey=(scope:string)=>"navopath.analytics.v1."+encodeURIComponent(scope);
export function analyticsPreference(scope:string):AnalyticsPreference {
  try {const p=JSON.parse(window.localStorage.getItem(analyticsPreferenceKey(scope))||"null") as AnalyticsPreference|null;if(p&&typeof p.enabled==="boolean"&&typeof p.generation==="string")return p;}catch{/* unavailable storage */}
  return {enabled:false,generation:""};
}
type Recorder=Pick<typeof import("./activityStore"),"recordLocalAnalyticsChange"|"recordTimerTransition"|"recoverAnalytics"|"captureDailyPlan">;
let recorder:Recorder|undefined;
export function registerAnalyticsRecorder(value:Recorder){recorder=value;}
function dispatch(scope:string,run:(m:Recorder,generation:string)=>void,allowPaused=false) {
  const p=analyticsPreference(scope);if(!p.enabled&&!(allowPaused&&(p.since||p.purgePending)))return;
  if(recorder){run(recorder,p.generation);return;}
  void import("./activityStore").then(m=>{if(analyticsPreference(scope).generation===p.generation)run(m,p.generation);}).catch(()=>window.dispatchEvent(new CustomEvent("navopath-analytics-change",{detail:scope})));
}
export function recordLocalAnalyticsChange(scope:string,previous:PlannerData,next:PlannerData,at:string,source:AnalyticsSource="client",operationId?:string){
  if(previous===next)return;
  dispatch(scope,(m,g)=>m.recordLocalAnalyticsChange(scope,previous,next,at,source,operationId,g));
}
export function recordTimerTransition(scope:string,taskId:string|undefined,transition:TimerTransition,at:string,elapsedSeconds:number,projectId?:string){
  dispatch(scope,(m,g)=>m.recordTimerTransition(scope,taskId,transition,at,elapsedSeconds,projectId,g));
}
export function recoverAnalytics(scope:string){dispatch(scope,m=>m.recoverAnalytics(scope),true);}

export function captureDailyPlan(scope:string,data:PlannerData,at:string,dayStartTime?:string){dispatch(scope,(m,g)=>m.captureDailyPlan(scope,data,at,dayStartTime,g));}
