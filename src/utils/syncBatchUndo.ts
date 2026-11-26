import type { PlannerData, Project } from "../types";
import { normalizeData } from "../browserFallback";
import { captureTaskUndo, undoTaskChanges, type TaskUndo } from "./taskUndo";

type ProjectChange = { id: string; before?: Project; after?: Project; savedAfter?: Project };
export type SyncBatchUndo = { pairId: string; projects: ProjectChange[] };
function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v,i) => same(v,b[i]));
  const x = a as Record<string,unknown>, y = b as Record<string,unknown>;
  return [...new Set([...Object.keys(x),...Object.keys(y)])].every(key => same(x[key],y[key]));
}
function sameProject(a?: Project, b?: Project) {
  if (!a || !b) return a === b;
  const { updatedAt: _a, ...left } = a, { updatedAt: _b, ...right } = b;
  return same(left, right);
}
export function captureSyncBatch(before: PlannerData, after: PlannerData, pairId: string): { undo: TaskUndo; sync: SyncBatchUndo } {
  const original = new Map(before.projects.map(p => [p.id,p]));
  const updated = new Map(after.projects.map(p => [p.id,p]));
  const normalized = new Map(normalizeData(after).projects.map(p => [p.id,p]));
  const projects = [...new Set([...original.keys(),...updated.keys()])].flatMap(id => {
    const prev = original.get(id), next = updated.get(id);
    return sameProject(prev,next) ? [] : [{ id, before: prev, after: next, savedAfter: normalized.get(id) }];
  });
  return { undo: captureTaskUndo(before,after), sync: { pairId, projects } };
}
export function undoSyncBatch(data: PlannerData, undo: TaskUndo, sync: SyncBatchUndo, now: string): PlannerData | null {
  const byId = new Map(data.projects.map(p => [p.id,p]));
  for (const change of sync.projects) {
    const current = byId.get(change.id);
    if (!sameProject(current,change.after) && !(change.savedAfter && sameProject(current,change.savedAfter))) return null;
  }
  const removedProjects = new Set(sync.projects.filter(p => !p.before).map(p => p.id));
  const changed = new Map(sync.projects.map(p => [p.id,p]));
  const restored = (p: Project) => {
    const cutoff = Math.max(Date.parse(now), (Date.parse(data.sync?.deleted[`projects:${p.id}`] || "") || 0) + 1, (Date.parse(byId.get(p.id)?.updatedAt || "") || 0) + 1);
    return { ...p, updatedAt: new Date(cutoff).toISOString() };
  };
  const projects = data.projects.flatMap(p => {
    const change = changed.get(p.id);
    return change ? change.before ? [restored(change.before)] : [] : [p];
  });
  for (const change of sync.projects) if (change.before && !byId.has(change.id)) projects.push(restored(change.before));
  const projectDraft = { ...data, projects };
  const next = undoTaskChanges(projectDraft,undo,now);
  if (next === projectDraft) return null;
  if (next.tasks.some(t => t.projectId && removedProjects.has(t.projectId))) return null;
  return next;
}
