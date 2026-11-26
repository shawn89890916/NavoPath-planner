import type { PlannerData } from "../types";
import type { AnalyticsSource, TimerTransition } from "./activityEvents";
export type AnalyticsPreference = { enabled: boolean; since?: string; generation: string };
export const analyticsPreferenceKey=(scope:string)=>"navopath.analytics.v1."+encodeURIComponent(scope);
export function analyticsPreference(scope:string):AnalyticsPreference {
  try {const p=JSON.parse(window.localStorage.getItem(analyticsPreferenceKey(scope))||"null") as AnalyticsPreference|null;if(p&&typeof p.enabled==="boolean"&&typeof p.generation==="string")return p;}catch{/* unavailable storage */}
  return {enabled:false,generation:""};
}
function dispatch(scope:string,run:(m:typeof import("./activityStore"),generation:string)=>void) {
  const p=analyticsPreference(scope);if(!p.enabled)return;
  void import("./activityStore").then(m=>{if(analyticsPreference(scope).generation===p.generation)run(m,p.generation);}).catch(()=>window.dispatchEvent(new CustomEvent("navopath-analytics-change",{detail:scope})));
}
export function recordLocalAnalyticsChange(scope:string,previous:PlannerData,next:PlannerData,at:string,source:AnalyticsSource="client",operationId?:string){
  if(previous===next)return;
  dispatch(scope,(m,g)=>m.recordLocalAnalyticsChange(scope,previous,next,at,source,operationId,g));
}
export function recordTimerTransition(scope:string,taskId:string|undefined,transition:TimerTransition,at:string,elapsedSeconds:number,projectId?:string){
  dispatch(scope,(m,g)=>m.recordTimerTransition(scope,taskId,transition,at,elapsedSeconds,projectId,g));
}
export function recoverAnalytics(scope:string){dispatch(scope,m=>{void m.recoverAnalytics(scope);});}
