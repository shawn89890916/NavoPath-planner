import type { PlannerData, Project, Subtask, Task } from "../types";
import { captureTaskUndo, undoTaskChanges } from "./taskUndo";

const byOrder = <T extends { order?: number; createdAt?: string }>(a: T, b: T) =>
  (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) ||
  String(a.createdAt || "").localeCompare(String(b.createdAt || ""));

export function normalizeTreeOrder(data: PlannerData): PlannerData {
  const projects = [...data.projects].sort(byOrder).map((project, index) => ({ ...project, order: index }));
  const projectOrder = new Map(projects.map((project) => [project.id, project.order || 0]));
  const tasks = [...data.tasks]
    .map((task) => ({
      ...task,
      subtasks: task.subtasks ? normalizeTreeSubtaskOrder(task.subtasks) : [],
    }))
    .sort(
      (a, b) =>
        (projectOrder.get(a.projectId || "") ?? Number.MAX_SAFE_INTEGER) -
          (projectOrder.get(b.projectId || "") ?? Number.MAX_SAFE_INTEGER) || byOrder(a, b),
    );
  const grouped = new Map<string, Task[]>();
  tasks.forEach((task) => {
    const key = task.projectId || "";
    grouped.set(key, [...(grouped.get(key) || []), task]);
  });
  return {
    ...data,
    projects,
    tasks: tasks.map((task) => ({
      ...task,
      order: (grouped.get(task.projectId || "") || []).findIndex((item) => item.id === task.id),
    })),
  };
}

export function normalizeTreeSubtaskOrder(subtasks: Subtask[]): Subtask[] {
  return [...subtasks].sort(byOrder).map((item, index) => ({
    ...item,
    order: index,
    subtasks: item.subtasks ? normalizeTreeSubtaskOrder(item.subtasks) : undefined,
  }));
}

export function reorderProjects(projects: Project[], activeId: string, targetId: string, after: boolean) {
  const next = [...projects].sort(byOrder);
  const active = next.find((item) => item.id === activeId);
  if (!active || activeId === targetId) return next;
  next.splice(next.findIndex((item) => item.id === activeId), 1);
  const targetIndex = next.findIndex((item) => item.id === targetId);
  next.splice(Math.max(0, targetIndex + (after ? 1 : 0)), 0, active);
  return next.map((item, index) => ({ ...item, order: index }));
}

export function reorderTasks(
  tasks: Task[],
  activeId: string,
  targetProjectId: string | undefined,
  targetId?: string,
  after = false,
) {
  const active = tasks.find((item) => item.id === activeId);
  if (!active) return tasks;
  const untouched = tasks.filter((item) => item.id !== activeId && item.projectId !== targetProjectId);
  const group = tasks
    .filter((item) => item.id !== activeId && item.projectId === targetProjectId)
    .sort(byOrder);
  const targetIndex = targetId ? group.findIndex((item) => item.id === targetId) : group.length;
  group.splice(targetIndex < 0 ? group.length : targetIndex + (after ? 1 : 0), 0, {
    ...active,
    projectId: targetProjectId,
  });
  return [...untouched, ...group.map((item, index) => ({ ...item, order: index }))];
}

export function findSubtaskInTree(subtasks: Subtask[], id: string): Subtask | undefined {
  for (const item of subtasks) {
    if (item.id === id) return item;
    if (item.subtasks?.length) {
      const found = findSubtaskInTree(item.subtasks, id);
      if (found) return found;
    }
  }
  return undefined;
}

export function removeSubtaskFromTree(subtasks: Subtask[], id: string): Subtask[] {
  return subtasks
    .filter((item) => item.id !== id)
    .map((item) => ({
      ...item,
      subtasks: item.subtasks ? removeSubtaskFromTree(item.subtasks, id) : undefined,
    }));
}

export function addSubtaskToTree(
  subtasks: Subtask[],
  newItem: Subtask,
  parentId?: string,
): Subtask[] {
  if (!parentId) return [...subtasks, newItem];
  return subtasks.map((item) => {
    if (item.id === parentId) {
      return { ...item, subtasks: [...(item.subtasks || []), newItem] };
    }
    if (item.subtasks?.length) {
      return { ...item, subtasks: addSubtaskToTree(item.subtasks, newItem, parentId) };
    }
    return item;
  });
}

