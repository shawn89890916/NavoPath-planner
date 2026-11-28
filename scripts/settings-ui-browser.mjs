import React from "react";
import {createRoot} from "react-dom/client";
import {flushSync} from "react-dom";
import {SettingSection,SettingRow,SettingToggle,SettingSelect,SettingTextInput,SettingColorInput,SettingNumberInput,SettingSlider,SettingActionButton,SettingDisclosure} from "../src/components/SettingsControls.tsx";
import ReadingSettings from "../src/reading/ReadingSettings.tsx";
import ReadingShelf from "../src/reading/ReadingShelf.tsx";
import {engine} from "../src/extensions/service.ts";
import {emptyReadingLibrary,createBook,linkReadingTask} from "../src/reading/model.ts";
import "../src/app.css";
import "../src/ui-primitives.css";
const h=React.createElement;
const assert=(value,message)=>{if(!value)throw Error(message);};
const close=(a,b,message)=>assert(Math.abs(a-b)<=1,message+": "+a+" / "+b);
const box=(root,selector)=>root.querySelector(selector).getBoundingClientRect();
export async function exerciseSettings(){
  document.body.innerHTML='<div id="root"></div>';
  const style=document.createElement("style");
  style.textContent="html,body,#root{width:100%;height:100%;margin:0;overflow:auto} #settings-fixture{display:block;width:100%;min-width:0;height:auto;box-sizing:border-box;padding:0} #settings-fixture .fixture-pane{width:100%;min-width:0;box-sizing:border-box;padding:12px;container:settings-content / inline-size;} #settings-fixture .df-settings-content-column{max-width:620px}";
  document.head.append(style);
  const root=createRoot(document.getElementById("root"));
  const noop=()=>{};
  const row=(anchor,title,control,extra={})=>h(SettingRow,{anchor,title,control,...extra});
  let cases=0;
  for(const dark of [false,true])for(const lang of ["en","zh"])for(const r of [0,16,32,48,64]){
    const tr=(en,zh)=>lang==="en"?en:zh;
    // Match the production useLayoutEffect: root-owned derived radius tokens
    // resolve at documentElement, including overlays mounted through portals.
    document.documentElement.style.setProperty("--workspace-corner-radius",r+"px");
    flushSync(()=>root.render(h("div",{id:"settings-fixture",className:"df-app df-settings-surface mode-execute"+(dark?" theme-dark":"")},
      h("main",{className:"fixture-pane df-settings-content"},
      h("div",{className:"df-settings-content-column"},
        h("h2",{className:"df-settings-content-title"},tr("Appearance","外观")),
        h(SettingSection,{title:tr("Interface","界面"),variant:"grouped"},
          row("select",tr("Color mode","颜色模式"),h(SettingSelect,{value:"system",onChange:noop,ariaLabel:"Mode",options:[{value:"system",label:tr("Follow system","跟随系统")}]})),
          row("text",tr("Display name","显示名称"),h(SettingTextInput,{value:"NavoPath",onChange:noop,ariaLabel:"Name"})),
          row("color",tr("Accent","强调色"),h(SettingColorInput,{value:"#73968a",onChange:noop,ariaLabel:"Accent"})),
          row("radius",tr("Corner radius","界面圆角"),h(React.Fragment,null,h(SettingSlider,{value:r,min:0,max:64,onChange:noop,ariaLabel:"Radius slider"}),h(SettingNumberInput,{value:r,min:0,max:64,onChange:noop,ariaLabel:"Radius number",suffix:"px"}))),
          row("plugin",tr("An installed plugin with a long name","一个拥有较长名称的已安装插件"),h(React.Fragment,null,h(SettingActionButton,null,tr("Manage connection","管理连接")),h(SettingActionButton,null,tr("Update","更新")),h(SettingActionButton,null,tr("Retry","重试"))),{layout:"actions",description:tr("Long supporting metadata and status.","较长的插件描述与状态。"),trailing:h(SettingToggle,{checked:true,onChange:noop,ariaLabel:"Plugin enabled"})}),
          row("switch",tr("Notification","通知"),h(SettingToggle,{checked:false,onChange:noop,ariaLabel:"Notifications"}))
        ),
        h(SettingSection,{title:tr("Advanced","高级"),variant:"plain",anchor:"legacy"},row("plain",tr("Name","名称"),h(SettingTextInput,{value:"",onChange:noop,ariaLabel:"Other name"})),
          h("div",null,h(SettingSection,{title:tr("Nested plugin","插件子组"),anchor:"embedded"},row("embedded-row","Nested",null)))),
        h(SettingDisclosure,{title:tr("More options","更多选项"),anchor:"disclosure",open:true},
          h(SettingSection,{title:tr("Inner","内部"),anchor:"disclosure-child"},row("disclosure-row","Option",null))),
        h(SettingSection,{title:tr("Danger","危险操作"),tone:"danger",anchor:"danger"},row("danger-row","Reset",null)),
        h("div",{className:"df-settings-home-card df-settings-home-quick-card","data-settings-anchor":"home"},h("div",{className:"df-settings-home-quick-row"},h("span",null,tr("Language","语言")),h(SettingSelect,{value:"en",onChange:noop,ariaLabel:"Language",options:[{value:"en",label:"English"}]})))
      )))));
    const f=document.getElementById("settings-fixture");
    const pick=a=>'[data-settings-anchor="'+a+'"]';
    for(const selector of [".df-settings-group--grouped > .df-settings-group-body",pick("select")+" select",pick("text")+" input",pick("color")+" .df-settings-color-field",pick("radius")+" input[type=number]"])close(parseFloat(getComputedStyle(f.querySelector(selector)).borderTopLeftRadius),r,"Shared radius "+selector);
    const select=box(f,pick("select")+" select"),input=box(f,pick("text")+" input"),color=box(f,pick("color")+" .df-settings-color-field");
    close(select.left,input.left,"Field left");close(select.right,input.right,"Field right");close(input.right,color.right,"Color right");
    close(box(f,pick("select")+" .df-settings-row-title").left,box(f,pick("plain")+" .df-settings-row-title").left,"Grouped/plain label left");
    close(box(f,pick("select")+" .df-settings-row-title").left,box(f,".df-settings-group-title").left,"Heading left");
    close(box(f,pick("plugin")+" [role=switch]").right,box(f,pick("switch")+" [role=switch]").right,"Switch right");
    for(const el of f.querySelectorAll(".df-settings-row,.df-settings-row-control,.df-settings-group-body"))assert(el.scrollWidth<=el.clientWidth+1,"Overflow "+el.className+" "+el.scrollWidth+"/"+el.clientWidth+" viewport="+innerWidth+" radius="+r);
    const outer=f.querySelector(".df-settings-group--grouped > .df-settings-group-body");
    const disclosure=f.querySelector(pick("disclosure"));
    for(const selector of [pick("legacy")+" > .df-settings-group-body",pick("danger")+" > .df-settings-group-body",pick("disclosure"),pick("home")]){
      const el=f.querySelector(selector), cs=getComputedStyle(el);
      close(parseFloat(cs.borderTopWidth),1,"Outer border "+selector);
      close(parseFloat(cs.borderTopLeftRadius),r,"Outer radius "+selector);
      close(el.getBoundingClientRect().left,outer.getBoundingClientRect().left,"Outer left "+selector);
      close(el.getBoundingClientRect().right,outer.getBoundingClientRect().right,"Outer right "+selector);
    }
    for(const anchor of ["embedded","disclosure-child"]){
      const cs=getComputedStyle(f.querySelector(pick(anchor)+" > .df-settings-group-body"));
      close(parseFloat(cs.borderTopWidth),0,"Nested border "+anchor);
      close(parseFloat(cs.paddingLeft),0,"Nested inset "+anchor);
    }
    const before=disclosure.getBoundingClientRect();
    disclosure.open=false;
    close(disclosure.getBoundingClientRect().left,before.left,"Closed left");
    close(disclosure.getBoundingClientRect().width,before.width,"Closed width");
    disclosure.open=true;
    cases++;
  }
  // Exercise the actual Reading settings component using a local IPC-contract fixture.
  let connected=false, failTest=false, upgradeNotice=true;const calls=[];
  const connection=async(action,candidate)=>{
    calls.push({action,hasKey:!!candidate});
    if(action==="status")return {ok:true,connected};
    if(action==="disconnect"){connected=false;return {ok:true,connected:false};}
    if(action==="test"&&failTest)return {ok:false,code:"auth"};
    if(action==="connect"){assert(candidate==="wrk-fixture-key","Key was not submitted to connection adapter");connected=true;}
    return {ok:true,connected,checkedAt:"2026-11-28T00:00:00Z",counts:{books:2,audiobooks:1,articles:1},upgradeNotice};
  };
  const desktopAvailable=()=>true;
  const wait=async(fn,message)=>{for(let i=0;i<100;i++){const value=fn();if(value)return value;await new Promise(r=>setTimeout(r,20));}throw Error(message);};
  const click=label=>{const button=[...document.querySelectorAll("button")].find(b=>b.textContent===label&&!b.disabled);assert(button,"Missing action "+label);button.click();};
  const mount=(lang,active,available=desktopAvailable)=>flushSync(()=>root.render(h("div",{id:"settings-fixture",className:"df-app df-settings-surface mode-execute"},h("main",{className:"fixture-pane df-settings-content"},h("div",{className:"df-settings-content-column"},h(ReadingSettings,{lang,active,connection,desktopAvailable:available}))))));
  mount("en",true);await wait(()=>document.querySelector('input[type=password]:not(:disabled)'),"Reading connection not initialized");
  const password=document.querySelector('input[type=password]');
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(password,"wrk-fixture-key");
  password.dispatchEvent(new Event("input",{bubbles:true}));password.dispatchEvent(new Event("change",{bubbles:true}));
  await wait(()=>[...document.querySelectorAll("button")].find(b=>b.textContent==="Verify and connect"&&!b.disabled),"Connect remained disabled");
  click("Verify and connect");
  await wait(()=>document.body.textContent.includes("Audiobooks 1"),"Shelf summary missing");
  assert(document.body.textContent.includes("optional API update notice"),"Non-blocking update notice missing");
  assert(document.body.textContent.includes("Books 2"),"upgrade_info incorrectly blocked bookshelf data");
  assert(password.value==="","Credential input retained the submitted key");
  for(const el of document.querySelectorAll(".df-settings-row,.df-settings-row-control,.df-settings-group-body"))assert(el.scrollWidth<=el.clientWidth+2,"Reading settings overflow at "+innerWidth);
  failTest=true;click("Test connection");await wait(()=>document.querySelector('[role=alert]')?.textContent.includes("rejected authorization"),"Auth failure missing");
  click("Disconnect");await wait(()=>document.body.textContent.includes("Not connected"),"Disconnect did not clear state");
  mount("zh",false);await wait(()=>document.body.textContent.includes("请先启用阅读插件"),"Disabled plugin guard missing");
  mount("zh",true,()=>false);await wait(()=>document.body.textContent.includes("连接仅支持桌面端"),"Web limitation missing");
  assert(calls.map(x=>x.action).join(",")==="status,connect,test,disconnect","Unexpected external connection calls");
  const core=await engine(),original=core.readingWeRead,oldDesktop=window.desktopApi;
  window.desktopApi={readingWeRead:()=>{}};
  let library=linkReadingTask(createBook(emptyReadingLibrary(),{id:"existing",title:"Existing Book",author:"Author",now:"2026-11-28T00:00:00Z"}),"existing","existing-task"),taskBook="";
  const item=(id,title,secret=false)=>({id,kind:"book",title,author:"Author",private:secret,finished:false,recent:100});
  const books=[item("existing-remote","Existing Book"),item("new","New Book"),item("private","Private Book",true)];
  let pauseNextShelf=false,releaseShelf;
  core.readingWeRead=async(action,arg,account)=>{
    assert(account==="preview","Wrong account");
    const base={ok:true,connected:true,connectionId:"fixture",checkedAt:"2026-11-28T00:00:00Z"};
    if(action==="shelf"){if(pauseNextShelf){pauseNextShelf=false;return new Promise(resolve=>{releaseShelf=()=>resolve({...base,shelf:books});});}return {...base,shelf:books};}
    if(action==="progress")return {...base,progress:{id:arg,percent:25,seconds:1800,started:true,finished:false,recent:101}};
    if(action==="statistics")return {...base,statistics:{period:arg,base:100,totalSeconds:1800,days:[{day:100,seconds:1800}],readDays:1}};
    return base;
  };
  const mutate=async change=>{library=change(library);mountShelf();return library;};
  function mountShelf(){flushSync(()=>root.render(h("div",{className:"df-app mode-execute",style:{width:"100%",minWidth:0}},h(ReadingShelf,{account:"preview",library,busy:false,error:"",lang:"en",onCreateTask:async id=>{taskBook=id;},mutate,tasks:[],entries:[],engagementEnabled:false,onSaved:()=>{}}))))}
  try{
    mountShelf();await wait(()=>[...document.querySelectorAll("button")].some(b=>b.textContent==="Import books"),"Shelf connection missing");
    async function selectImport(){
      click("Import books");await wait(()=>document.querySelector(".reading-import"),"Import preview missing");
      click("Select public new books");
      const existingRow=[...document.querySelectorAll(".reading-import-row")].find(row=>row.textContent.includes("Existing Book"));
      existingRow.querySelector("input").click();
      await wait(()=>existingRow.querySelector("select")?.value==="existing","Existing book was not matched");
      assert(![...document.querySelectorAll(".reading-import-row")].find(row=>row.textContent.includes("Private Book")).querySelector("input").checked,"Private book selected");
    }
    await selectImport();pauseNextShelf=true;click("Confirm (2)");
    await wait(()=>typeof releaseShelf==="function","Import validation request did not start");
    window.dispatchEvent(new Event("navopath:weread-connection-changed"));releaseShelf();
    await wait(()=>!document.querySelector(".reading-import"),"Connection change did not close stale preview");
    assert(library.books.length===1,"Stale preview committed after credential change");
    await selectImport();click("Confirm (2)");await wait(()=>library.books.length===2&&!document.querySelector(".reading-import"),"Import failed");
    assert(library.taskLinks[0].taskId==="existing-task"&&library.books.some(b=>b.id==="existing"),"Existing book/task identity lost");
    assert(library.books.find(b=>b.title==="New Book").progress.current===25,"Progress not imported");
    click("New Book");await wait(()=>[...document.querySelectorAll("button")].some(b=>b.textContent==="Add reading task"&&!b.disabled),"Book details did not open");click("Add reading task");await wait(()=>taskBook,"Reading task not created");
    assert(taskBook===library.books.find(b=>b.title==="New Book").id,"Task not linked to book");
    click("View statistics");await wait(()=>document.body.textContent.includes("30 min")&&document.querySelector(".reading-stat-row"),"External statistics missing");
    for(const el of document.querySelectorAll(".reading-shelf,.reading-sync,.reading-book,.reading-week"))assert(el.scrollWidth<=el.clientWidth+2,"Reading shelf overflow at "+innerWidth);
  }finally{core.readingWeRead=original;window.desktopApi=oldDesktop;}
  root.unmount();style.remove();document.documentElement.style.removeProperty("--workspace-corner-radius");return {width:innerWidth,cases,sharedRadius:true,fieldAlignment:true,pluginSwitchAlignment:true,sectionHierarchy:true,readingConnection:true,readingImport:true};
}
