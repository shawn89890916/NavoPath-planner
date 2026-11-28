import {describe,it,expect} from "vitest";
import {createBook,emptyReadingLibrary,linkReadingTask,decodeReadingLibrary,updateBook} from "./model";
import {importWeRead,syncWeReadShelf,applyWeReadProgress,recentLinkedItems,suggestedBook} from "./wereadSync";
import type {WeReadItem} from "./wereadConnection";
const now="2026-11-28T08:00:00Z",later="2026-11-28T09:00:00Z";
const item=(id:string,extra:Partial<WeReadItem>={}):WeReadItem=>({id,kind:"book",title:"Book "+id,author:"Author",private:false,finished:false,...extra});
describe("WeRead source synchronization",()=>{
 it("imports idempotently and preserves core task IDs and manual book progress",()=>{
   const initial=linkReadingTask(updateBook(createBook(emptyReadingLibrary(),{id:"local",title:"Book a",author:"Author",now}),"local",{status:"reading",progress:{unit:"pages",current:42}},now),"local","task");
   expect(suggestedBook(initial,item("a"))?.id).toBe("local");
   const imported=importWeRead(initial,"conn",[{item:item("a"),localId:"local"},{item:item("b")}],now);
   expect(importWeRead(imported,"conn",[{item:item("a")},{item:item("b")}],now)).toBe(imported);
   const next=applyWeReadProgress(imported,"conn",{id:"a",percent:1,seconds:60,finished:false,started:true},later);
   expect(next.books[0].progress).toEqual({unit:"pages",current:42});
   expect(next.books[0].weread?.percent).toBe(1);expect(next.taskLinks).toEqual(initial.taskLinks);
   expect(decodeReadingLibrary(JSON.parse(JSON.stringify(next)))).toEqual(JSON.parse(JSON.stringify(next)));
 });
 it("updates imported progress and explicit completion, rejects other credentials, preserves missing books",()=>{
   const imported=importWeRead(emptyReadingLibrary(),"conn",[{item:item("a",{recent:1})}],now);
   const progress={id:"a",percent:1,seconds:3600,recent:2,finished:false,started:true};
   expect(applyWeReadProgress(imported,"other",progress,later)).toBe(imported);
   const next=applyWeReadProgress(imported,"conn",progress,later);
   expect(next.books[0]).toMatchObject({progress:{unit:"percent",current:1},status:"reading",weread:{seconds:3600}});
   const finished=applyWeReadProgress(next,"conn",{...progress,percent:100,finished:true},later);expect(finished.books[0].status).toBe("finished");
   expect(syncWeReadShelf(finished,"conn",[],later)).toBe(finished);
   const edited=updateBook(next,next.books[0].id,{progress:{unit:"pages",current:10}},later);
   expect(edited.books[0].weread?.managed).toBe(false);
 });
 it("auto-imports only unseen public items, excludes existing matches and private books",()=>{
   const initial={...createBook(emptyReadingLibrary(),{id:"local",title:"Book c",author:"Author",now}),wereadPreferences:{connectionId:"conn",autoImport:true,seenKeys:["book:old"]}};
   const shelf=[item("old"),item("new"),item("secret",{private:true}),item("c")];
   const next=syncWeReadShelf(initial,"conn",shelf,later);
   expect(next.books.map(b=>b.title)).toEqual(["Book c","Book new"]);
   expect(syncWeReadShelf(next,"conn",shelf,later)).toBe(next);
   expect(syncWeReadShelf(next,"different",shelf,later)).toBe(next);
   expect(recentLinkedItems(next,"conn",shelf).map(b=>b.id)).toEqual(["new"]);
 });
 it("requires explicit relink and retains identity across credentials",()=>{
   const initial=importWeRead(emptyReadingLibrary(),"old",[{item:item("a")}],now);
   const id=initial.books[0].id;
   const linked=linkReadingTask(initial,id,"t");
   const next=importWeRead(linked,"new",[{item:item("a"),localId:id}],later);
   expect(next.books[0].id).toBe(id);expect(next.books[0].weread?.connectionId).toBe("new");expect(next.taskLinks).toEqual(linked.taskLinks);
 });
});