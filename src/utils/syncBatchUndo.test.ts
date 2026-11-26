import { describe, expect, it } from "vitest";
import { normalizeData } from "../browserFallback";
import { createDemoData } from "../productDemoData";
import { captureSyncBatch, undoSyncBatch } from "./syncBatchUndo";
import type { Project, Task } from "../types";

const now = "2026-11-26T09:00:00.000Z";
const pairId = "test-pair";
function fixture() {
  const before = normalizeData(createDemoData("en", "planning", 0));
  const project: Project = {...before.projects[0],id:"sp-project",title:"Imported",createdAt:now,updatedAt:now};
  const task: Task = {...before.tasks[0],id:"sp-task",title:"Imported task",projectId:project.id,parentTaskId:undefined,createdAt:now,updatedAt:now,timelineRecords:[]};
  const after = {...before, projects:[...before.projects, project],tasks:[...before.tasks,task]};
  return {before, after, project, task};
}
describe("synchronization batch activity undo", () => {
  it("undoes an entire import while retaining unrelated later edits", () => {
    const {before,after,task,project} = fixture();
    const {undo,sync} = captureSyncBatch(before,after,pairId);
    expect(sync.projects).toHaveLength(1);
    expect(undo.added.map(t=>t.id)).toContain(task.id);
    const latest = {...after,tasks:after.tasks.map((t,i)=>i===0?{...t,notes:"unrelated edit"}:t)};
    const restored = undoSyncBatch(latest,undo,sync,now)!;
    expect(restored.tasks.find(t=>t.id===task.id)).toBeUndefined();
    expect(restored.projects.find(p=>p.id===project.id)).toBeUndefined();
    expect(restored.tasks[0].notes).toBe("unrelated edit");
  });
  it("refuses later edits or new dependencies on imported projects", () => {
    const {before,after,project,task} = fixture();
    const {undo,sync} = captureSyncBatch(before,after,pairId);
    expect(undoSyncBatch({...after,tasks:after.tasks.map(t=>t.id===task.id?{...t,notes:"new edit"}:t)},undo,sync,now)).toBeNull();
    expect(undoSyncBatch({...after,projects:after.projects.map(p=>p.id===project.id?{...p,title:"Renamed"}:p)},undo,sync,now)).toBeNull();
    expect(undoSyncBatch({...after,tasks:[...after.tasks,{...task,id:"new-task",title:"New task"}]},undo,sync,now)).toBeNull();
  });
  it("restores deleted projects before restoring tasks and schedules", () => {
    const {after,project,task} = fixture();
    const deleted = {...after,projects:after.projects.filter(p=>p.id!==project.id),tasks:after.tasks.filter(t=>t.id!==task.id)};
    const {undo,sync} = captureSyncBatch(after,deleted,pairId);
    const restored = undoSyncBatch(deleted,undo,sync,now)!;
    expect(restored.projects.some(p=>p.id===project.id)).toBe(true);
    expect(restored.tasks.find(t=>t.id===task.id)?.projectId).toBe(project.id);
  });
});