export function insertSubtaskRelativeInTree(
  subtasks: Subtask[],
  newItem: Subtask,
  targetId: string,
  after: boolean,
): Subtask[] {
  const targetIndex = subtasks.findIndex((item) => item.id === targetId);
  if (targetIndex >= 0) {
    const next = [...subtasks];
    next.splice(targetIndex + (after ? 1 : 0), 0, newItem);
    return next.map((item, index) => ({ ...item, order: index }));
  }
  for (let index = 0; index < subtasks.length; index += 1) {
    const children = subtasks[index].subtasks;
    if (!children?.length) continue;
    const moved = insertSubtaskRelativeInTree(children, newItem, targetId, after);
    if (moved !== children) {
      const next = [...subtasks];
      next[index] = { ...next[index], subtasks: moved };
      return next;
    }
  }
  return subtasks;
}

export function moveSubtaskInsideTree(
  subtasks: Subtask[],
  activeId: string,
  targetId: string,
  order?: number,
): Subtask[] {
  const active = findSubtaskInTree(subtasks, activeId);
  const target = findSubtaskInTree(subtasks, targetId);
  if (
    !active ||
    !target ||
    activeId === targetId ||
    findSubtaskInTree(active.subtasks || [], targetId)
  ) {
    return subtasks;
  }
  return addSubtaskToTree(
    removeSubtaskFromTree(subtasks, activeId),
    { ...active, order },
    targetId,
  );
}

export function moveSubtaskRelativeInTree(
  subtasks: Subtask[],
  activeId: string,
  targetId: string,
  after: boolean,
): Subtask[] {
  const active = findSubtaskInTree(subtasks, activeId);
  const target = findSubtaskInTree(subtasks, targetId);
  if (
    !active ||
    !target ||
    activeId === targetId ||
    findSubtaskInTree(active.subtasks || [], targetId)
  ) {
    return subtasks;
  }
  return insertSubtaskRelativeInTree(
    removeSubtaskFromTree(subtasks, activeId),
    active,
    targetId,
    after,
  );
}

export function countSubtasks(subtasks: Subtask[] | undefined): number {
  if (!subtasks?.length) return 0;
  let count = 0;
  for (const item of subtasks) {
    count += 1 + countSubtasks(item.subtasks);
  }
  return count;
}

export function countDoneSubtasks(subtasks: Subtask[] | undefined): number {
  if (!subtasks?.length) return 0;
  let count = 0;
  for (const item of subtasks) {
    if (item.completed || item.done) count += 1;
    count += countDoneSubtasks(item.subtasks);
  }
  return count;
}

export function toggleSubtaskInTree(subtasks: Subtask[], id: string): Subtask[] {
  return subtasks.map((item) => {
    if (item.id === id) {
      const nextDone = !(item.completed || item.done);
      return { ...item, completed: nextDone, done: nextDone };
    }
    return item.subtasks
      ? { ...item, subtasks: toggleSubtaskInTree(item.subtasks, id) }
      : item;
  });
}


export type TreeDragNode = { kind: "project" | "task" | "subtask"; id: string };
export type TreeDropTarget = TreeDragNode & { position: "before" | "inside" | "after" };

const UNASSIGNED_PROJECT = "__unassigned__";
const MAX_TREE_DEPTH = 64;

function locateSubtask(tasks: Task[], id: string) {
  for (const owner of tasks) {
    const walk = (items: Subtask[], depth: number): { item: Subtask; depth: number } | undefined => {
      for (const item of items) {
        if (item.id === id) return { item, depth };
        const nested = walk(item.subtasks || [], depth + 1);
        if (nested) return nested;
      }
      return undefined;
    };
    const found = walk(owner.subtasks || [], 1);
    if (found) return { ...found, owner };
  }
  return undefined;
}

function subtreeDepth(items: Subtask[]): number {
  return items.reduce((depth, item) => Math.max(depth, 1 + subtreeDepth(item.subtasks || [])), 0);
}

function hasLinkedSubtask(items: Subtask[], taskId?: string): boolean {
  return items.some(item => (taskId ? item.plannedTaskId === taskId : Boolean(item.plannedTaskId))
    || hasLinkedSubtask(item.subtasks || [], taskId));
}

