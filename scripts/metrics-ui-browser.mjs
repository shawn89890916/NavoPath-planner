import React,{useState} from "react";
import {createRoot} from "react-dom/client";
import {MetricsInsights} from "../src/metrics/MetricsInsights.tsx";
import {analyticsPreference,setAnalyticsEnabled,recordLocalAnalyticsChange,captureDailyPlan} from "../src/metrics/activityStore.ts";
import {readSavedViews} from "../src/metrics/savedViews.ts";
import "../src/app.css";
import "../src/ui-primitives.css";

const assert=(condition,message)=>{if(!condition)throw Error(message);};
const wait=async (condition,message)=>{for(let i=0;i<250;i++){const value=condition();if(value)return value;await new Promise(resolve=>setTimeout(resolve,20));}throw Error(message);};
const iso=(d,h)=>new Date(2026,10,d,h).toISOString();
const created=iso(25,8),scope="metrics-ui-a",other="metrics-ui-b";
const taskName="FixtureTask_"+"VeryLongLabel".repeat(12),projectName="FixtureProject_"+"LongLabel".repeat(12);
const record=(id,date,start,end,status="completed")=>({id,taskId:"t",scheduledDate:date,scheduledStart:start,scheduledEnd:end,executionStatus:status,createdAt:created,engagement:70});
const task={id:"t",title:taskName,notes:"",dueDate:"",category:"personal",priority:null,goalId:"",projectId:"p",completed:true,createdAt:created,updatedAt:created,timelineRecords:[record("r","2026-11-25","09:00","10:00"),record("r2","2026-11-26","10:00","11:00")]};
const data={version:1,importedSeedVersion:"",generatedAt:"",goals:[],projects:[{id:"p",title:projectName,category:"personal",notes:"",completed:false,color:"#557799",createdAt:created,updatedAt:created}],tasks:[task],longTasks:[],events:[],notes:[],drafts:[],chat:[],aiMemories:[],timeEntries:[{id:"te",taskId:"t",timelineRecordId:"r",startAt:iso(25,9),endAt:iso(25,10),durationMinutes:45,source:"manual",createdAt:created,updatedAt:created}]};
const query={range:"custom",customStart:"2026-11-25",customEnd:"2026-11-26",group:"project",display:"duration",habit:"include",completion:"all",projects:[]};
const button=(name,root=document)=>[...root.querySelectorAll("button")].find(el=>el.textContent.trim()===name);
const heading=name=>[...document.querySelectorAll("h3")].find(el=>el.textContent.includes(name));
const click=async(name,root=document)=>(await wait(()=>button(name,root),"Missing button: "+name)).click();
const tick=()=>new Promise(resolve=>setTimeout(resolve,60));

