const fs=require("node:fs");
const path=require("node:path");
const {createHash,randomUUID}=require("node:crypto");
const GATEWAY="https://i.weread.qq.com/api/agent/gateway";
const MAX_BYTES=8*1024*1024;
const validKey=key=>typeof key==="string"&&/^wrk-[A-Za-z0-9_-]{4,512}$/.test(key);
const fail=code=>({ok:false,code});
const obj=value=>value!==null&&typeof value==="object"&&!Array.isArray(value);
function createWeReadConnection({directory,safeStorage,fetchImpl=fetch,now=()=>new Date().toISOString()}){
  const locks=new Set();
  const file=scope=>{
    if(typeof scope!=="string"||!(scope==="preview"||/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(scope)))throw Error("Invalid account");
    return path.join(directory,"weread-"+createHash("sha256").update(scope).digest("hex")+".enc");
  };
  const secure=()=>safeStorage.isEncryptionAvailable()&&safeStorage.getSelectedStorageBackend?.()!=="basic_text";
  function read(filePath){
    if(!fs.existsSync(filePath))return null;
    if(!secure()||fs.statSync(filePath).size>16384)throw Error("Storage unavailable");
    const raw=safeStorage.decryptString(fs.readFileSync(filePath));
    if(!validKey(raw))throw Error("Storage unavailable");
    return raw;
  }
  function save(filePath,value){
    if(!secure())throw Error("Storage unavailable");
    fs.mkdirSync(directory,{recursive:true});
    const temp=filePath+"."+randomUUID()+".tmp";
    try{fs.writeFileSync(temp,safeStorage.encryptString(value),{mode:0o600});fs.renameSync(temp,filePath);}
    finally{try{fs.unlinkSync(temp);}catch{}}
  }
  function credential(filePath,key){
    const idPath=filePath+".identity",check=createHash("sha256").update(key).digest("hex");
    try{
      if(fs.statSync(idPath).size<=16384){
        const saved=JSON.parse(safeStorage.decryptString(fs.readFileSync(idPath)));
        if(saved.check===check&&typeof saved.id==="string"&&/^[0-9a-f-]{36}$/i.test(saved.id))return {key,id:saved.id};
      }
    }catch{}
    const id=randomUUID();save(idPath,JSON.stringify({check,id}));return {key,id};
  }
  async function request(key,api,params={}){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
    try{
      const response=await fetchImpl(GATEWAY,{method:"POST",headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({api_name:api,skill_version:"1.0.6",...params}),redirect:"error",signal:controller.signal});
      if(response.status===401||response.status===403)return fail("auth");
      if(response.status===429)return fail("rate-limit");
      if(!response.ok||!response.body)return fail("network");
      if(Number(response.headers.get("content-length"))>MAX_BYTES)return fail("response");
      const reader=response.body.getReader();let total=0;const chunks=[];
      try{while(true){const {value,done}=await reader.read();if(done)break;total+=value.byteLength;if(total>MAX_BYTES){await reader.cancel();return fail("response");}chunks.push(Buffer.from(value));}}
      finally{reader.releaseLock();}
      let data;try{data=JSON.parse(Buffer.concat(chunks).toString("utf8"));}catch{return fail("response");}
      if(!obj(data))return fail("response");
      const upgradeNotice=Boolean(data.upgrade_info);
      if(data.errcode!==undefined&&data.errcode!==0)return fail("api");
      return {ok:true,data,upgradeNotice};
    }catch{return fail("network");}finally{clearTimeout(timer);}
  }
  const idOk=value=>typeof value==="string"&&value.length>0&&value.length<=160;
  const str=(value,max=240)=>typeof value==="string"?value.trim().slice(0,max):"";
  const seconds=value=>Number.isSafeInteger(value)&&value>=0?value:undefined;
  const url=(value,cover=false)=>{
    if(typeof value!=="string"||value.length>2048)return undefined;
    try{const u=new URL(value);if(u.protocol!=="https:"||u.username||u.password||u.port)return undefined;
      const host=u.hostname.toLowerCase();
      return (cover?(host.endsWith(".qq.com")||host.endsWith(".qpic.cn")||host.endsWith(".myqcloud.com")):(host==="weread.qq.com"||host==="i.weread.qq.com"))?u.href:undefined;
    }catch{return undefined;}
  };
  function shelfItems(data){
    const seen=new Set(),items=[];
    const add=(raw,kind)=>{
      const source=kind==="book"?raw:raw?.albumInfo,extra=kind==="book"?raw:raw?.albumInfoExtra;
      const id=kind==="book"?source?.bookId:source?.albumId;
      const title=str(kind==="book"?source?.title:source?.name);
      if(!idOk(id)||!title||seen.has(kind+":"+id))return;
      seen.add(kind+":"+id);
      items.push({id,kind,title,author:str(kind==="book"?source?.author:source?.authorName),
        cover:url(source?.cover,true),readerLink:url(source?.readerLink)||url(source?.deepLink),
        private:extra?.secret!==0,finished:kind==="book"&&source?.finishReading===1,
        recent:seconds(kind==="book"?source?.readUpdateTime:extra?.lectureReadUpdateTime)});
    };
    for(const raw of data.books)add(raw,"book");
    for(const raw of data.albums)add(raw,"audio");
    return items;
  }
  async function verify(key,includeShelf=false){
    const result=await request(key,"/shelf/sync");
    if(!result.ok)return result;
    const {books,albums,mp}=result.data;
    if(!Array.isArray(books)||!Array.isArray(albums))return fail("response");
    const counts={books:books.length,audiobooks:albums.length,articles:obj(mp)&&Object.keys(mp).length?1:0};
    // Only explicit shelf reads expose allowlisted display fields. Never return a raw gateway response.
    if(includeShelf&&books.length+albums.length>5000)return fail("response");
    return {ok:true,connected:true,checkedAt:now(),counts,upgradeNotice:result.upgradeNotice,...(includeShelf?{shelf:shelfItems(result.data)}:{})};
  }
  async function progress(credential,bookId){
    if(!idOk(bookId))return fail("format");
    const result=await request(credential.key,"/book/getprogress",{bookId});
    if(!result.ok)return result;
    const data=result.data,book=data.book;
    if(data.bookId!==bookId||!obj(book)||!Number.isInteger(book.progress)||book.progress<0||book.progress>100)return fail("response");
    return {ok:true,connected:true,checkedAt:now(),connectionId:credential.id,progress:{
      id:bookId,percent:book.progress,seconds:seconds(book.recordReadingTime),recent:seconds(book.updateTime),
      finished:book.progress===100&&!!seconds(book.finishTime),started:book.isStartReading===1||book.isStartReading===true||book.progress>0
    }};
  }
  async function statistics(credential,period="weekly"){
    if(!["weekly","monthly","annually","overall","lastWeek"].includes(period))return fail("format");
    const mode=period==="lastWeek"?"weekly":period;
    const baseTime=period==="lastWeek"?Math.floor(Date.now()/1000)-7*86400:0;
    const result=await request(credential.key,"/readdata/detail",{mode,baseTime});
    if(!result.ok)return result;
    const data=result.data,total=seconds(data.totalReadTime),base=mode==="overall"?0:seconds(data.baseTime);
    if(total===undefined||base===undefined)return fail("response");
    const days=Object.entries(obj(data.readTimes)?data.readTimes:{}).flatMap(([key,value])=>{
      const day=Number(key),duration=seconds(value);
      return Number.isSafeInteger(day)&&(mode==="overall"||day>=base)&&duration!==undefined?[{day,seconds:duration}]:[];
    }).sort((a,b)=>a.day-b.day).slice(0,mode==="weekly"?7:mode==="monthly"?31:mode==="annually"?12:100);
    return {ok:true,connected:true,checkedAt:now(),connectionId:credential.id,statistics:{period,base,totalSeconds:total,days,readDays:seconds(data.readDays)}};

  }
  async function run(scope,action,candidate){
    let filePath;try{filePath=file(scope);}catch{return fail("account");}
    if(locks.has(filePath))return fail("busy");
    locks.add(filePath);
    try{
      if(action==="disconnect"){fs.rmSync(filePath,{force:true});fs.rmSync(filePath+".identity",{force:true});return {ok:true,connected:false};}
      if(action==="status")return {ok:true,connected:fs.existsSync(filePath)};
      if(!secure())return fail("storage");
      if(action==="connect"){
        const key=typeof candidate==="string"?candidate.trim():"";
        if(!validKey(key))return fail("format");
        const result=await verify(key);if(result.ok){
          save(filePath,key);credential(filePath,key);
        }return result;
      }
      if(["test","shelf","progress","statistics"].includes(action)){
        const key=read(filePath);if(!key)return fail("not-connected");
        if(action==="test")return await verify(key);
        const active=credential(filePath,key);
        if(action==="progress")return await progress(active,candidate);
        if(action==="statistics")return await statistics(active,candidate);
        const result=await verify(key,true);
        return result.ok?{...result,connectionId:active.id}:result;
      }
      return fail("action");
    }catch{return fail("storage");}finally{locks.delete(filePath);}
  }
  return {run};
}
module.exports={createWeReadConnection};