function taskCanBecomeSubtask(data: PlannerData, task: Task): boolean {
  // Embedded subtasks do not own execution records. Never silently remove an
  // active, recurring, externally backed or independently referenced task.
  return !task.fixedCourse && !task.caldav && !task.recurrence && !task.parentTaskId
    && !task.plannedForDate && !task.executionLane && !task.scheduledDate
    && !task.scheduledStart && !task.scheduledEnd && !task.executionStatus
    && !task.timelineRecords?.length
    && !data.timeEntries?.some(entry => entry.taskId === task.id)
    && !data.tasks.some(other => other.parentTaskId === task.id || hasLinkedSubtask(other.subtasks || [], task.id))
    && !hasLinkedSubtask(task.subtasks || []);
}

function targetIsRoot(target: TreeDropTarget): boolean {
  return target.kind === "project" || (target.kind === "task" && target.position !== "inside");
}

export function treeDropPosition(source: TreeDragNode["kind"], target: TreeDragNode["kind"], offset: number, height: number): TreeDropTarget["position"] | null {
  if (source === "project") return target === "project" ? (offset < height / 2 ? "before" : "after") : null;
  if (target === "project") return "inside";
  const edge = Math.min(Math.max(height, 1) * 0.25, 12);
  return offset < edge ? "before" : offset > height - edge ? "after" : "inside";
}

export function canMoveTreeNode(data: PlannerData, source: TreeDragNode, target: TreeDropTarget): boolean {
  if (!source.id || !target.id || source.id === target.id) return false;
  if (source.kind === "project") {
    return target.kind === "project" && target.position !== "inside"
      && data.projects.some(p => p.id === source.id) && data.projects.some(p => p.id === target.id);
  }
  const task = source.kind === "task" ? data.tasks.find(item => item.id === source.id) : undefined;
  const sub = source.kind === "subtask" ? locateSubtask(data.tasks, source.id) : undefined;
  if (!task && !sub) return false;
  const targetTask = target.kind === "task" ? data.tasks.find(item => item.id === target.id) : undefined;
  const targetSub = target.kind === "subtask" ? locateSubtask(data.tasks, target.id) : undefined;
  if (target.kind === "task" && !targetTask || target.kind === "subtask" && !targetSub) return false;
  if (target.kind === "project" && (target.position !== "inside"
    || (target.id !== UNASSIGNED_PROJECT && !data.projects.some(p => p.id === target.id)))) return false;
  const root = targetIsRoot(target);
  const targetOwner = targetTask || targetSub?.owner;
  const children = task?.subtasks || sub?.item.subtasks || [];
  if (findSubtaskInTree(children, target.id)) return false;
  if (task && !root && (targetOwner?.id === task.id || !taskCanBecomeSubtask(data, task))) return false;
  if (sub && (root || targetOwner?.id !== sub.owner.id)
    && (sub.item.plannedTaskId || hasLinkedSubtask(children))) return false;
  if (root && sub && data.tasks.some(item => item.id === sub.item.id)) return false;
  if (!root) {
    const depth = targetSub ? targetSub.depth + (target.position === "inside" ? 1 : 0) : 1;
    if (depth + subtreeDepth(children) > MAX_TREE_DEPTH) return false;
  }
  return true;
}

function restoreStamp(data: PlannerData, id: string, now: string): string {
  const deleted = Date.parse(data.sync?.deleted?.["tasks:" + id] || "");
  const stamp = Date.parse(now);
  return Number.isFinite(deleted) && deleted >= stamp ? new Date(deleted + 1).toISOString() : now;
}

function toIndependentTask(sub: Subtask, owner: Task, projectId: string | undefined, data: PlannerData, now: string): Task {
  const saved = sub.treeTaskSnapshot;
  const completed = Boolean(sub.completed || sub.done);
  return {
    dueDate: "", category: owner.category, priority: null, notes: "", goalId: "",
    ...saved,
    id: sub.id, title: sub.title, completed,
    workflowStatus: completed ? "done" : saved?.workflowStatus === "done" ? "backlog" : saved?.workflowStatus,
    completedAt: completed ? saved?.completedAt : undefined,
    projectId, order: Number.MAX_SAFE_INTEGER, subtasks: sub.subtasks || [],
    timelineRecords: [], createdAt: sub.createdAt, updatedAt: restoreStamp(data, sub.id, now),
  };
}

