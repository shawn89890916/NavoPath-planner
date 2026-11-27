import React, {useRef} from "react";
import {createRoot} from "react-dom/client";
import {flushSync} from "react-dom";
import {AnchoredNarrowMenu} from "../src/components/AnchoredNarrowMenu.tsx";

const assert = (v,m) => { if (!v) throw Error(m); };
const wait = ms => new Promise(r=>setTimeout(r,ms));
const quantile = (v,p) => Math.round([...v].sort((a,b)=>a-b)[Math.ceil(v.length*p)-1]*10)/10;

/** Real React menu and DOM rectangles, controlled 110ms loader.
 * Replay timestamps deterministically; elapsed latency is measured by Chromium.
 * This is not a production cold-import benchmark or human pointer dataset. */
export async function exerciseIntent() {
  const focus = Object.getOwnPropertyDescriptor(document,"hasFocus");
  // Offscreen CI renderer has no OS focus; isolate focus eligibility explicitly.
  let focused = true;
  Object.defineProperty(document,"hasFocus",{configurable:true,value:()=>focused});
  const style=document.createElement("style");
  style.textContent="body{margin:0}.ui-narrow-menu-layer{position:fixed;width:224px}.ui-narrow-menu{display:block}.ui-narrow-menu button{display:block;width:224px;height:32px;box-sizing:border-box}";
  document.head.append(style);
  const host=document.createElement("div");document.body.append(host);
  const root=createRoot(host);
  let state;
  const noClose=()=>{};
  const load=()=>{if(state.promise)return state.promise;state.start=performance.now();state.promise=wait(110);return state.promise;};
  function Fixture({mode,open=true,selected=false}){
    const anchor=useRef(null);
    return React.createElement(React.Fragment,null,
      React.createElement("button",{ref:anchor,style:{margin:"12px",width:120,height:32}},"Tasks"),
      React.createElement(AnchoredNarrowMenu,{open,anchorRef:anchor,onClose:noClose,label:"Views",placement:"below",intentPreload:mode==="C"?load:undefined},
        ...Array.from({length:5},(_,i)=>React.createElement("button",{key:i},"Other "+i)),
        React.createElement("button",{id:"tree",disabled:true,"data-intent-preload":""},"Disabled Tree"),
        React.createElement("button",{id:"board","data-intent-preload":"","aria-pressed":selected,onPointerEnter:mode==="A"?undefined:load,onFocus:mode==="A"?undefined:load,onClick:()=>{state.click=performance.now();state.ready=load().then(()=>state.usable=performance.now());}},"Board")));
  }
  const reset=async(mode,selected=false)=>{
    flushSync(()=>root.render(React.createElement(Fixture,{mode,open:false})));
    state={};
    flushSync(()=>root.render(React.createElement(Fixture,{mode,selected})));
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    const target=document.querySelector("#board"), menu=target.closest(".ui-narrow-menu-layer"), rect=target.getBoundingClientRect();
    assert(rect.height===32&&rect.top>=96,"fixture geometry invalid");
    return {target,menu,x:rect.left+40,y:rect.top};
  };
  let clock=1000;
  const move=(fixture,dy,opts={})=>{
    const ev=new PointerEvent("pointermove",{bubbles:true,pointerType:"mouse",clientX:fixture.x,clientY:fixture.y+dy,...opts});
    Object.defineProperty(ev,"timeStamp",{value:clock+=20});
    fixture.menu.dispatchEvent(ev);
  };
  const approach=async f=>{for(const dy of [-100,-80,-60]){move(f,dy);await wait(20);}};
  const results={A:[],B:[],C:[]};
  try{
    for(let i=0;i<5;i++)for(const mode of ["A","B","C"]){
      const f=await reset(mode);await approach(f);
      const predicted=Boolean(state.promise);
      assert(predicted===(mode==="C"),"unexpected pre-hover load in "+mode);
      assert(!state.click,"prediction activated a view");
      await wait(40);
      const hover=performance.now();
      f.target.dispatchEvent(new PointerEvent("pointerover",{bubbles:true,pointerType:"mouse",relatedTarget:null}));
      assert(Boolean(state.promise)===(mode!=="A"),"hover fallback failed in "+mode);
      await wait(20);f.target.click();assert(state.ready,"click did not activate the fixture");await state.ready;
      results[mode].push({latency:state.usable-state.click,lead:hover-state.start});
    }
    const f=await reset("C");move(f,-100);move(f,-80);move(f,-100);assert(!state.promise,"reversal predicted");
    const touch=await reset("C");for(const dy of [-100,-80,-60])move(touch,dy,{pointerType:"touch"});assert(!state.promise,"touch predicted");
    const drag=await reset("C");for(const dy of [-100,-80,-60])move(drag,dy,{buttons:1});assert(!state.promise,"drag predicted");
    const selected=await reset("C",true);await approach(selected);assert(!state.promise,"selected target predicted");
    const blur=await reset("C");move(blur,-100);move(blur,-80);window.dispatchEvent(new Event("blur"));move(blur,-60);assert(!state.promise,"blur retained trajectory");
    focused=false;await approach(blur);assert(!state.promise,"unfocused renderer predicted");focused=true;
    const key=await reset("C");key.target.focus();assert(Boolean(state.promise)&&!state.click,"focus fallback failed");await state.promise;
    flushSync(()=>root.render(React.createElement(Fixture,{mode:"C",open:false})));
    assert(!document.querySelector(".ui-narrow-menu-layer"),"menu retained after close");
    const latency=Object.fromEntries(Object.entries(results).map(([mode,rows])=>[mode,{p50:quantile(rows.map(r=>r.latency),.5),p95:quantile(rows.map(r=>r.latency),.95),...(mode==="C"?{medianLead:quantile(rows.map(r=>r.lead),.5)}:{})}]));
    assert(latency.C.p50<latency.B.p50&&latency.B.p50<latency.A.p50,"controlled loader did not benefit from early start");
    return {width:innerWidth,trialsPerMode:5,controlledLoaderMs:110,latency,actualProductionImport:false,guards:["reversal","touch","drag","selected","blur","focus","close"]};
  } finally {
    root.unmount();host.remove();style.remove();
    if(focus)Object.defineProperty(document,"hasFocus",focus);else delete document.hasFocus;
  }
}
