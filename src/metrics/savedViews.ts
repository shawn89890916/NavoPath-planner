import type { MetricRangePreset, MetricGroupBy, MetricDisplayMetric, MetricHabitMode, MetricCompletionFilter } from "./timeAllocation";
export type InsightView = "allocation"|"time"|"execution"|"engagement"|"projects"|"history";
export type TimeChart = "trend"|"heatmap"|"table";
export type MetricsQuery = {range:MetricRangePreset;customStart:string;customEnd:string;group:MetricGroupBy;display:MetricDisplayMetric;habit:MetricHabitMode;completion:MetricCompletionFilter;projects:string[]};
export type SavedMetricsView = {id:string;name:string;view:InsightView;chart:TimeChart;query:MetricsQuery};
const valid=(v:unknown,values:readonly string[])=>typeof v==="string"&&values.includes(v);
export function normalizeSavedViews(value:unknown):SavedMetricsView[]{
  if(!Array.isArray(value))return [];
  const ids=new Set<string>(),out:SavedMetricsView[]=[];
  for(const v of value){
    if(!v||typeof v!=="object"||typeof v.id!=="string"||ids.has(v.id)||typeof v.name!=="string"||!v.name.trim()||!valid(v.view,["allocation","time","execution","engagement","projects","history"])||!valid(v.chart,["trend","heatmap","table"]))continue;
    const q=v.query;
    if(!q||!valid(q.range,["all","today","yesterday","thisWeek","lastWeek","thisMonth","custom"])||!valid(q.group,["project","customCategory","tag","importance","urgency","completion","taskType"])||!valid(q.display,["percentage","duration","taskCount","completionRate"])||!valid(q.habit,["include","exclude","only"])||!valid(q.completion,["all","completed","incomplete"])||!Array.isArray(q.projects)||typeof q.customStart!=="string"||typeof q.customEnd!=="string")continue;
    ids.add(v.id);
    out.push({id:v.id.slice(0,120),name:v.name.trim().slice(0,80),view:v.view,chart:v.chart,query:{range:q.range,group:q.group,display:q.display,habit:q.habit,completion:q.completion,projects:[...new Set<string>(q.projects.filter((x:unknown):x is string=>typeof x==="string"))].slice(0,1000),customStart:q.customStart.slice(0,10),customEnd:q.customEnd.slice(0,10)}});
    if(out.length>=50)break;
  }
  return out;
}
const key=(scope:string)=>"navopath.metrics.views.v1."+encodeURIComponent(scope);
export function readSavedViews(scope:string):SavedMetricsView[]{try{return normalizeSavedViews(JSON.parse(window.localStorage.getItem(key(scope))||"[]"));}catch{return [];}}
export function writeSavedViews(scope:string,views:SavedMetricsView[]){window.localStorage.setItem(key(scope),JSON.stringify(normalizeSavedViews(views)));}