export async function exerciseUi(){
  localStorage.removeItem("navopath.metrics.views.v1."+encodeURIComponent(scope));
  localStorage.removeItem("navopath.metrics.views.v1."+encodeURIComponent(other));
  if(!analyticsPreference(scope).enabled)setAnalyticsEnabled(scope,true);
  const gen=analyticsPreference(scope).generation;
  const scheduled={...data,tasks:[{...task,completed:false,timelineRecords:[record("r","2026-11-25","09:00","10:00","scheduled")]}],timeEntries:[]};
  await recordLocalAnalyticsChange(scope,{...data,tasks:[],timeEntries:[]},scheduled,iso(25,8),"client","ui-create",gen);
  await recordLocalAnalyticsChange(scope,scheduled,data,iso(25,11),"client","ui-complete",gen);
  await captureDailyPlan(scope,scheduled,iso(25,8),"00:00",gen);
  document.body.innerHTML='<div id="root"></div>';
  // Use the real stylesheet and the production component; keep the fixture independent of authentication.
  const style=document.createElement("style");style.textContent="html,body,#root{margin:0;width:100%;min-width:0;height:100%;overflow:auto;} #fixture{box-sizing:border-box;width:100%;min-width:0;padding:8px;--paper-bg:#fff;--paper-rule:#ddd;--paper-rule-strong:#aaa;--text-main:#222;--text-muted:#666;--accent-active:#3266ad;background:var(--paper-bg);color:var(--text-main);font:14px system-ui;} #fixture.theme-dark{--paper-bg:#202124;--paper-rule:#444;--paper-rule-strong:#777;--text-main:#eee;--text-muted:#aaa;--accent-active:#8eb6ff;}";document.head.append(style);
  function Fixture(){
    const [q,setQ]=useState(query),[account,setAccount]=useState(scope),[theme,setTheme]=useState("light");
    window.metricsFixture={setAccount,setTheme};
    return React.createElement("main",{id:"fixture",className:theme==="dark"?"theme-dark":""},React.createElement(MetricsInsights,{scope:account,data,referenceDate:"2026-11-26",dayStartTime:"00:00",weekStartsOn:1,engagementEnabled:true,projectIds:q.projects,habitMode:q.habit,completion:q.completion,lang:"en",query:q,onApplyQuery:setQ}));
  }
  const root=createRoot(document.getElementById("root"));root.render(React.createElement(Fixture));
  await wait(()=>document.querySelector("nav.df-metric-insight-tabs"),"Metrics tabs not mounted");
  const selectView=async(name,title)=>{await click(name,document.querySelector("nav.df-metric-insight-tabs"));await wait(()=>heading(title),"View did not load: "+title);};
  const checkGeometry=()=>{
    const shell=document.getElementById("fixture"),outer=shell.getBoundingClientRect();
    assert(shell.scrollWidth<=shell.clientWidth+2,"Metrics panel escaped horizontal bounds "+shell.scrollWidth+"/"+shell.clientWidth);
    for(const el of shell.querySelectorAll(".df-metric-insight-table,.df-metric-insight-trend,.df-metric-hour-grid,.df-metric-group-row")){
      const r=el.getBoundingClientRect();assert(r.left>=outer.left-2&&r.right<=outer.right+2,"Overflow container escaped panel: "+el.className);
    }
  };
  await selectView("Projects","Project comparison");
  (await wait(()=>document.querySelector(".df-metric-group-row"),"Project row missing")).click();
  await wait(()=>heading("Tasks and independent executions"),"Project details not loaded");
  await click(taskName);await wait(()=>heading("Execution details"),"Task execution details not loaded");
  assert(document.querySelectorAll(".df-metric-insight-table[tabindex='0']").length>0,"Tables need keyboard scroll entry");
  const trend=await wait(()=>document.querySelector(".df-metric-insight-trend button"),"Project trend missing");
  trend.click();await wait(()=>button("Clear date filter"),"Date selection did not show clear action");
  await wait(()=>button(taskName),"Date selection lost project task");
  let exported;
  const makeUrl=URL.createObjectURL,anchorClick=HTMLAnchorElement.prototype.click;
  URL.createObjectURL=blob=>{exported=blob;return makeUrl.call(URL,blob);};
  HTMLAnchorElement.prototype.click=function(){if(!this.download)return anchorClick.call(this);};
  try{await click("Export all executions in scope");await wait(()=>exported,"CSV not created");const csv=await exported.text();assert(csv.includes("Record ID")&&csv.includes('"r"')&&!csv.includes('"r2"'),"Date CSV must contain selected day only");}
  finally{URL.createObjectURL=makeUrl;HTMLAnchorElement.prototype.click=anchorClick;}
  await click("Clear date filter");await tick();checkGeometry();
  window.metricsFixture.setTheme("dark");await tick();checkGeometry();
  await selectView("Time","Time trend");await click("Calendar heatmap");await wait(()=>document.querySelector(".df-metric-calendar-grid"),"Calendar heatmap not loaded");checkGeometry();
  await selectView("Engagement","Daily rating trend");checkGeometry();
  await selectView("Overview","Selected range");checkGeometry();
  await selectView("Execution","First observed daily plan");await wait(()=>document.querySelector(".df-metric-insight-scatter circle"),"Observed execution scatter missing");
  const circle=document.querySelector(".df-metric-insight-scatter circle"),cx=circle.getAttribute("cx");
  await click("Last observed schedule");await wait(()=>button("Last observed schedule")?.getAttribute("aria-pressed")==="true","Scatter reference did not switch");assert(cx===document.querySelector(".df-metric-insight-scatter circle").getAttribute("cx"),"Unchanged schedule should have identical point");checkGeometry();
  await selectView("History","Local detailed history");await wait(()=>document.querySelector(".df-metric-insight-history details"),"Recorded history not visible");
  const saved=document.querySelector(".df-metric-saved-views");saved.open=true;const input=saved.querySelector("input");
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(input,"Fixture only");input.dispatchEvent(new Event("input",{bubbles:true}));
  await wait(()=>!button("Save as new",saved).disabled,"Saved-view input not accepted");await click("Save as new",saved);await wait(()=>readSavedViews(scope).some(v=>v.name==="Fixture only"),"Saved view not persisted");
  window.metricsFixture.setAccount(other);await wait(()=>document.querySelector(".df-metric-saved-views select")?.options.length===1,"Account switch leaked saved view");
  await selectView("Projects","Project comparison");
  const keyButton=await wait(()=>button("Time",document.querySelector("nav")),"Keyboard target missing");keyButton.focus();
  window.verifyMetricsKeyboard=async()=>{await wait(()=>heading("Time trend"),"Keyboard did not activate Time tab");checkGeometry();return true;};
  return {width:innerWidth,height:innerHeight,projectDrilldown:true,csv:true,history:true,accountIsolation:true,themeGeometry:true,views:6};
}
