import type { PluginModuleV2, PluginContextV2, V2ActivityFacts, V2StorageRead, V2Json } from "../../integrations/navopath-plugin-api/v2";
import { createBook, updateBook, decodeReadingLibrary, groupReadingBooks, totals, sameReadingValue, undoReadingBookChange, type ReadingLibrary, type ReadingBook, type ReadingStatus, type ReadingProgress } from "./model";
const KEY = "library-v2";
export function createReadingController(ctx: PluginContextV2) {
  const tr = (zh:string,en:string) => ctx.language === "zh" ? zh : en;
  let snapshot: V2StorageRead = {status:"unavailable"}, library: ReadingLibrary | undefined, legacy: ReadingLibrary | null | undefined, busy=false, error="", generation=0;
  const listeners = new Set<()=>void>();
  const notify = () => { if (!ctx.signal.aborted) for(const fn of listeners) fn(); };
  const subscribe = (fn:()=>void) => { listeners.add(fn); return () => {listeners.delete(fn);}; };
  const ready = () => !busy && !error && !ctx.signal.aborted && !!library && (snapshot.status==="value" || (snapshot.status==="absent" && snapshot.revision===null && legacy===null));
  async function refresh() {
    const run=++generation;
    try {
      const next=await ctx.storage.read(KEY);
      const source=next.status==="absent" && next.revision===null ? await ctx.storage.readLegacy("library-v1") : null;
      if(ctx.signal.aborted || run!==generation) return;
      legacy=source===null?null:decodeReadingLibrary(source);
      const value=next.status==="conflict" ? next.current : next;
      library=value.status==="value" || value.status==="pending" ? decodeReadingLibrary(value.value) : value.status==="absent" ? decodeReadingLibrary(null) : undefined;
      snapshot=next; error="";
    } catch(e) { if(run===generation && !ctx.signal.aborted) {error=String(e);library=undefined;legacy=undefined;snapshot={status:"unavailable"};} }
    finally {if(run===generation) notify();}
  }
  async function mutate(fn:(value:ReadingLibrary)=>ReadingLibrary, expected?:ReadingLibrary) {
    if(!ready() || !library || (snapshot.status!=="value" && snapshot.status!=="absent")) throw Error(tr("书库暂不可编辑","Library is not writable"));
    if(expected && !sameReadingValue(expected,library)) throw Error(tr("书库已更新，请重新编辑","Library changed; reopen the editor"));
    const next=fn(library), expectedRevision=snapshot.revision; busy=true; notify();
    try {
      const result=await ctx.storage.write(KEY,{kind:"set",expectedRevision,operationId:crypto.randomUUID(),value:next as unknown as V2Json});
      await refresh();
      if(result.status==="conflict" || result.status==="unavailable") throw Error(tr("写入冲突或不可用","Write conflict or unavailable"));
      return next;
    } finally {busy=false;notify();}
  }
  async function migrateLegacy() {
    if(busy || ctx.signal.aborted || snapshot.status!=="absent" || snapshot.revision!==null || !legacy) throw Error("Migration unavailable");
    const source=legacy;busy=true;notify();
    try {
      const latest=decodeReadingLibrary(await ctx.storage.readLegacy("library-v1"));
      if(!sameReadingValue(source,latest)) throw Error(tr("旧书库已变化，请刷新后重新导入","Legacy library changed; refresh before importing"));
      const result=await ctx.storage.write(KEY,{kind:"set",expectedRevision:null,operationId:crypto.randomUUID(),value:source as unknown as V2Json});
      await refresh();
      if(result.status!=="committed" && result.status!=="pending") throw Error("Migration conflict");
    } finally {busy=false;notify();}
  }
  async function resolveConflict(choice:"remote"|"local") {
    if(busy || ctx.signal.aborted || snapshot.status!=="conflict") throw Error("No conflict to resolve");
    const original=snapshot;
    const selected=choice==="remote"?original.current:original.rejected;
    const isValue="value" in selected;
    if(isValue) decodeReadingLibrary(selected.value);
    busy=true;notify();
    try {
      const latest=await ctx.storage.read(KEY);
      if(!sameReadingValue(latest,original)) throw Error(tr("冲突已变化，请刷新","Conflict changed; refresh"));
      const command={expectedRevision:original.current.revision,operationId:crypto.randomUUID()};
      const result=await ctx.storage.write(KEY,isValue?{kind:"set",value:selected.value,...command}:{kind:"set",value:decodeReadingLibrary(null) as unknown as V2Json,...command});
      await refresh();
      if(result.status!=="committed" && result.status!=="pending") throw Error("Conflict resolution failed");
    }finally{busy=false;notify();}
  }
  async function undoBook(before:ReadingBook|undefined,after:ReadingBook) {
    const expected=library;
    if(!ready() || !expected) throw Error("Library unavailable");
    if(!before){
      const tasks=await ctx.tasks.list({entityIds:[after.id],includeCompleted:true});
      if(tasks.length) throw Error(tr("书籍已有阅读任务，无法撤销添加","Book already has linked tasks"));
      const facts=await ctx.activity.query({range:"all"});
      if((await ctx.tasks.resolveEntityLinks([...new Set([...facts.planned,...facts.actual].map(f=>f.taskId))],[after.id])).length) throw Error(tr("书籍已有阅读记录，无法撤销添加","Book already has reading history"));
    }
    return mutate(value=>undoReadingBookChange(value,before,after),expected);
  }
  async function links(ids:readonly string[], value=library) {
    if(!value || ctx.signal.aborted || !ids.length || !value.books.length) return [];
    return ctx.tasks.resolveEntityLinks([...new Set(ids)],value.books.map(b=>b.id));
  }
  async function membership(ids:readonly string[]) {
    const value=library; if(!value) return [];
    const candidates=new Set(ids);
    const linked=await links(ids,value);
    return [...new Set([...linked.map(l=>l.taskId),...value.taskLinks.map(l=>l.taskId)])].filter(id=>candidates.has(id));
  }
  const pendingTaskOps=new Map<string,string>();
  const runningTasks=new Set<string>();
  async function createTask(bookId:string) {
    if(!ready()) throw Error(tr("书库暂不可用","Library unavailable"));
    const book=library?.books.find(b=>b.id===bookId && b.status!=="finished");
    if(!book) throw Error("Book unavailable");
    if(runningTasks.has(bookId)) return;
    runningTasks.add(bookId);
    const operationId=pendingTaskOps.get(bookId) ?? crypto.randomUUID();pendingTaskOps.set(bookId,operationId);
    try {
      const result=await ctx.tasks.execute({kind:"create",operationId,entityId:bookId,title:tr("阅读 ","Read ")+book.title,estimateMinutes:30});
      if("message" in result) throw Error(result.message);
      pendingTaskOps.delete(bookId); notify();
    } finally {runningTasks.delete(bookId);}
  }
  async function summarize(facts:V2ActivityFacts) {
    const value=library; if(!value) return new Map<string,{planned:number;actual:number;weighted:number;hasWeighted:boolean}>();
    return totals(value,facts,await links([...facts.planned,...facts.actual].map(f=>f.taskId),value));
  }
  ctx.register(ctx.storage.subscribe(KEY,()=>{void refresh();}));
  ctx.register(()=>{generation++;listeners.clear();pendingTaskOps.clear();runningTasks.clear();});
  return {tr,refresh,subscribe,mutate,migrateLegacy,resolveConflict,undoBook,createTask,membership,summarize,ready,get library(){return library},get legacy(){return legacy},get conflict(){return snapshot.status==="conflict"?snapshot:undefined},get busy(){return busy},get state(){return snapshot.status},get error(){return error}};
}
type Controller=ReturnType<typeof createReadingController>;
function mountShelf(ctx:PluginContextV2,c:Controller,container:HTMLElement) {
  const doc=container.ownerDocument,root=doc.createElement("div");container.append(root);
  let disposed=false, editing=false, statsRun=0;
  let undo:{before?:ReadingBook;after:ReadingBook}|undefined;
  const tr=c.tr;
  function el<K extends keyof HTMLElementTagNameMap>(tag:K,text?:string,parent:HTMLElement=root) {
    const node=doc.createElement(tag); if(text!==undefined) node.textContent=text;parent.append(node);return node;
  }
  function button(label:string,action:()=>void,parent:HTMLElement=root) {const b=el("button",label,parent);b.type="button";b.className="ui-button ui-button--secondary";b.onclick=action;return b;}
  function report(e:unknown){if(!disposed && !ctx.signal.aborted) ctx.ui.toast(String(e));}
  function editor(book?:ReadingBook) {
    const before=c.library;if(!before || !c.ready()) return;
    editing=true;root.replaceChildren();
    el("h3",book?tr("编辑书籍","Edit book"):tr("添加书籍","Add book"));
    const form=el("form");form.style.display="grid";form.style.gap="12px";
    function input(label:string,value:string,type="text") {const l=el("label",label,form);const i=el("input",undefined,l);i.className="ui-input";i.type=type;i.value=value;return i;}
    function select(label:string,options:readonly [string,string][],value:string){const l=el("label",label,form);const s=el("select",undefined,l);s.className="ui-input";for(const [key,name] of options){const o=el("option",name,s);o.value=key;}s.value=value;return s;}
    const title=input(tr("书名","Title"),book?.title??"");title.required=true;title.maxLength=240;
    const author=input(tr("作者","Author"),book?.author??"");author.maxLength=240;
    const status=select(tr("状态","Status"),[["to-read",tr("准备读","To read")],["reading",tr("正在读","Reading")],["finished",tr("已读完","Finished")]],book?.status??"to-read");
    const unit=select(tr("进度单位","Progress unit"),[["percent","%"],["pages",tr("页","Pages")],["chapters",tr("章","Chapters")]],book?.progress.unit??"percent");
    const current=input(tr("当前进度","Current progress"),String(book?.progress.current??0),"number");current.min="0";current.step="any";current.required=true;
    const total=input(tr("总数（可选）","Total (optional)"),book?.progress.unit!=="percent" ? String(book?.progress.total??"") : "","number");total.min="1";total.step="1";
    const toggle=()=>{total.disabled=unit.value==="percent";current.max=unit.value==="percent"?"100":"";current.step=unit.value==="percent"?"any":"1";};unit.onchange=()=>{current.value="0";total.value="";toggle();};toggle();
    const save=el("button",tr("保存","Save"),form);save.type="submit";save.className="ui-button ui-button--primary";
    button(tr("取消","Cancel"),()=>{editing=false;render();},form);
    form.onsubmit=e=>{e.preventDefault();save.disabled=true;const now=new Date().toISOString(),id=book?.id??crypto.randomUUID();
      const progress:ReadingProgress=unit.value==="percent"?{unit:"percent",current:Number(current.value)}:{unit:unit.value as "pages"|"chapters",current:Number(current.value),...(total.value?{total:Number(total.value)}:{})};
      void c.mutate(value=>updateBook(book?value:createBook(value,{id,title:title.value,author:author.value,now}),id,{title:title.value,author:author.value,status:status.value as ReadingStatus,progress},now),before).then(saved=>{const after=saved.books.find(item=>item.id===id);if(after)undo={before:book,after};editing=false;render();}).catch(e=>{save.disabled=false;report(e);});
    };
  }
  function render(){
    if(disposed || ctx.signal.aborted || editing)return;const run=++statsRun;root.replaceChildren();
    el("h2",tr("阅读","Reading"));
    const state=c.state;
    if(state==="pending")el("p",tr("离线修改待同步；暂不可继续编辑。","Offline changes pending; editing paused."));
    if(state==="conflict" && c.conflict){
      const conflict=c.conflict;
      el("p",tr("存在同步冲突。请对照两个版本后选择保留哪一份完整书库。","Sync conflict. Compare the two versions before selecting a complete library."));
      for(const [label,value] of [[tr("远端版本","Remote version"),"value" in conflict.current?conflict.current.value:null],[tr("本机修改","Local changes"),"value" in conflict.rejected?conflict.rejected.value:null]] as const){
        const details=el("details");el("summary",label,details);
        try{for(const book of decodeReadingLibrary(value).books)el("p",book.title+" · "+book.status+" · "+JSON.stringify(book.progress),details);}catch{el("p",tr("数据格式无效","Invalid data"),details);}
        const raw=el("pre",JSON.stringify(value,null,2),details);raw.style.whiteSpace="pre-wrap";raw.style.overflowWrap="anywhere";
      }
      for(const [choice,label] of [["remote",tr("保留远端书库","Keep remote library")],["local",tr("保留本机书库","Keep local library")]] as const){
        const confirm=el("details");el("summary",label,confirm);el("p",tr("另一版本的修改将被替换。请先复制需要保留的数据。","The other version's edits will be replaced. Copy anything you need first."),confirm);
        button(tr("确认选择","Confirm choice"),()=>{void c.resolveConflict(choice).catch(report);},confirm).disabled=c.busy;
      }
    }
    if(c.legacy && state==="absent"){
      el("p",tr("检测到旧书库：","Legacy library found: ")+c.legacy.books.length+tr(" 本书、"," books, ")+c.legacy.taskLinks.length+tr(" 条任务关联。旧客户端需停止修改阅读数据。"," linked tasks. Stop editing Reading on old clients."));
      button(tr("导入旧书库（保留原数据）","Import legacy library (keep original)"),()=>{void c.migrateLegacy().catch(report);}).disabled=c.busy;
    }
    if(state==="unavailable" || c.error)el("p",tr("书库暂不可用。","Library unavailable."));
    button(tr("刷新","Refresh"),()=>{void c.refresh();});
    button(tr("添加书籍","Add book"),()=>editor()).disabled=!c.ready();
    if(undo)button(tr("撤销上次书籍修改","Undo last book change"),()=>{const change=undo;if(change)void c.undoBook(change.before,change.after).then(()=>{undo=undefined;render();}).catch(report);}).disabled=!c.ready();
    if(!c.library)return;
    const groups=groupReadingBooks(c.library),metrics=new Map<string,HTMLElement>();
    for(const [key,label] of [["to-read",tr("准备读","To read")],["reading",tr("正在读","Reading")],["finished",tr("已读完","Finished")]] as const){
      el("h3",label);for(const book of groups[key]){
        const row=el("section");row.style.padding="12px 0";row.style.borderBottom="1px solid var(--rule, currentColor)";
        el("strong",book.title,row);el("p",book.author,row);el("p",book.progress.current+(book.progress.unit==="percent"?"%":book.progress.total?"/"+book.progress.total:"")+" "+(book.progress.unit==="percent"?"":book.progress.unit),row);
        const m=el("p",tr("读取统计…","Loading statistics…"),row);metrics.set(book.id,m);
        button(tr("编辑","Edit"),()=>editor(book),row).disabled=!c.ready();
        if(book.status!=="finished")button(tr("添加阅读任务","Add reading task"),()=>{void c.createTask(book.id).catch(report);},row).disabled=!c.ready();
      }
    }
    void ctx.activity.query({range:"all"}).then(f=>c.summarize(f)).then(rows=>{
      if(disposed||ctx.signal.aborted||run!==statsRun)return;
      for(const [id,node] of metrics){const t=rows.get(id);node.textContent=tr("计划 ","Planned ")+Math.round(t?.planned??0)+tr(" 分钟 · 实际 "," min · Actual ")+Math.round(t?.actual??0)+tr(" 分钟"," min")+(t?.hasWeighted?tr(" · 加权 "," · Weighted ")+Math.round(t.weighted)+tr(" 分钟"," min"):"");}
    }).catch(()=>{if(run===statsRun&&!disposed)for(const node of metrics.values())node.textContent=tr("统计暂不可用","Statistics unavailable");});
  }
  const unsubscribe=c.subscribe(render);render();void c.refresh();
  return ()=>{disposed=true;unsubscribe();root.remove();};
}
const plugin:PluginModuleV2={onload(ctx){
  const c=createReadingController(ctx),tr=c.tr;
  ctx.ui.registerWorkspacePage({id:"books",name:tr("阅读","Reading"),mount:container=>mountShelf(ctx,c,container)});
  ctx.ui.registerTaskGroup({id:"reading",name:tr("阅读","Reading"),resolve:ids=>c.membership(ids),subscribe:c.subscribe,actions:[{id:"create",label:tr("添加阅读任务","Add reading task"),input:"select"}],choices:()=>c.ready()?(c.library?.books??[]).filter(b=>b.status!=="finished").map(b=>({value:b.id,label:b.title})):[],invoke:async(id,value)=>{if(id==="create"&&value)await c.createTask(value);}});
  ctx.metrics.registerProvider({id:"reading",name:tr("阅读","Reading"),subscribe:c.subscribe,query:async facts=>{
    const rows=await c.summarize(facts);let planned=0,actual=0,weighted=0,hasWeighted=false;
    for(const row of rows.values()){planned+=row.planned;actual+=row.actual;weighted+=row.weighted;hasWeighted||=row.hasWeighted;}
    return [{label:tr("计划阅读","Planned reading"),value:planned,unit:"min"},{label:tr("实际阅读","Actual reading"),value:actual,unit:"min"},...(hasWeighted?[{label:tr("加权阅读","Weighted reading"),value:weighted,unit:"min"}]:[])];
  }});void c.refresh();
}};
export default plugin;
