import { ExtensionService } from "../src/extensions/serviceCore.ts";
import { defaultExtensionPreferences, sha256 } from "../src/extensions/packages.ts";
import { executePluginTask } from "../src/extensions/pluginTaskCommands.ts";
import { cachePut, cacheGet } from "../src/extensions/cache.ts";

const assert=(value,message)=>{if(!value)throw Error(message);};
const wait=async(fn,message)=>{for(let i=0;i<200;i++){const result=await fn();if(result)return result;await new Promise(r=>setTimeout(r,25));}throw Error(message);};
const key="official:reading", legacyKey="account:preview:value:official:reading:library-v1";
const now="2026-11-28T09:00:00.000Z";
const book={id:"old-book",title:"Existing book",author:"",status:"reading",progress:{unit:"percent",current:20},createdAt:now,updatedAt:now};
const legacy={version:1,books:[book],taskLinks:[]};
export async function exercisePluginV2(){
  const fixture=await (await fetch("/__plugin_v2_fixture")).json();
  const entry=fixture.catalog.packages[0];
  const original=fixture.artifacts[0].data;
  const nativeFetch=window.fetch.bind(window);
  const packages=new Map([[entry.downloadUrl,original]]);
  let catalog=fixture.catalog;
  // Only the test's isolated loopback artifact simulates the remote official endpoint.
  window.fetch=async(input,options)=>{
    const url=new URL(typeof input==="string"?input:input instanceof URL?input.href:input.url,location.href);
    if(url.origin==="https://navopath.com"&&url.pathname==="/extensions-preview/catalog-v2.json")return new Response(JSON.stringify(catalog));
    if(packages.has(url.href))return new Response(packages.get(url.href));
    if(url.origin==="https://navopath.com"&&url.pathname==="/extensions/catalog.json")return new Response(JSON.stringify({version:1,packages:[]}));
    if(url.origin===location.origin)return nativeFetch(input,options);
    throw Error("External request disabled in plugin fixture");
  };
  let settings={language:"en",dayStartTime:"00:00",extensions:{...defaultExtensionPreferences(),autoCheckUpdates:false,migratedLegacy:true,migratedPlanningViews:true,migratedShelfViews:true,migratedNativeFeatures:true,migratedDesktopWidget:true,migratedCloudDriveSync:true},extensionConfigs:{}};
  let data={version:1,importedSeedVersion:"",generatedAt:"",goals:[],projects:[],tasks:[],longTasks:[],events:[],notes:[],drafts:[],chat:[],aiMemories:[],timeEntries:[]};
  let account=null;
  const host={getData:()=>data,saveData:async next=>{data=next;},getSettings:()=>settings,saveSettings:async patch=>{settings={...settings,...patch};},toast:()=>{},getAccountId:()=>account,internal:{},
    executePluginTask:(owner,command,active)=>executePluginTask(owner,command,{active,current:()=>data,now:()=>now,today:()=>"2026-11-28",save:async next=>{data=next;}})};
  const service=new ExtensionService(),container=document.createElement("div");
  document.body.append(container);
  const snap=()=>service.getSnapshot();
  const view=()=>snap().views.find(v=>v.owner===key);
  const group=()=>snap().taskGroups?.find(v=>v.owner===key);
  const metrics=()=>snap().metricsProviders?.find(v=>v.owner===key);
  const button=text=>[...container.querySelectorAll("button")].find(b=>b.textContent===text&&!b.disabled);
  let cleanup;
  async function mount(){cleanup=await view().mount(container);}
  async function unmount(){await cleanup?.();cleanup=undefined;}
  async function packageVersion(version,broken=false){
    const pkg=JSON.parse(original);pkg.manifest.version=version;
    if(broken)pkg.files[pkg.manifest.main].data="export default {onload(){throw Error('Fixture activation failure')}};";
    const bytes=JSON.stringify(pkg,null,2)+"\n",hash=await sha256(new TextEncoder().encode(bytes));
    const url="https://navopath.com/extensions-preview/packages-v2/reading-"+version+"-"+hash+".navopackage.json";
    packages.set(url,bytes);catalog={version:2,packages:[{manifest:pkg.manifest,sha256:hash,downloadUrl:url}]};
  }
  try{
    await cachePut(legacyKey,legacy);
    await service.configure(host);await service.refreshCatalog();
    const candidate=snap().catalog.find(e=>e.manifest.id==="reading");
    assert(candidate?.manifest.apiVersion===2&&candidate.sha256===entry.sha256,"Independent package missing");
    await service.install(candidate);assert(!view(),"Install must not implicitly enable");
    await service.toggle(key,true);
    assert(view()&&group()&&metrics(),"Actual package must register all contributions: "+snap().status[key]);
    assert(!snap().nativeFeatures?.includes("reading"),"V2 must not enable native Reading");
    await mount();
    (await wait(()=>button("Import legacy library (keep original)"),"Import action missing")).click();
    await wait(async()=> (await group().choices("create")).some(o=>o.value===book.id),"Legacy book not imported");
    assert(JSON.stringify(await cacheGet(legacyKey))===JSON.stringify(legacy),"V1 source modified");
    (await wait(()=>button("Add book"),"Add book disabled")).click();
    const title=container.querySelector("input");title.value="New book";
    container.querySelector("form").requestSubmit();
    const newChoice=await wait(async()=> (await group().choices("create")).find(o=>o.label==="New book"),"Book edit did not persist");
    await group().invoke("create",newChoice.value);
    assert(data.tasks.length===1&&data.tasks[0].title==="Read New book","Core task creation failed");
    assert((await group().resolve(data.tasks.map(t=>t.id))).length===1,"Task association missing");
    const taskId=data.tasks[0].id;
    const actual=[{id:"record",taskId,start:now,end:"2026-11-28T09:30:00.000Z",minutes:30,weightedMinutes:24}];
    assert((await metrics().query({planned:[],actual})).some(r=>r.label==="Actual reading"&&r.value===30),"Metrics contribution did not attribute time");
    await unmount();
    // A synthetic later manifest packages the same built code. Exercise actual update and rollback mechanics.
    await packageVersion("2.0.1");await service.checkUpdates();
    assert(snap().updates[key]?.manifest.version==="2.0.1","Independent update not discovered");
    await service.update(key);
    assert(snap().preferences.installed[key].manifest.version==="2.0.1"&&view(),"Update failed");
    await wait(async()=> (await group().choices("create")).some(o=>o.value===newChoice.value),"Update lost library");
    await packageVersion("2.0.2",true);await service.checkUpdates();
    let failed=false;try{await service.update(key);}catch{failed=true;}
    assert(failed&&snap().preferences.installed[key].manifest.version==="2.0.1"&&view(),"Failed update must restore previous package");
    await service.rollback(key);
    assert(snap().preferences.installed[key].manifest.version==="2.0.0"&&view(),"Rollback failed");
    await mount();await service.toggle(key,false);
    assert(!view()&&!group()&&!metrics()&&!container.children.length,"Disable leaked contributions or mounted DOM");
    cleanup=undefined;
    await service.toggle(key,true);await wait(async()=> (await group().choices("create")).some(o=>o.value===newChoice.value),"Re-enable lost data");
    await service.uninstall(key);assert(!view()&&!snap().preferences.installed[key]&&data.tasks.length===1,"Uninstall lost core task or leaked contribution");
    catalog=fixture.catalog;await service.refreshCatalog();await service.install(snap().catalog.find(e=>e.manifest.id==="reading"));await service.toggle(key,true);
    await wait(async()=> (await group().choices("create")).some(o=>o.value===newChoice.value),"Reinstall lost data");
    assert((await group().resolve([taskId]))[0]===taskId,"Reinstall lost task association");
    await service.configure(null);
    assert(!view()&&!group()&&!metrics(),"Workspace shutdown leaked contributions");
    return {actualBundle:true,legacyImport:true,bookEdit:true,coreTask:true,metrics:true,update:true,failedUpdateRecovery:true,rollback:true,disable:true,uninstall:true,reinstall:true};
  }finally{await unmount();await service.configure(null);container.remove();window.fetch=nativeFetch;}
}
