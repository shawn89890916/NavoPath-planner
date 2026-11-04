import {parseTimetableJson,mergeTimetable} from './parser';
export default {onload(ctx:any){
 const zh=ctx.language==='zh',name=zh?'课表':'Class timetable';
 ctx.calendar.registerBackground((event:any)=>event.fixedCourse===true);
 ctx.settings.registerPage(name,(container:HTMLElement)=>{
  let mounted=true;const account=ctx.app.getAccountId();
  const description=document.createElement('p');description.textContent=zh?'导入 JSON 课表，课程与自习显示为背景。任务可覆盖课程。停用不删除课表。':'Import JSON classes and self-study as backgrounds. Tasks may overlap classes. Disabling retains data.';
  const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.setAttribute('aria-label',zh?'选择课表 JSON':'Select timetable JSON');
  const label=document.createElement('label'),weekly=document.createElement('input');weekly.type='checkbox';weekly.checked=true;label.append(weekly,document.createTextNode(zh?' 每周重复':' Repeat weekly'));
  const status=document.createElement('p');status.setAttribute('role','status');
  input.onchange=async()=>{const file=input.files?.[0];if(!file)return;try{if(file.size>2*1024*1024)throw Error(zh?'文件需小于 2 MB':'File must be below 2 MB');const events=parseTimetableJson(await file.text());if(!mounted||ctx.app.getAccountId()!==account)return;
   if(weekly.checked)for(const e of events){const mins=(t:string)=>+t.slice(0,2)*60+(+t.slice(3));e.recurrence={mode:'scheduled',frequency:'weekly',startDate:e.date,startTime:e.startTime,durationMinutes:mins(e.endTime!)-mins(e.startTime!)};}
   const current=ctx.app.getData(),next=mergeTimetable(current,events);if(next!==current)await ctx.app.saveData(next);if(mounted)status.textContent=zh?`已添加 ${next.events.length-current.events.length} 节课程；重复项自动跳过。`:`Added ${next.events.length-current.events.length} classes; duplicates skipped.`;
  }catch(error){if(mounted)status.textContent=error instanceof Error?error.message:String(error);}finally{input.value='';}};
  container.append(description,input,label,status);return()=>{mounted=false;input.onchange=null;container.replaceChildren();};
 });
}};
