import type { PlannerData, Task } from "../types";
import { setTaskCompletion, habitScheduleForTask } from "../utils/taskCompletion";
import type { V2Task, V2TaskCommand, V2TaskResult } from "./sdkV2";

export function projectPluginTask(task: Task): V2Task {
  return { id: task.id, title: task.title, completed: task.completed, projectId: task.projectId,
    dueDate: task.dueDate || undefined, estimateMinutes: Number.isFinite(task.estimatedHours) ? task.estimatedHours! * 60 : undefined,
    updatedAt: task.updatedAt };
}
interface CommandHost {
  current(): PlannerData | null;
  active(): boolean;
  now(): string;
  today(): string;
  save(data: PlannerData, kind: "create" | "edit" | "complete" | "reopen"): Promise<void>;
}
function conflict(message: string): V2TaskResult { return { status: "conflict", message }; }
function unavailable(message: string): V2TaskResult { return { status: "unavailable", message }; }
function accepted(task: Task, entityId?: string): V2TaskResult {
  return { status: "accepted", task: { ...projectPluginTask(task), ...(entityId === undefined ? {} : { entityId }) } };
}
function validText(value: unknown, length: number): value is string {
  return typeof value === "string" && !!value.trim() && value.length <= length;
}
export function validPluginEntityId(value: unknown): value is string {
  return typeof value === "string" && !!value.trim() && value.length <= 200 && !/[\x00-\x1f]/.test(value);
}
async function digestKey(parts: string[]) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(parts)));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}
export async function pluginEntityKeys(owner: string, ids: readonly string[]) {
  return new Map(await Promise.all([...new Set(ids)].map(async id => [await digestKey(["entity", owner, id]), id] as const)));
}
export function linkedPluginEntity(taskId: string, keys: ReadonlyMap<string, string>) {
  const match = /^plugin-task-[0-9a-f]{64}-([0-9a-f]{64})$/.exec(taskId);
  return match ? keys.get(match[1]) : undefined;
}
/** Stable per-owner creation ID uses the existing task/tombstone ledger, no new cloud schema.
 * A linked task carries an immutable entity digest in the same task identity.
 * No separate association write can be lost between task creation and linking. */
 * For edits, require the current task revision; no promise of cross-device CAS.
 * Success means the existing optimistic local task/history pipeline accepted the mutation. */
export async function executePluginTask(owner: string, command: V2TaskCommand, host: CommandHost): Promise<V2TaskResult> {
  if (!host.active()) return unavailable("Plugin activation ended");
  if (!command || !validText(command.operationId, 128)) return conflict("Invalid operation ID");
  if (command.kind === "create") {
    if (!validText(command.title, 240) || (command.entityId !== undefined && !validPluginEntityId(command.entityId)) ||
      (command.projectId !== undefined && !validText(command.projectId, 200)) ||
      (command.estimateMinutes !== undefined && (!Number.isFinite(command.estimateMinutes) || command.estimateMinutes <= 0 || command.estimateMinutes > 1440))) return conflict("Invalid task creation or entity link");
    const operation = "plugin-task-" + await digestKey([owner, command.operationId]);
    const id = command.entityId === undefined ? operation : operation + "-" + await digestKey(["entity", owner, command.entityId]);
    const current = host.current();
    if (!current || !host.active()) return unavailable("Workspace changed");
    const sameOperation = (taskId: string) => taskId === operation || taskId.startsWith(operation + "-");
    const existing = current.tasks.find(task => sameOperation(task.id));
    if (existing) return existing.id === id ? accepted(existing, command.entityId) : conflict("Operation already belongs to a different entity");
    if (Object.keys(current.sync?.deleted ?? {}).some(key => key.startsWith("tasks:") && sameOperation(key.slice(6)))) return conflict("This operation's task was deleted");
    if (command.projectId && !current.projects.some(project => project.id === command.projectId && !project.completed)) return conflict("Project unavailable");
    const now = host.now();
    const task: Task = { id, title: command.title.trim(), category: "personal", priority: null,
      notes: "", dueDate: "", goalId: "", projectId: command.projectId, completed: false,
      estimatedHours: (command.estimateMinutes ?? 30) / 60, plannedForDate: host.today(),
      executionLane: "candidate", order: Date.parse(now), createdAt: now, updatedAt: now };
    await host.save({ ...current, tasks: [...current.tasks, task] }, "create");
    return accepted(task, command.entityId);
  }
  if (command.kind !== "rename" && command.kind !== "complete") return conflict("Unsupported task command");
  const current = host.current();
  if (!current || !host.active()) return unavailable("Workspace changed");
  const task = current.tasks.find(item => item.id === command.taskId);
  if (!task || task.fixedCourse || task.caldav || habitScheduleForTask(current, task.id)) return conflict("Task unavailable for plugin edits");
  if (command.kind === "rename" && !validText(command.title, 240)) return conflict("Invalid title");
  if (command.kind === "complete" && typeof command.completed !== "boolean") return conflict("Invalid completion");
  if (command.kind === "rename" ? task.title === command.title.trim() : task.completed === command.completed) return accepted(task);
  if (!command.expectedUpdatedAt || command.expectedUpdatedAt !== task.updatedAt) return conflict("Task changed; read the current revision first");
  const stamp = Date.parse(task.updatedAt), wall = Date.parse(host.now());
  if (!Number.isFinite(stamp) || !Number.isFinite(wall)) return conflict("Task revision unavailable");
  const now = new Date(Math.max(wall, stamp + 1)).toISOString();
  const next = command.kind === "complete" ? setTaskCompletion(current, task.id, command.completed, now)
    : { ...current, tasks: current.tasks.map(item => item.id === task.id ? { ...item, title: command.title.trim(), updatedAt: now,
      aiInference: item.aiInference ? { duration: item.aiInference.duration?.userOverridden ? item.aiInference.duration : undefined,
        project: item.aiInference.project?.userOverridden ? item.aiInference.project : undefined } : undefined } : item) };
  const updated = next.tasks.find(item => item.id === task.id);
  if (!updated || next === current) return conflict("Task change unavailable");
  await host.save(next, command.kind === "rename" ? "edit" : command.completed ? "complete" : "reopen");
  return accepted(updated);
}
