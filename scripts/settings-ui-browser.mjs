import React from "react";
import {createRoot} from "react-dom/client";
import {flushSync} from "react-dom";
import {SettingSection,SettingRow,SettingToggle,SettingSelect,SettingTextInput,SettingColorInput,SettingNumberInput,SettingSlider,SettingActionButton,SettingDisclosure} from "../src/components/SettingsControls.tsx";
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
        h(SettingSection,{title:tr("Danger","危险操作"),tone:"danger",anchor:"danger"},row("danger-row","Reset",null))
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
    for(const selector of [pick("legacy")+" > .df-settings-group-body",pick("danger")+" > .df-settings-group-body",pick("disclosure")]){
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
  root.unmount();style.remove();document.documentElement.style.removeProperty("--workspace-corner-radius");return {width:innerWidth,cases,sharedRadius:true,fieldAlignment:true,pluginSwitchAlignment:true,sectionHierarchy:true};
}
