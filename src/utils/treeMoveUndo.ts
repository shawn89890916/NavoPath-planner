import type { PlannerData } from "../types";
import { captureTaskUndo, undoTaskChanges } from "./taskUndo";

const byOrder = <T extends { order?: number; createdAt?: string }>(a: T, b: T) =>
  (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) ||
  String(a.createdAt || "").localeCompare(String(b.createdAt || ""));

export function captureTreeMoveUndo(before: PlannerData, after: PlannerData) {
  return {
    undo: captureTaskUndo(before, after),
    projects: before.projects.flatMap(project => {
      const next = after.projects.find(item => item.id === project.id);
      return next && next.order !== project.order ? [{ id: project.id, before: project.order, after: next.order }] : [];
    }),
  };
}

export function undoTreeMove(data: PlannerData, move: ReturnType<typeof captureTreeMoveUndo>, now = new Date().toISOString()): PlannerData | null {
  if (move.projects.some(change => !data.projects.some(project => project.id === change.id && project.order === change.after))) return null;
  const hasTaskChanges = move.undo.added.length || move.undo.removed.length || move.undo.changes.length;
  const restored = hasTaskChanges ? undoTaskChanges(data, move.undo, now) : data;
  if (hasTaskChanges && restored === data) return null;
  const projects = restored.projects.map(project => {
    const change = move.projects.find(item => item.id === project.id);
    return change ? { ...project, order: change.before, updatedAt: now } : project;
  }).sort(byOrder);
  const projectOrder = new Map(projects.map((project, index) => [project.id, index]));
  const tasks = [...restored.tasks].sort((a, b) =>
    (projectOrder.get(a.projectId || "") ?? Number.MAX_SAFE_INTEGER)
    - (projectOrder.get(b.projectId || "") ?? Number.MAX_SAFE_INTEGER) || byOrder(a, b));
  return { ...restored, tasks, projects };
}
