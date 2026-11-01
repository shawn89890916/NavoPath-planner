import {describe,it,expect} from 'vitest';
import {applyStudyCommand} from './coopanionBridge';
describe('Coopanion bridge',()=>{
 const data={tasks:[],events:[],projects:[],goals:[]} as any;
 const command={id:'coo-a123',title:'口语',minutes:50,date:'2026-11-01',workspace:'test',commandFile:'a.json'};
 it('新任务进入今日候选，重试不会重复或覆盖已有安排',()=>{const next=applyStudyCommand(data,command,'test');expect(next.tasks[0]).toMatchObject({plannedForDate:'2026-11-01',executionLane:'candidate',estimatedHours:50/60});expect(applyStudyCommand(next,command,'test')).toBe(next);});
 it('拒绝错误工作区和无效任务',()=>{expect(()=>applyStudyCommand(data,command,'other')).toThrow();expect(()=>applyStudyCommand(data,{...command,minutes:-1},'test')).toThrow();});
});
