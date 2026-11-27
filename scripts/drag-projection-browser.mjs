import { createDragProjection } from "../src/motion/dragProjection.ts";

export async function exerciseDragProjection() {
  const assert = (v,m) => { if (!v) throw Error(m); };
  const tick = () => new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
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
    assert(created===2,"initial projection expected two animations, got "+created);
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
    document.documentElement.dataset.motionPreference="off";
    window.dispatchEvent(new Event("resize"));await tick();
    assert(rows.every(row=>row.getAnimations().length===0),"motion off did not clear animations");
    return {confirmedTargets:3,animationCreations:created,legacyRestartCreations:8,unchangedRetained:true,styleInvariant:true,cleanup:true};
  } finally {
    projection.close();root.remove();
    if(before===undefined)delete document.documentElement.dataset.motionPreference;
    else document.documentElement.dataset.motionPreference=before;
  }
}
