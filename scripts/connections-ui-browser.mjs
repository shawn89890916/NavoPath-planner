import React, {useState} from "react";
import {createRoot} from "react-dom/client";
import ConnectionProviders from "../src/components/ConnectionProviders.tsx";
import {extensionService} from "../src/extensions/service.ts";
import "../src/app.css";
import "../src/ui-primitives.css";

const assert=(value,message)=>{if(!value)throw Error(message);};
const wait=async(fn,message)=>{for(let i=0;i<250;i++){const value=fn();if(value)return value;await new Promise(r=>setTimeout(r,20));}throw Error(message);};
const button=name=>[...document.querySelectorAll("#fixture button")].find(el=>el.textContent.trim()===name);
const click=async name=>(await wait(()=>button(name),"Missing button "+name)).click();
const contains=text=>document.getElementById("fixture")?.textContent.includes(text) ?? false;
export async function exerciseConnections(){
  document.body.innerHTML='<div id="root"></div>';
  const style=document.createElement("style");style.textContent="html,body,#root{margin:0;width:100%;min-width:0;height:100%;overflow:auto} #fixture{box-sizing:border-box;width:100%;min-width:0;padding:12px;--paper-bg:#F8F7F3;--paper-rule:#ddd;--paper-rule-strong:#aaa;--text-main:#27231E;--text-muted:#665f58;--accent-active:#584D3D;--surface-main:#F8F7F3;--surface-card:#fff;--paper-sans:system-ui;--radius-card:12px;--radius-control:8px;--space-1:4px;--space-2:8px;--space-3:12px;--space-4:16px;--space-5:20px;font:14px system-ui;color:var(--text-main);background:var(--surface-main)} #fixture.theme-dark{--paper-bg:#080808;--paper-rule:#2a2a2a;--paper-rule-strong:#555;--text-main:#D9D6CF;--text-muted:#B1AEA7;--accent-active:#A9A49B;--surface-main:#101010;--surface-card:#191919}";
  document.head.append(style);
  Object.defineProperty(document,"hidden",{configurable:true,value:false});
  const page={id:"fixture-sp",owner:"official:super-productivity-sync",name:"Super Productivity Sync",mount(node){const p=document.createElement("p");p.textContent="PLUGIN MANAGEMENT";node.append(p);return ()=>p.remove();}};
  const snapshot={preferences:{installed:{"official:super-productivity-sync":{enabled:true,manifest:{id:"super-productivity-sync"}}}},catalog:[],settingsPages:[page],safeMode:false,busy:false,status:{}};
  extensionService.getSnapshot=()=>snapshot;extensionService.subscribe=()=>()=>{};
  let conflicts=[],writes=0;
  window.plannerApi={getAuthState:async()=>({mode:"cloud",user:{id:"fixture"}}),requestSuperProductivitySync:async()=>({pairId:"fixture-pair",status:"active",conflicts}),getCalDavCredential:async()=>null,listExternalCalendars:async()=>({sources:[]}),listCalendarFeedTokens:async()=>[{id:"fixture-token"}],createCalendarFeedToken:async()=>{writes++;throw Error("Unexpected credential write");},revokeCalendarFeedToken:async()=>{writes++;throw Error("Unexpected credential write");},getCalendarHistoryToken:async()=>{writes++;throw Error("Unexpected credential read");}};
  function Fixture(){
    const [anchor,setAnchor]=useState(),[theme,setTheme]=useState("light");
    window.connectionFixture={setAnchor,setTheme};
    return React.createElement("main",{id:"fixture",className:theme==="dark"?"theme-dark":""},React.createElement(ConnectionProviders,{lang:"en",anchor,onSelect:setAnchor,errorMessage:String,caldav:React.createElement("p",null,"CALDAV"),externalCalendar:React.createElement("p",null,"EXTERNAL"),mcp:React.createElement("p",null,"MCP"),bridge:React.createElement("p",null,"BRIDGE")}));
  }
  const root=createRoot(document.getElementById("root"));root.render(React.createElement(Fixture));
  const bounds=()=>{const el=document.getElementById("fixture");assert(el.scrollWidth<=el.clientWidth+2,"Connection page horizontal overflow "+el.scrollWidth+"/"+el.clientWidth);};
  await wait(()=>contains("Paired"),"Pair state not loaded");assert(!contains("Notion Calendar"),"Unconfigured provider exposed in overview");bounds();
  await click("Add");await wait(()=>contains("Notion Calendar"),"Provider picker missing");assert(!contains("Super Productivity"),"Paired provider duplicated");bounds();
  window.connectionFixture.setAnchor("connection-super-productivity");
  await wait(()=>contains("remote availability unknown"),"Compact SP detail missing");assert(!contains("PLUGIN MANAGEMENT")&&!contains("Copy history subscription link"),"Setup controls exposed prematurely");bounds();
  await click("Set up");await wait(()=>contains("Copy history subscription link"),"History control missing");bounds();
  await click("Hide");await wait(()=>!contains("Copy history subscription link"),"History did not collapse");
  await click("Open");await wait(()=>contains("PLUGIN MANAGEMENT"),"Management page did not mount");bounds();
  await click("Hide");await wait(()=>!contains("PLUGIN MANAGEMENT"),"Management page did not unmount");
  window.connectionFixture.setTheme("dark");await new Promise(r=>setTimeout(r,60));bounds();
  conflicts=[{}];window.connectionFixture.setAnchor("connections");await wait(()=>contains("Sync conflicts"),"Conflict status not shown");
  window.connectionFixture.setAnchor("connection-super-productivity");await wait(()=>contains("PLUGIN MANAGEMENT"),"Conflict management not exposed");bounds();
  assert(writes===0,"Browsing must not create or revoke links");
  root.unmount();return {width:innerWidth,light:true,dark:true,overview:true,historyDisclosure:true,management:true,conflict:true,credentialWrites:writes};
}