function finishTreeMove(data: PlannerData, projects: Project[], tasks: Task[], now: string): PlannerData {
  const next = normalizeTreeOrder({ ...data, projects, tasks });
  const oldTasks = new Map(data.tasks.map(task => [task.id, task]));
  const oldProjects = new Map(data.projects.map(project => [project.id, project]));
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  next.tasks = next.tasks.map(task => same(task, oldTasks.get(task.id)) ? oldTasks.get(task.id)! : {
    ...task, updatedAt: restoreStamp(data, task.id, now),
  });
  next.projects = next.projects.map(project => same(project, oldProjects.get(project.id)) ? oldProjects.get(project.id)! : { ...project, updatedAt: now });
  if (next.tasks.length === data.tasks.length && next.projects.length === data.projects.length
    && next.tasks.every((task, i) => task === data.tasks[i])
    && next.projects.every((project, i) => project === data.projects[i])) return data;
  return next;
}

/** Atomic move: validate before detaching, retain identities and whole subtrees. */
export function moveTreeNode(data: PlannerData, source: TreeDragNode, target: TreeDropTarget, now = new Date().toISOString()): PlannerData {
  if (!canMoveTreeNode(data, source, target)) return data;
  if (source.kind === "project") {
    return finishTreeMove(data, reorderProjects(data.projects, source.id, target.id, target.position === "after"), data.tasks, now);
  }
  const root = targetIsRoot(target);
  const targetTask = target.kind === "task" ? data.tasks.find(task => task.id === target.id) : undefined;
  const targetSub = target.kind === "subtask" ? locateSubtask(data.tasks, target.id) : undefined;
  const projectId = target.kind === "project" ? (target.id === UNASSIGNED_PROJECT ? undefined : target.id) : targetTask?.projectId;
  if (source.kind === "task" && root) {
    return finishTreeMove(data, data.projects, reorderTasks(data.tasks, source.id, projectId, targetTask?.id, target.position === "after"), now);
  }
  const sourceTask = source.kind === "task" ? data.tasks.find(task => task.id === source.id) : undefined;
  const sourceSub = source.kind === "subtask" ? locateSubtask(data.tasks, source.id) : undefined;
  let moving: Subtask;
  let tasks: Task[];
  if (sourceTask) {
    const { subtasks, ...treeTaskSnapshot } = sourceTask;
    moving = { id: sourceTask.id, title: sourceTask.title, completed: sourceTask.completed,
      done: sourceTask.completed, createdAt: sourceTask.createdAt, subtasks, treeTaskSnapshot };
    tasks = data.tasks.filter(task => task.id !== sourceTask.id);
  } else if (sourceSub) {
    moving = sourceSub.item;
    tasks = data.tasks.map(task => task.id === sourceSub.owner.id
      ? { ...task, subtasks: removeSubtaskFromTree(task.subtasks || [], moving.id) } : task);
    if (root) {
      const restored = toIndependentTask(moving, sourceSub.owner, projectId, data, now);
      return finishTreeMove(data, data.projects, reorderTasks([...tasks, restored], restored.id, projectId, targetTask?.id, target.position === "after"), now);
    }
  } else return data;
  const ownerId = targetTask?.id || targetSub?.owner.id;
  if (!ownerId) return data;
  const owner = tasks.find(task => task.id === ownerId);
  if (!owner) return data;
  const children = owner.subtasks || [];
  const nextChildren = target.kind === "subtask" && target.position !== "inside"
    ? insertSubtaskRelativeInTree(children, moving, target.id, target.position === "after")
    : addSubtaskToTree(children, { ...moving, order: Number.MAX_SAFE_INTEGER }, target.kind === "subtask" ? target.id : undefined);
  if (!findSubtaskInTree(nextChildren, moving.id)) return data;
  return finishTreeMove(data, data.projects, tasks.map(task => task.id === ownerId ? { ...task, subtasks: nextChildren } : task), now);
}

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
