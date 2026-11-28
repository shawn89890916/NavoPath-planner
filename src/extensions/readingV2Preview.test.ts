import { describe, expect, it, vi } from "vitest";
import { activateV2, createV2Session, type V2HostAdapter } from "./runtimeV2";
import type { V2Capability, V2ContributionKind, V2ContributionMap, V2TaskGroup, V2MetricsProvider, V2StorageRead, V2StorageWrite, V2Json } from "./sdkV2";
import plugin, { createReadingController } from "../../plugin-previews/reading/main";
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

function migrationFixture(source: V2Json | undefined, initial: V2StorageRead = {status:"absent",revision:null}) {
  let remote=initial, legacy=source;
  const write=vi.fn(async (_key:string,command:V2StorageWrite) => {
    const revision=remote.status==="conflict"?remote.current.revision:"revision" in remote?remote.revision:null;
    if(command.expectedRevision!==revision || command.kind!=="set") return {status:"conflict" as const,current:remote};
    const next=String(Number(revision??0)+1);
    remote={status:"value",revision:next,value:command.value};
    return {status:"committed" as const,revision:next};
  });
  const readLegacy=vi.fn(async()=>{if(legacy===undefined)throw Error("Offline");return structuredClone(legacy);});
  const host:V2HostAdapter={
    owner:"official:reading",language:"en",platform:"desktop",supported:new Set(caps),granted:new Set(caps),isCurrent:()=>true,
    tasks:{list:async()=>[],execute:async()=>({status:"unavailable",message:"not needed"})},
    storage:{read:async()=>structuredClone(remote),readLegacy,write,subscribe:()=>()=>{}},
    activity:{query:async()=>({planned:[],actual:[]})},toast:vi.fn(),contribute:()=>()=>{}
  };
  const session=createV2Session({apiVersion:2,permissions:caps},host);
  const controller=createReadingController(session.context);
  return {controller,session,write,readLegacy,setLegacy:(value:V2Json)=>{legacy=value;}};
}
describe("Reading migration and conflict recovery",()=>{
  const original=JSON.parse(JSON.stringify({...library,taskLinks:[{taskId:"legacy-task",bookId:"book"}]})) as V2Json;
  it("copies existing books and links only on explicit import; never overwrites an initialized V2 library",async()=>{
    const f=migrationFixture(original);
    try{
      await f.controller.refresh();
      expect(f.controller.ready()).toBe(false);
      expect(f.controller.legacy?.taskLinks).toEqual([{taskId:"legacy-task",bookId:"book"}]);
      expect(f.write).not.toHaveBeenCalled();
      await f.controller.migrateLegacy();
      expect(f.write).toHaveBeenCalledWith("library-v2",expect.objectContaining({kind:"set",expectedRevision:null,value:original}),expect.anything());
      expect(f.controller.ready()).toBe(true);
      await expect(f.controller.migrateLegacy()).rejects.toThrow("Migration unavailable");
      expect(f.write).toHaveBeenCalledTimes(1);
    }finally{await f.session.close();}
  });
  it("does not treat unavailable or changed legacy data as a clean library",async()=>{
    const f=migrationFixture(undefined);
    try{
      await f.controller.refresh();
      expect(f.controller.ready()).toBe(false);
      f.setLegacy(original);await f.controller.refresh();f.setLegacy(null);
      await expect(f.controller.migrateLegacy()).rejects.toThrow("Legacy library changed");
      expect(f.write).not.toHaveBeenCalled();
    }finally{await f.session.close();}
  });
  it("requires an explicit choice and the current revision for durable conflicts",async()=>{
    const f=migrationFixture(null,{status:"conflict",current:{status:"value",revision:"4",value:original},rejected:{kind:"set",value:{version:1,books:[],taskLinks:[]},operationId:"failed",expectedRevision:"3"}});
    try{
      await f.controller.refresh();
      expect(f.controller.ready()).toBe(false);
      expect(f.write).not.toHaveBeenCalled();
      await f.controller.resolveConflict("remote");
      expect(f.write).toHaveBeenCalledWith("library-v2",expect.objectContaining({kind:"set",expectedRevision:"4",value:original}),expect.anything());
      expect(f.controller.ready()).toBe(true);
    }finally{await f.session.close();}
  });
});
