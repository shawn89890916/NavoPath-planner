const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const {createWeReadConnection}=require("./weread-connection.cjs");
const account="11111111-1111-1111-1111-111111111111",other="22222222-2222-2222-2222-222222222222";
const key="wrk-example-token";
function fixture(t,fetchImpl,available=true){
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),"nvp-weread-"));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
  const safeStorage={isEncryptionAvailable:()=>available,encryptString:v=>Buffer.from(v).map(x=>x^42),decryptString:v=>Buffer.from(v).map(x=>x^42).toString()};
  return {directory,service:createWeReadConnection({directory,safeStorage,fetchImpl})};
}
const response=data=>new Response(JSON.stringify(data));
test("verifies official shelf, encrypts per account, never returns key or shelf contents",async t=>{
  const {directory,service}=fixture(t,async(url,options)=>{
    assert.equal(url,"https://i.weread.qq.com/api/agent/gateway");assert.equal(options.redirect,"error");assert.equal(options.headers.Authorization,"Bearer "+key);
    assert.deepEqual(JSON.parse(options.body),{api_name:"/shelf/sync",skill_version:"1.0.6"});
    return response({books:[{title:"Private title"}],albums:[{}],mp:{id:1},upgrade_info:{version:"1.0.6"}});
  });
  assert.deepEqual(await service.run(account,"status"),{ok:true,connected:false});
  const result=await service.run(account,"connect",key);assert.deepEqual(result.counts,{books:1,audiobooks:1,articles:1});
  assert.doesNotMatch(JSON.stringify(result),/Private title|wrk-example|upgrade_info/);assert.equal(result.upgradeNotice,true);assert.equal(result.ok,true);
  assert.equal(fs.readdirSync(directory).length,2);for(const name of fs.readdirSync(directory))assert.ok(!fs.readFileSync(path.join(directory,name)).includes(key));
  assert.equal((await service.run(other,"status")).connected,false);
  assert.equal((await service.run(account,"test")).ok,true);
  assert.equal((await service.run(account,"disconnect")).connected,false);
  assert.equal(fs.readdirSync(directory).length,0);
});
test("rejects bad keys, unavailable encryption, API errors and failed replacement",async t=>{
  let bad=false;const {service}=fixture(t,async()=>bad?new Response("",{status:401}):response({books:[],albums:[]}));
  assert.equal((await service.run(account,"connect","wrong")).code,"format");
  assert.equal((await service.run(account,"connect",key)).ok,true);bad=true;
  assert.equal((await service.run(account,"connect","wrk-other-key")).code,"auth");
  assert.equal((await service.run(account,"status")).connected,true);
  const blocked=fixture(t,async()=>{throw Error("must not fetch")},false);
  assert.equal((await blocked.service.run(account,"connect",key)).code,"storage");
  assert.equal(fs.readdirSync(blocked.directory).length,0);
});
test("never silently falls back to Linux basic_text and disconnect works after storage becomes unavailable",async t=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),"nvp-weread-"));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
  let basic=false;const safeStorage={isEncryptionAvailable:()=>true,getSelectedStorageBackend:()=>basic?"basic_text":"kwallet",encryptString:v=>Buffer.from(v).map(x=>x^42),decryptString:v=>Buffer.from(v).map(x=>x^42).toString()};
  const service=createWeReadConnection({directory,safeStorage,fetchImpl:async()=>response({books:[],albums:[]})});
  assert.equal((await service.run(account,"connect",key)).ok,true);basic=true;
  assert.equal((await service.run(account,"status")).connected,true);
  assert.equal((await service.run(account,"test")).code,"storage");
  assert.equal((await service.run(other,"connect",key)).code,"storage");
  assert.equal((await service.run(account,"disconnect")).connected,false);
});
test("treats upgrade_info as non-blocking and rejects unapproved scopes or concurrent writes",async t=>{
  let release;const {service}=fixture(t,()=>new Promise(r=>release=r));
  const pending=service.run(account,"connect",key);
  assert.equal((await service.run(account,"disconnect")).code,"busy");
  release(response({books:[{}],albums:[{}],upgrade_info:{version:"1.0.6"}}));const upgraded=await pending;assert.equal(upgraded.ok,true);assert.equal(upgraded.upgradeNotice,true);assert.deepEqual(upgraded.counts,{books:1,audiobooks:1,articles:0});
  assert.equal((await service.run(account,"status")).connected,true);
  assert.equal((await service.run("../outside","status")).code,"account");
});

