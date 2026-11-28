import React, {useRef,useState} from "react";
import {createRoot} from "react-dom/client";
import {createPortal,flushSync} from "react-dom";
import {ExecutionSplitLayout,CandidatePanelShell,CandidatePanelHeader,TimelineCanvas,TimelineEventBlock} from "../src/components/ExecutionSharedLayout.tsx";
import MobileExecutionControls from "../src/components/MobileExecutionControls.tsx";
import "../src/app.css";
import "../src/mobile-execution.css";
import "../src/ui-primitives.css";

const h=React.createElement;
const assert=(value,message)=>{if(!value)throw Error(message);};
const close=(a,b,message)=>assert(Math.abs(a-b)<2,message+": "+a+" / "+b);
const frames=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
const wait=()=>new Promise(r=>setTimeout(r,360));
export async function exerciseSideWorkspace(){
  document.body.innerHTML='<div id="root"></div>';
  const root=createRoot(document.getElementById("root"));
  const style=document.createElement("style");
  style.textContent="html,body,#root{height:100%;width:100%;margin:0;overflow:hidden} #side-fixture{width:100%;height:100%;min-width:0;min-height:0;--motion-layout:240ms;--motion-ease-settle:ease;--radius-card:32px} #side-fixture .df-candidate-list{min-height:0} .df-mobile-floating-actions{--motion-layout:240ms;--motion-ease-settle:ease}";
  document.head.append(style);
  let hits=0;
  const noop=()=>{};
  function Fixture({dark}){
    const [open,setOpen]=useState(false), [view,setView]=useState("Tasks");
    const panel=useRef(null),trigger=useRef(null), scroll=useRef(0);
    return h("div",{id:"side-fixture",className:"df-app mode-execute "+(dark?"theme-dark":"theme-light"),"data-phone-execution":"true","data-side-workspace-open":open||undefined,"data-workspace-layout":innerWidth>innerHeight?"dock-right":"portrait"},
      h(ExecutionSplitLayout,null,
        h("div",{className:"df-compact-execute-controls"},h("button",null,"Today")),
        h(CandidatePanelShell,{panelRef:panel,className:"is-mobile-candidates "+(open?"compact-active":"compact-inactive"),ariaHidden:!open,inert:!open},
          h(CandidatePanelHeader,{title:h("button",{className:"df-shelf-title-button",onClick:()=>setView(v=>v==="Tasks"?"Tree":"Tasks")},view),actions:h("button",null,"Add")}),
          h("div",{className:"df-candidate-list"},...Array.from({length:40},(_,i)=>h("div",{key:i,style:{height:45,flexShrink:0}},"Task "+i)))),
        h("section",{className:"df-timeline-panel compact-active",id:"df-execute-timeline",onClick:()=>hits++},
          h("div",{className:"df-timeline-body"},
            h("div",{className:"df-timeline-content"},
              h("div",{className:"df-timeline-daily"},
                h(TimelineCanvas,{height:2400},h(TimelineEventBlock,{title:"Scheduled",lang:"en",style:{position:"absolute",top:150,left:64,right:8,height:72}}))))))),
      createPortal(h("div",{className:"df-mobile-floating-actions","data-side-workspace":true,"data-side-workspace-open":open||undefined},
        h(MobileExecutionControls,{lang:"en",count:40,hidden:false,drawerOpen:open,panelRef:panel,scrollRef:scroll,onClose:()=>setOpen(false),onOpen:()=>setOpen(true),onCancel:noop,onConfirm:noop,triggerRef:trigger})),document.body));
  }
  try{
    for(const dark of [false,true]){
      flushSync(()=>root.render(h(Fixture,{dark,key:String(dark)})));
      await frames();
      const pick=s=>document.querySelector(s);
      const trigger=pick(".df-mobile-candidates-trigger"), panel=pick(".df-candidate-panel"), timeline=pick(".df-timeline-panel"), canvas=pick(".df-timeline-scroll"), list=pick(".df-candidate-list"), block=pick(".df-template-period-block");
      assert(trigger&&panel&&timeline&&canvas&&block,"Fixture incomplete");
      assert(trigger.getAttribute("aria-expanded")==="false","Initially expanded");
      const baseline=timeline.getBoundingClientRect(), blockWidth=block.getBoundingClientRect().width, triggerX=trigger.getBoundingClientRect().left;
      canvas.scrollTop=200;
      assert(canvas.scrollTop>0,"Timeline is not scrollable");
      trigger.click();await wait();await frames();
      const opened=timeline.getBoundingClientRect(), shelf=panel.getBoundingClientRect(), button=trigger.getBoundingClientRect();
      assert(trigger.getAttribute("aria-expanded")==="true","Button did not expand");
      close(opened.width,baseline.width,"Timeline width changed");
      close(block.getBoundingClientRect().width,blockWidth,"Task block geometry changed");
      close(opened.left-baseline.left,shelf.width,"Timeline did not move with shelf");
      assert(opened.left>0&&innerWidth-opened.left>=108,"Timeline strip is unusable");
      assert(button.left>triggerX&&button.right<=innerWidth+1,"Moving button clipped");
      assert(canvas.scrollTop>=199,"Opening reset timeline scroll");
      document.documentElement.setAttribute("data-side-workspace-drag-active","");
      document.documentElement.setAttribute("data-side-workspace-drag-expanded","");
      await frames();
      const exposed=timeline.getBoundingClientRect();
      assert(exposed.left<opened.left-10,"Drag does not expose more timeline");
      close(block.getBoundingClientRect().width,blockWidth,"Drag exposure changed task geometry");
      document.documentElement.removeAttribute("data-side-workspace-drag-expanded");
      document.documentElement.removeAttribute("data-side-workspace-drag-active");
      await wait();await frames();
      close(timeline.getBoundingClientRect().left,opened.left,"Drag exposure did not restore");
      canvas.scrollTop=320;assert(canvas.scrollTop>=319,"Open timeline cannot scroll");
      const rect=canvas.getBoundingClientRect(), x=Math.min(innerWidth-10,Math.max(rect.left+5,opened.left+5)), y=Math.min(innerHeight-120,rect.top+80);
      assert(document.elementFromPoint(x,y)?.closest(".df-timeline-panel"),"Visible timeline is covered");
      const previousHits=hits;
      document.elementFromPoint(x,y).click();
      assert(hits===previousHits+1,"Timeline click was blocked");
      list.scrollTop=120;
      pick(".df-shelf-title-button").click();await frames();
      assert(pick(".df-shelf-title-button").textContent==="Tree","View switch failed");
      assert(trigger.getAttribute("aria-expanded")==="true","View switch closed Tasks");
      assert(list.scrollTop>=119,"View switch reset list");
      trigger.click();await wait();await frames();
      close(timeline.getBoundingClientRect().left,baseline.left,"Closing did not restore position");
      close(trigger.getBoundingClientRect().left,triggerX,"Closing did not restore button");
      assert(trigger.getAttribute("aria-expanded")==="false","Button did not collapse");
      assert(canvas.scrollTop>=319,"Closing reset timeline scroll");
    }
    return {width:innerWidth,height:innerHeight,themes:2,stableTaskWidth:true,liveTimeline:true,viewSwitch:true};
  }finally{document.documentElement.removeAttribute("data-side-workspace-drag-expanded");document.documentElement.removeAttribute("data-side-workspace-drag-active");root.unmount();style.remove();}
}
