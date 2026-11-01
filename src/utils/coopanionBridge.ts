import type { PlannerData, Task } from '../types';
export interface StudyCommand { id:string; title:string; minutes:number; date:string; workspace:string; commandFile:string }
export function applyStudyCommand(data:PlannerData,command:StudyCommand,workspace:string,now=new Date().toISOString()):PlannerData {
 if(command.workspace!==workspace)throw Error('Study bridge workspace mismatch');
 if(!/^coo-[a-zA-Z0-9-]+$/.test(command.id)||!command.title?.trim()||command.title.length>300||!Number.isFinite(command.minutes)||command.minutes<1||command.minutes>1440||!/^\d{4}-\d{2}-\d{2}$/.test(command.date))throw Error('Invalid study task');
 if(data.tasks.some(t=>t.id===command.id))return data;
 const task:Task={id:command.id,title:command.title.trim(),category:'personal',priority:'medium',notes:'',goalId:'',dueDate:command.date,completed:false,estimatedHours:command.minutes/60,plannedForDate:command.date,executionLane:'candidate',order:Date.now(),createdAt:now,updatedAt:now,subtasks:[]};
 return {...data,tasks:[...data.tasks,task]};
}