test("reads sanitized shelf/progress/weekly statistics; isolates credential changes and does not expose secrets",async t=>{
  const calls=[];
  const {service,directory}=fixture(t,async(_url,options)=>{
    const body=JSON.parse(options.body);calls.push(body);
    if(body.api_name==="/shelf/sync")return response({books:[{bookId:"book1",title:"Book",author:"Author",secret:0,readUpdateTime:100,cover:"https://wfqqreader-1252317822.image.myqcloud.com/cover",readerLink:"https://weread.qq.com/web/reader/abc",token:"must-not-return"},{bookId:"book2",title:"Private",secret:1,cover:"https://myqcloud.com.attacker.example/cover",readerLink:"javascript:alert(1)"},{bookId:"book1",title:"Duplicate",secret:0}],albums:[{albumInfo:{albumId:"album1",name:"Audio"},albumInfoExtra:{secret:0,lectureReadUpdateTime:50}}],mp:{id:"mp"}});
    if(body.api_name==="/book/getprogress")return response({bookId:body.bookId,book:{progress:1,recordReadingTime:3600,updateTime:101,isStartReading:1}});
    if(body.api_name==="/readdata/detail")return response({baseTime:100,totalReadTime:3600,readTimes:{"100":1800,"86500":1800},readDays:2});
    throw Error("Unexpected endpoint");
  });
  // Simulate an installed Beta 144 key file (fake fixture encryption only).
  const {createHash}=require("node:crypto");const filename="weread-"+createHash("sha256").update(account).digest("hex")+".enc";
  fs.writeFileSync(path.join(directory,filename),Buffer.from(key).map(x=>x^42));
  const shelf=await service.run(account,"shelf");assert.equal(shelf.ok,true);assert.equal(shelf.shelf.length,3);
  assert.equal(shelf.shelf[1].private,true);assert.equal(shelf.shelf[1].cover,undefined);assert.equal(shelf.shelf[1].readerLink,undefined);assert.equal(shelf.shelf[0].cover,"https://wfqqreader-1252317822.image.myqcloud.com/cover");
  assert.doesNotMatch(JSON.stringify(shelf),/must-not-return|wrk-example/);
  const id=shelf.connectionId;assert.ok(id);
  const next=await service.run(account,"progress","book1");assert.equal(next.connectionId,id);assert.equal(next.progress.percent,1);assert.equal(next.progress.seconds,3600);
  assert.deepEqual(calls.at(-1),{api_name:"/book/getprogress",skill_version:"1.0.6",bookId:"book1"});
  const stats=await service.run(account,"statistics");assert.equal(stats.statistics.totalSeconds,3600);assert.equal(stats.statistics.period,"weekly");assert.equal(stats.statistics.days.length,2);
  assert.equal((await service.run(account,"statistics","monthly")).statistics.period,"monthly");
  assert.equal((await service.run(account,"statistics","invalid")).code,"format");
  assert.equal((await service.run(account,"connect",key)).ok,true);assert.equal((await service.run(account,"shelf")).connectionId,id);
  assert.equal((await service.run(account,"connect","wrk-other-key")).ok,true);assert.notEqual((await service.run(account,"shelf")).connectionId,id);
  assert.equal((await service.run(other,"shelf")).code,"not-connected");
});
test("rejects mismatched book IDs and invalid progress payloads",async t=>{
  let malformed=false;const {service}=fixture(t,async(_u,opts)=>JSON.parse(opts.body).api_name==="/shelf/sync"?response({books:[],albums:[]}):response({bookId:malformed?"book":"other",book:{progress:101}}));
  assert.equal((await service.run(account,"connect",key)).ok,true);
  assert.equal((await service.run(account,"progress","book")).code,"response");malformed=true;assert.equal((await service.run(account,"progress","book")).code,"response");
});
