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
    const key=safeStorage.decryptString(fs.readFileSync(filePath));
    if(!validKey(key))throw Error("Storage unavailable");
    return key;
  }
  function save(filePath,key){
    if(!secure())throw Error("Storage unavailable");
    fs.mkdirSync(directory,{recursive:true});
    const temp=filePath+"."+randomUUID()+".tmp";
    try{fs.writeFileSync(temp,safeStorage.encryptString(key),{mode:0o600});fs.renameSync(temp,filePath);}
    finally{try{fs.unlinkSync(temp);}catch{}}
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
  async function verify(key){
    const result=await request(key,"/shelf/sync");
    if(!result.ok)return result;
    const {books,albums,mp}=result.data;
    if(!Array.isArray(books)||!Array.isArray(albums))return fail("response");
    const counts={books:books.length,audiobooks:albums.length,articles:obj(mp)&&Object.keys(mp).length?1:0};
    // Return aggregate counts only, never raw gateway responses, private titles or secrets.
    return {ok:true,connected:true,checkedAt:now(),counts,upgradeNotice:result.upgradeNotice};
  }
  async function run(scope,action,candidate){
    let filePath;try{filePath=file(scope);}catch{return fail("account");}
    if(locks.has(filePath))return fail("busy");
    locks.add(filePath);
    try{
      if(action==="disconnect"){fs.rmSync(filePath,{force:true});return {ok:true,connected:false};}
      if(action==="status")return {ok:true,connected:fs.existsSync(filePath)};
      if(!secure())return fail("storage");
      if(action==="connect"){
        const key=typeof candidate==="string"?candidate.trim():"";
        if(!validKey(key))return fail("format");
        const result=await verify(key);if(result.ok)save(filePath,key);return result;
      }
      if(action==="test"){
        const key=read(filePath);if(!key)return fail("not-connected");
        return await verify(key);
      }
      return fail("action");
    }catch{return fail("storage");}finally{locks.delete(filePath);}
  }
  return {run};
}
module.exports={createWeReadConnection};
