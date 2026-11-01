const fs = require('node:fs');
const path = require('node:path');
function installStudyBridge(ipcMain, app) {
 const dir = path.join(app.getPath('userData'), 'integrations', 'coopanion');
 const inbox = path.join(dir, 'inbox');
 fs.mkdirSync(inbox, {recursive:true});
 const atomic = (file,data) => {const tmp=file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(data));fs.renameSync(tmp,file);};
 ipcMain.handle('study-bridge:publish', (_event, payload) => {
  if(!payload || !Array.isArray(payload.tasks) || typeof payload.workspace!=='string') throw Error('Invalid study projection');
  atomic(path.join(dir,'projection.json'), {version:1,workspace:payload.workspace,at:new Date().toISOString(),tasks:payload.tasks.map(t=>({id:t.id,title:t.title,completed:t.completed,estimatedHours:t.estimatedHours,plannedForDate:t.plannedForDate,timelineRecords:t.timelineRecords,scheduledDate:t.scheduledDate,scheduledStart:t.scheduledStart,scheduledEnd:t.scheduledEnd,executionStatus:t.executionStatus}))});
  return true;
 });
 ipcMain.handle('study-bridge:pending',()=>fs.readdirSync(inbox).filter(n=>/^[a-zA-Z0-9-]+\.json$/.test(n)).slice(0,100).flatMap(name=>{
  const file=path.join(inbox,name);if(fs.statSync(file).size>10000)return [];
  try {const c=JSON.parse(fs.readFileSync(file,'utf8'));return [{...c,commandFile:name}];}catch{return [];}
 }));
 ipcMain.handle('study-bridge:ack',(_event,name)=>{
  if(typeof name!=='string'|| !/^[a-zA-Z0-9-]+\.json$/.test(name))throw Error('Invalid command name');
  fs.rmSync(path.join(inbox,name),{force:true});return true;
 });
}
module.exports={installStudyBridge};
