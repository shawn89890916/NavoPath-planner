import { createDragProjection } from "../src/motion/dragProjection.ts";
import React from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { useUnifiedDrag } from "../src/useUnifiedDrag.tsx";

export async function exerciseDragProjection() {
  const assert = (v,m) => { if (!v) throw Error(m); };
  // Exercise real DOM geometry and WAAPI, but explicitly drive the projection
  // frame queue: a hidden CI renderer may not present a compositor frame.
  const raf=window.requestAnimationFrame, caf=window.cancelAnimationFrame, match=window.matchMedia;
  const pending=new Map();let nextFrame=0;
  window.requestAnimationFrame=callback=>{pending.set(++nextFrame,callback);return nextFrame;};
  window.cancelAnimationFrame=id=>pending.delete(id);
  let reduced=false;
  const media=new EventTarget();
  Object.defineProperty(media,"matches",{get:()=>reduced});
  window.matchMedia=query=>query==="(prefers-reduced-motion: reduce)"?media:match.call(window,query);
  const tick=()=>{const callbacks=[...pending.values()];pending.clear();for(const cb of callbacks)cb(performance.now());};
  const before = document.documentElement.dataset.motionPreference;
  document.documentElement.dataset.motionPreference="standard";
  const root=document.createElement("div");
  root.style.cssText="position:fixed;top:10px;left:10px;width:200px;display:flex;flex-direction:column;row-gap:4px";
  let created=0;
  const rows=Array.from({length:8},(_,i)=>{
    const row=document.createElement("div");row.dataset.candidateTaskId=String(i);
    row.style.cssText="height:30px;flex:none;border:1px solid transparent;border-radius:8px;box-sizing:border-box";
    row.textContent="Task "+i;
    const animate=row.animate.bind(row);
    row.animate=(...args)=>{created++;return animate(...args)};
    root.append(row);return row;
  });
  document.body.append(root);
  const initial=rows.map(row=>({height:row.getBoundingClientRect().height,width:row.getBoundingClientRect().width,radius:getComputedStyle(row).borderRadius}));
  const projection=createDragProjection(rows[0]);
  try {
    projection.update(rows[3],"before");await tick();
    assert(created===2,"initial projection expected two animations, got "+created+"; viewport="+innerWidth+"x"+innerHeight+"; rect="+JSON.stringify(rows[0].getBoundingClientRect())+"; translate="+getComputedStyle(rows[1]).translate+"; reduced="+matchMedia("(prefers-reduced-motion: reduce)").matches);
    const retained=rows[1].getAnimations()[0];
    projection.update(rows[4],"before");await tick();
    assert(created===3,"unchanged siblings were restarted");
    assert(rows[1].getAnimations()[0]===retained,"animation identity lost");
    projection.update(rows[3],"before");await tick();
    assert(created===4,"return should affect only one sibling");
    assert(rows[1].getAnimations()[0]===retained,"return restarted unchanged sibling");
    window.dispatchEvent(new Event("resize"));await tick();
    assert(created===4,"identical refresh restarted animations");
    projection.logical(()=>{
      for(let i=0;i<rows.length;i++){
        const r=rows[i].getBoundingClientRect(),style=getComputedStyle(rows[i]);
        assert(r.height===initial[i].height&&r.width===initial[i].width&&style.borderRadius===initial[i].radius,"task style changed");
        assert(style.translate==="none","logical read retained a projection");
      }
    });
    const measuredCreations=created;
    reduced=true;media.dispatchEvent(new Event("change"));tick();
    assert(rows.every(row=>row.getAnimations().length===0),"system reduced motion did not clear animations");
    reduced=false;media.dispatchEvent(new Event("change"));tick();
    assert(rows[1].getAnimations().length===1,"normal motion did not resume");
    document.documentElement.dataset.motionPreference="off";
    window.dispatchEvent(new Event("resize"));tick();
    assert(rows.every(row=>row.getAnimations().length===0),"motion off did not clear animations");
    const dragFrameCoalescing = exerciseUnifiedDragFrames(tick);
    return {confirmedTargets:3,animationCreations:measuredCreations,legacyRestartCreations:8,unchangedRetained:true,styleInvariant:true,systemReducedMotion:true,cleanup:true,frameQueue:"controlled",animations:"native WAAPI",dragFrameCoalescing};
  } finally {
    projection.close();root.remove();
    window.requestAnimationFrame=raf;window.cancelAnimationFrame=caf;window.matchMedia=match;
    if(before===undefined)delete document.documentElement.dataset.motionPreference;
    else document.documentElement.dataset.motionPreference=before;
  }
}

/** Real React hook, distinct synchronous event batches and controlled frames.
 * Count committed renders, not OS input rate, FPS or total CPU work. */
function exerciseUnifiedDragFrames(tick) {
  const assert = (v,m) => { if (!v) throw Error(m); };
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  let snapshot, renders = 0, moves = [], drops = [], cancelled = 0;
  const config = {
    taskId:"frame-fixture",
    onMove:(point) => moves.push(point.x),
    onDrop:(point) => drops.push(point.x),
    onCancel:() => cancelled++,
  };
  function Fixture() {
    const drag = useUnifiedDrag();
    snapshot = drag.snapshot;
    React.useLayoutEffect(() => { renders++; });
    return React.createElement("button",{onPointerDown:event=>drag.beginDrag(event,config)},"Drag");
  }
  const dispatch = (target,type,x,pointerId=41) => flushSync(() => {
    target.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerId,pointerType:"mouse",isPrimary:true,button:0,buttons:type==="pointerup"?0:1,clientX:x,clientY:10}));
  });
  const start = () => {
    dispatch(host.querySelector("button"),"pointerdown",10);
    dispatch(window,"pointermove",20);
    assert(snapshot?.pointer.x===20,"activation did not publish its first snapshot");
  };
  try {
    flushSync(()=>root.render(React.createElement(Fixture)));
    start();
    const initial = renders;
    for(let x=21;x<=60;x++) dispatch(window,"pointermove",x);
    assert(renders===initial,"pointer burst triggered visual renders before frame");
    assert(moves.length===41 && moves.at(-1)===60,"actual movement callbacks were coalesced");
    flushSync(tick);
    assert(renders===initial+1 && snapshot?.pointer.x===60,"frame did not publish latest position exactly once");
    dispatch(window,"pointermove",70);
    dispatch(window,"pointerup",85,42);
    assert(snapshot!==null && !drops.length,"different pointer completed the drag");
    dispatch(window,"pointerup",80);
    assert(snapshot===null && drops.length===1 && drops[0]===80,"drop did not use actual release coordinates");
    const afterDrop = renders;
    flushSync(tick);
    assert(snapshot===null && renders===afterDrop,"queued visual update survived drop");
    start();
    dispatch(window,"pointermove",30);
    dispatch(window,"pointercancel",32);
    flushSync(tick);
    assert(snapshot===null && cancelled===1 && drops.length===1,"cancel did not clear pending frame");
    start();
    dispatch(window,"pointermove",30);
    flushSync(()=>window.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape"})));
    flushSync(tick);
    assert(snapshot===null && cancelled===2,"Escape did not clear pending frame");
    start();
    dispatch(window,"pointermove",30);
    flushSync(()=>window.dispatchEvent(new Event("blur")));
    flushSync(tick);
    assert(snapshot===null && cancelled===3,"blur did not clear pending frame");
    return {pointerBurst:40,visualCommits:1,moveCallbacks:41,latestPoint:true,exactRelease:true,foreignPointerIgnored:true,cancellation:true};
  } finally {
    flushSync(()=>root.unmount());
    host.remove();
  }
}
