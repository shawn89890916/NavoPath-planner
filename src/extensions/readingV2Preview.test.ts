import { describe, expect, it, vi } from "vitest";
import { activateV2, type V2HostAdapter } from "./runtimeV2";
import type { V2Capability, V2ContributionKind, V2ContributionMap, V2TaskGroup, V2MetricsProvider } from "./sdkV2";
import plugin from "../../plugin-previews/reading/main";
import { createBook, emptyReadingLibrary, totals } from "../../plugin-previews/reading/model";
const caps: V2Capability[]=["tasks.read","tasks.write","activity.read","storage.read","storage.write","ui.tasksGroup","ui.workspace","ui.toast","metrics.provider"];
const library=createBook(emptyReadingLibrary(),{id:"book",title:"Book",now:"2026-11-28T00:00:00Z"});
describe("independent Reading v2 candidate",()=>{
  it("registers public contributions and creates linked core tasks; metrics reuse retained facts",async()=>{
    const contributions=new Map<string,V2ContributionMap[V2ContributionKind]>();
    const execute=vi.fn(async()=>({status:"accepted" as const,task:{id:"task",title:"Read Book",completed:false}}));
    const off=vi.fn();
    const host:V2HostAdapter={
      owner:"official:reading",language:"en",platform:"desktop",supported:new Set(caps),granted:new Set(caps),isCurrent:()=>true,
      tasks:{list:async()=>[],execute,resolveEntityLinks:async ids=>ids.includes("task")?[{taskId:"task",entityId:"book"}]:[]},
      storage:{read:async()=>({status:"value",revision:"1",value:JSON.parse(JSON.stringify(library))}),write:async()=>({status:"unavailable"}),subscribe:()=>off},
      activity:{query:async()=>({planned:[],actual:[]})},toast:vi.fn(),
      contribute:(_kind,id,value)=>{contributions.set(id,value);return()=>{contributions.delete(id);};}
    };
    const loaded=await activateV2(plugin,{apiVersion:2,permissions:caps},host);
    try {
      const group=contributions.get("official:reading:ui.tasksGroup:reading") as V2TaskGroup;
      const metrics=contributions.get("official:reading:metrics.provider:reading") as V2MetricsProvider;
      await vi.waitFor(async()=>expect(await group.choices?.("create")).toEqual([{value:"book",label:"Book"}]));
      await group.invoke?.("create","book");
      expect(execute).toHaveBeenCalledWith(expect.objectContaining({kind:"create",entityId:"book",title:"Read Book"}),expect.anything());
      expect(await group.resolve(["task","unrelated"])).toEqual(["task"]);
      expect(await metrics.query({planned:[],actual:[{id:"entry",taskId:"task",start:"2026-11-28T00:00:00Z",end:"2026-11-28T00:30:00Z",minutes:30,weightedMinutes:24}]})).toEqual([{label:"Planned reading",value:0,unit:"min"},{label:"Actual reading",value:30,unit:"min"},{label:"Weighted reading",value:24,unit:"min"}]);
    }finally{await loaded.dispose();}
    expect(contributions.size).toBe(0);expect(off).toHaveBeenCalledTimes(1);
  });
  it("preserves legacy attribution and never counts duplicate facts twice",()=>{
    const fact={id:"entry",taskId:"old",start:"2026-11-28T00:00:00Z",end:"2026-11-28T00:30:00Z",minutes:30};
    expect(totals({...library,taskLinks:[{taskId:"old",bookId:"book"}]},{planned:[],actual:[fact,fact]},[]).get("book")).toEqual({planned:0,actual:30,weighted:0,hasWeighted:false});
  });
});
