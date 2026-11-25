// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";
import { applySyncSnapshot, buildActions, confirmInitialSync, createInitialPreview, emptySyncState, normalizeSyncSnapshot, resolveSyncConflict, restoreSyncEntity } from "./superProductivitySync.ts";

const entity = (id, title, fields = {}) => ({ id, fields: { title, ...fields } });

test("first sync previews both sides, suggests only unique exact titles, and confirms selected links", () => {
  const state = emptySyncState();
  applySyncSnapshot(state, "navopath", { projects: [], tasks: [entity("n1", "Task"), entity("n2", "Duplicate")] }, "2026-11-24T00:00:00Z");
  applySyncSnapshot(state, "superproductivity", { projects: [], tasks: [entity("s1", "Task"), entity("s2", "Duplicate"), entity("s3", "Duplicate")] }, "2026-11-24T00:00:01Z");
  const preview = createInitialPreview(state);
  assert.deepEqual(preview.tasks.suggestions, [{ navopathId: "n1", superproductivityId: "s1" }]);
  confirmInitialSync(state, [{ kind: "task", navopathId: "n1", superproductivityId: "s1" }]);
  assert.equal(state.status, "active");
  assert.equal(state.latest.navopath.tasks[0].syncId, state.latest.superproductivity.tasks[0].syncId);
  assert.ok(state.pending[state.latest.navopath.tasks[1].syncId].$create);
});

test("only common fields are accepted and NavoPath schedule history never enters sync state", () => {
  const snapshot = normalizeSyncSnapshot({ projects: [], tasks: [entity("n1", "Task", { priority: "high", recurrence: { frequency: "daily" }, scheduleBlocks: [{ id: "private-history" }], scheduledAt: null, scheduledMinutes: 0 })] });
  assert.deepEqual(Object.keys(snapshot.tasks[0].fields).sort(), ["scheduledAt", "scheduledMinutes", "title"]);
});

test("concurrent edits keep both values until the user resolves the conflict", () => {
  const state = emptySyncState();
  state.status = "active";
  const syncId = "sync-1";
  state.canonical[syncId] = { kind: "task", fields: { title: "Base" }, ids: { navopath: "n1", superproductivity: "s1" } };
  state.latest.navopath = { projects: [], tasks: [entity("n1", "Base", { notes: "base" })] };
  state.latest.superproductivity = { projects: [], tasks: [entity("s1", "Base", { notes: "base" })] };
  state.latest.navopath.tasks[0].syncId = syncId; state.latest.superproductivity.tasks[0].syncId = syncId;
  applySyncSnapshot(state, "navopath", { projects: [], tasks: [entity("n1", "Base", { notes: "Navo edit" })] }, "2026-11-24T00:00:00Z");
  applySyncSnapshot(state, "superproductivity", { projects: [], tasks: [entity("s1", "Base", { notes: "SP edit" })] }, "2026-11-24T00:00:01Z");
  const conflict = state.conflicts.find(item => item.field === "notes");
  assert.equal(conflict.navopath, "Navo edit"); assert.equal(conflict.superproductivity, "SP edit");
  resolveSyncConflict(state, conflict.id, "superproductivity");
  assert.equal(state.canonical[syncId].fields.notes, "SP edit");
});

test("restore clears a deletion and schedules recreation on the other app", () => {
  const state = emptySyncState(); const syncId = "sync-1";
  state.canonical[syncId] = { kind: "task", fields: { title: "Restored" }, ids: { navopath: "n1" }, deleted: true };
  restoreSyncEntity(state, "navopath", syncId, "n2");
  assert.equal(state.canonical[syncId].deleted, false);
  assert.equal(state.pending[syncId].$deleted, "superproductivity");
  assert.deepEqual(buildActions(state, "superproductivity"), [{ syncId, kind: "task", id: undefined, fields: { title: "Restored" } }]);
});

test("a propagated deletion is acknowledged when the target disappears without a conflict", () => {
  const state = emptySyncState(); state.status = "active"; const syncId = "sync-1";
  state.canonical[syncId] = { kind: "task", fields: { title: "Task" }, ids: { navopath: "n1", superproductivity: "s1" } };
  state.latest.navopath = { projects: [], tasks: [entity("n1", "Task")] }; state.latest.navopath.tasks[0].syncId = syncId;
  state.latest.superproductivity = { projects: [], tasks: [entity("s1", "Task")] }; state.latest.superproductivity.tasks[0].syncId = syncId;
  applySyncSnapshot(state, "navopath", { projects: [], tasks: [] }, "2026-11-24T00:00:00Z");
  assert.equal(buildActions(state, "superproductivity")[0].deleted, true);
  applySyncSnapshot(state, "superproductivity", { projects: [], tasks: [] }, "2026-11-24T00:00:01Z");
  assert.equal(state.canonical[syncId].deleted, true);
  assert.equal(state.pending[syncId].$deleted, undefined);
  assert.equal(state.conflicts.length, 0);
});

test("new linked records created after the first sync are created on the other side", () => {
  const state = emptySyncState(); state.status = "active";
  state.latest.navopath = { projects: [], tasks: [] }; state.latest.superproductivity = { projects: [], tasks: [] };
  const result = applySyncSnapshot(state, "navopath", { projects: [entity("new-project", "Project")], tasks: [entity("new-task", "Task")] }, "2026-11-24T00:00:00Z");
  assert.deepEqual(result.actions, []);
  assert.deepEqual(buildActions(state, "superproductivity").map(item => [item.kind, item.fields.title]), [["project", "Project"], ["task", "Task"]]);
});

test("first import allows either source for matched fields without deleting unmatched records", () => {
  const state = emptySyncState();
  applySyncSnapshot(state, "navopath", { projects: [], tasks: [entity("n1", "Task", { notes: "NavoPath", completed: true }), entity("n2", "Local only")] }, "2026-11-25T00:00:00Z");
  applySyncSnapshot(state, "superproductivity", { projects: [], tasks: [entity("s1", "Task", { notes: "SP", completed: false }), entity("s2", "SP only")] }, "2026-11-25T00:00:01Z");
  confirmInitialSync(state, [{ kind: "task", navopathId: "n1", superproductivityId: "s1", preferredSide: "superproductivity" }]);
  const id = state.latest.navopath.tasks[0].syncId;
  assert.equal(state.canonical[id].fields.notes, "SP");
  assert.equal(state.canonical[id].fields.completed, false);
  assert.equal(state.pending[id].notes, "navopath");
  assert.ok(buildActions(state, "navopath").some(action => action.fields.title === "SP only"));
  assert.ok(buildActions(state, "superproductivity").some(action => action.fields.title === "Local only"));
  assert.ok(Object.values(state.canonical).every(item => !item.deleted));
});
test("duplicate titles on either side are not proposed as one-to-one matches", () => {
  const state = emptySyncState();
  applySyncSnapshot(state, "navopath", { projects: [], tasks: [entity("n1", "Task"), entity("n2", "Task")] }, "2026-11-25T00:00:00Z");
  applySyncSnapshot(state, "superproductivity", { projects: [], tasks: [entity("s1", "Task")] }, "2026-11-25T00:00:01Z");
  assert.deepEqual(createInitialPreview(state).tasks.suggestions, []);
});
