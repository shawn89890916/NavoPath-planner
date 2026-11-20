import { describe, expect, it } from "vitest";
import type { TaskOperation } from "../components/TaskOperationHistory";
import { createDemoData } from "../productDemoData";
import { normalizeData } from "../browserFallback";
import { captureTaskUndo, undoTaskChanges } from "./taskUndo";
import { TASK_OPERATION_RETENTION_MS, updateSavedTaskOperations } from "./taskOperationHistory";

const now = Date.parse("2026-11-20T09:00:00.000Z");
const data = normalizeData(createDemoData("en", "planning", 0));
const created = { ...data.tasks[0], id: "history-test", order: 100, workflowStatus: undefined };
const after = { ...data, tasks: [...data.tasks, created] };

function operation(id: string, workspaceKey: string, time: number): TaskOperation {
  return { id, workspaceKey, at: new Date(time).toISOString(), kind: "create",
    titles: [created.title], undo: captureTaskUndo(data, after) };
}

describe("saved task operations", () => {
  it("retains all recent operations, prunes expired ones, and isolates workspaces", async () => {
    const workspace = "cloud:retention-test";
    const expiredAt = now - TASK_OPERATION_RETENTION_MS;
    const old = operation("expired", workspace, expiredAt);
    const recent = Array.from({ length: 51 }, (_, index) => operation(String(index), workspace, now - index));
    await updateSavedTaskOperations(workspace, () => [old, ...recent], expiredAt);

    const loaded = await updateSavedTaskOperations(workspace, (entries) => entries, now);
    expect(loaded.map(({ id }) => id)).toEqual(recent.map(({ id }) => id));
    expect(await updateSavedTaskOperations("cloud:different-workspace", (entries) => entries, now)).toEqual([]);
    expect(await updateSavedTaskOperations(workspace, (entries) => entries, expiredAt)).toHaveLength(51);
  });

  it("retains conflict-check data and an undone status alongside concurrent additions", async () => {
    const workspace = "cloud:undo-test";
    const first = operation("first", workspace, now - 1);
    const second = operation("second", workspace, now);
    await updateSavedTaskOperations(workspace, () => [first], now);
    const [restored] = await updateSavedTaskOperations(workspace, (entries) => entries, now);
    expect(undoTaskChanges(normalizeData(after), restored.undo).tasks).toEqual(data.tasks);

    await Promise.all([
      updateSavedTaskOperations(workspace, (entries) => [second, ...entries], now),
      updateSavedTaskOperations(workspace, (entries) => entries.map((entry) =>
        entry.id === first.id ? { ...entry, undone: true } : entry), now),
    ]);
    const loaded = await updateSavedTaskOperations(workspace, (entries) => entries, now);
    expect(loaded.map(({ id, undone }) => [id, undone])).toEqual([["second", undefined], ["first", true]]);
  });
});
