import { createDragProjection } from "../src/motion/dragProjection.ts";

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
    return {confirmedTargets:3,animationCreations:measuredCreations,legacyRestartCreations:8,unchangedRetained:true,styleInvariant:true,systemReducedMotion:true,cleanup:true,frameQueue:"controlled",animations:"native WAAPI"};
  } finally {
    projection.close();root.remove();
    window.requestAnimationFrame=raf;window.cancelAnimationFrame=caf;window.matchMedia=match;
    if(before===undefined)delete document.documentElement.dataset.motionPreference;
    else document.documentElement.dataset.motionPreference=before;
  }
}
