import {createBook,type ReadingBook,type ReadingLibrary,type ReadingWeReadSource} from "./model";
import type {WeReadItem,WeReadProgress} from "./wereadConnection";
export type WeReadChoice={item:WeReadItem;localId?:string};
const identity=(item:WeReadItem)=>item.kind+":"+item.id;
export const sourceKey=identity;
export function sourceMatches(book:ReadingBook,connectionId:string,item:WeReadItem){
  return book.weread?.connectionId===connectionId&&book.weread.externalId===item.id&&book.weread.kind===item.kind;
}
export function suggestedBook(library:ReadingLibrary,item:WeReadItem){
  const normalize=(s:string)=>s.normalize("NFKC").trim().toLowerCase();
  const matches=library.books.filter(b=>normalize(b.title)===normalize(item.title)&&normalize(b.author)===normalize(item.author));
  return matches.length===1?matches[0]:undefined;
}
function updateSource(book:ReadingBook,connectionId:string,item:WeReadItem,now:string,managed:boolean){
  const prior=sourceMatches(book,connectionId,item)?book.weread:undefined;
  const source:ReadingWeReadSource={...prior,connectionId,externalId:item.id,kind:item.kind,managed,
    private:item.private,cover:item.cover??prior?.cover,readerLink:item.readerLink??prior?.readerLink,recent:item.recent??prior?.recent,finished:item.kind==="book"?item.finished:undefined,checkedAt:prior?.checkedAt??now};
  // Shelf completion is explicit; missing progress is never treated as a measured 0%.
  let status=book.status;
  if(managed&&item.kind==="book"){
    if(item.finished)status="finished";
    else if(status!=="finished"&&item.recent&&item.recent>0)status="reading";
  }
  const next={...book,status,weread:source};
  return JSON.stringify(next)===JSON.stringify(book)?book:{...next,updatedAt:now};
}
/** Explicit import/relink. Existing IDs and task links are immutable. */
export function importWeRead(library:ReadingLibrary,connectionId:string,choices:WeReadChoice[],now:string):ReadingLibrary{
  let next=library;
  const seen=new Set<string>(),targets=new Set<string>();
  for(const {item,localId} of choices){
    const key=identity(item);if(seen.has(key))continue;seen.add(key);
    const linked=next.books.find(b=>sourceMatches(b,connectionId,item));
    if(linked&&localId&&linked.id!==localId)throw Error("Already linked");
    const id=linked?.id??localId??"weread:"+connectionId+":"+key;
    if(targets.has(id))throw Error("Duplicate target");targets.add(id);
    let book=next.books.find(b=>b.id===id);
    if(!book){if(localId)throw Error("Book changed");next=createBook(next,{id,title:item.title,author:item.author,now});book=next.books.find(b=>b.id===id)!;}
    if(book.weread&&book.weread.connectionId===connectionId&&!sourceMatches(book,connectionId,item))throw Error("Book already linked");
    const updated=updateSource(book,connectionId,item,now,book.weread?.managed??!localId);
    if(updated!==book)next={...next,books:next.books.map(b=>b.id===id?updated:b)};
  }
  return next;
}
export function syncWeReadShelf(library:ReadingLibrary,connectionId:string,items:WeReadItem[],now:string):ReadingLibrary{
  const byKey=new Map(items.map(item=>[identity(item),item]));
  let changed=false;
  const books=library.books.map(book=>{
    const source=book.weread;
    if(!source||source.connectionId!==connectionId)return book;
    const item=byKey.get(source.kind+":"+source.externalId);if(!item)return book;
    const next=updateSource(book,connectionId,item,now,source.managed);changed ||= next!==book;return next;
  });
  let next=changed?{...library,books}:library;
  if(library.wereadPreferences?.autoImport&&library.wereadPreferences.connectionId===connectionId){
    const previous=library.wereadPreferences.seenKeys;
    const seen=new Set(previous??items.map(identity));
    const choices=items.filter(item=>!item.private&&!seen.has(identity(item))&&!next.books.some(book=>sourceMatches(book,connectionId,item))&&!suggestedBook(next,item)).map(item=>({item}));
    next=importWeRead(next,connectionId,choices,now);
    const seenKeys=[...new Set([...seen,...items.map(identity)])].sort();
    if(JSON.stringify(seenKeys)!==JSON.stringify(previous))next={...next,wereadPreferences:{...library.wereadPreferences,seenKeys}};

  }
  return next;
}
export function applyWeReadProgress(library:ReadingLibrary,connectionId:string,progress:WeReadProgress,now:string):ReadingLibrary{
  const book=library.books.find(b=>b.weread?.connectionId===connectionId&&b.weread.kind==="book"&&b.weread.externalId===progress.id);
  if(!book?.weread)return library;
  const source=book.weread;
  if(source.percent!==undefined&&source.recent!==undefined&&progress.recent!==undefined&&progress.recent<source.recent)return library;
  const nextSource={...source,percent:progress.percent,seconds:progress.seconds??source.seconds,recent:progress.recent??source.recent,finished:progress.finished};
  let next:ReadingBook={...book,weread:nextSource};
  if(source.managed){
    next={...next,progress:{unit:"percent",current:progress.percent},status:progress.finished?"finished":progress.started?"reading":"to-read"};
  }
  if(JSON.stringify(next)===JSON.stringify(book))return library;
  return {...library,books:library.books.map(b=>b.id===book.id?{...next,updatedAt:now,weread:{...nextSource,checkedAt:now}}:b)};
}
export function recentLinkedItems(library:ReadingLibrary,connectionId:string,items:WeReadItem[]){
  return items.filter(item=>item.kind==="book"&&library.books.some(book=>sourceMatches(book,connectionId,item)))
    .sort((a,b)=>(b.recent??0)-(a.recent??0)).slice(0,5);
}
