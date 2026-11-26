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

test("duration-only timeline changes carry the start and rescheduling carries the duration", () => {
  const state = emptySyncState();
  const fields = { scheduledAt: "2026-11-26T09:00", scheduledMinutes: 60 };
  applySyncSnapshot(state, "navopath", { projects: [], tasks: [entity("n1", "Task", fields)] }, "2026-11-26T00:00:00Z");
  applySyncSnapshot(state, "superproductivity", { projects: [], tasks: [entity("s1", "Task", fields)] }, "2026-11-26T00:00:01Z");
  confirmInitialSync(state, [{ kind: "task", navopathId: "n1", superproductivityId: "s1" }]);
  applySyncSnapshot(state, "superproductivity", { projects: [], tasks: [entity("s1", "Task", { ...fields, scheduledMinutes: 90 })] }, "2026-11-26T00:00:02Z");
  assert.deepEqual(buildActions(state, "navopath")[0].fields, { scheduledMinutes: 90, scheduledAt: fields.scheduledAt });
  applySyncSnapshot(state, "navopath", { projects: [], tasks: [entity("n1", "Task", { ...fields, scheduledMinutes: 90 })] }, "2026-11-26T00:00:03Z");
  assert.equal(buildActions(state, "navopath").length, 0);
  applySyncSnapshot(state, "navopath", { projects: [], tasks: [entity("n1", "Task", { scheduledAt: "2026-11-26T10:00", scheduledMinutes: 90 })] }, "2026-11-26T00:00:04Z");
  assert.deepEqual(buildActions(state, "superproductivity")[0].fields, { scheduledAt: "2026-11-26T10:00", scheduledMinutes: 90 });
});

test("a schedule conflict blocks propagation until a source is chosen", () => {
  const state = emptySyncState();
  const fields = { scheduledAt: "2026-11-26T09:00", scheduledMinutes: 60 };
  applySyncSnapshot(state, "navopath", { projects: [], tasks: [entity("n1", "Task", fields)] }, "2026-11-26T00:00:00Z");
  applySyncSnapshot(state, "superproductivity", { projects: [], tasks: [entity("s1", "Task", fields)] }, "2026-11-26T00:00:01Z");
  confirmInitialSync(state, [{ kind: "task", navopathId: "n1", superproductivityId: "s1" }]);
  applySyncSnapshot(state, "navopath", { projects: [], tasks: [entity("n1", "Task", { ...fields, scheduledAt: "2026-11-26T10:00" })] }, "2026-11-26T00:00:02Z");
  applySyncSnapshot(state, "superproductivity", { projects: [], tasks: [entity("s1", "Task", { ...fields, scheduledAt: "2026-11-26T11:00" })] }, "2026-11-26T00:00:03Z");
  assert.equal(state.conflicts.length, 1);
  assert.equal(buildActions(state, "superproductivity").length, 0);
  resolveSyncConflict(state, state.conflicts[0].id, "superproductivity");
  assert.deepEqual(buildActions(state, "navopath")[0].fields, { scheduledAt: "2026-11-26T11:00", scheduledMinutes: 60 });
});

for (const authority of ["navopath", "superproductivity"] as const) {
  test("first sync overwrite " + authority + " protects source and removes only unmatched target records", () => {
    const target = authority === "navopath" ? "superproductivity" : "navopath";
    const state = emptySyncState();
    const sourceSnapshot = { overwriteVersion: 1 as const, projects: [entity("p-source", "Source project")], tasks: [entity("source-match", "Shared", { notes: "source", scheduledAt: "2026-11-26T09:00", scheduledMinutes: 60 }), entity("source-only", "Source only")] };
    const targetSnapshot = { overwriteVersion: 1 as const, projects: [entity("p-target", "Target project")], tasks: [entity("target-match", "Shared", { notes: "target", scheduledAt: "2026-11-26T10:00", scheduledMinutes: 30 }), entity("target-only", "Target only")] };
    applySyncSnapshot(state, authority, sourceSnapshot, "2026-11-26T00:00:00Z");
    applySyncSnapshot(state, target, targetSnapshot, "2026-11-26T00:00:01Z");
    assert.equal(createInitialPreview(state).overwriteSupported, true);
    confirmInitialSync(state, [], authority === "navopath" ? "overwrite-navopath" : "overwrite-superproductivity");
    assert.deepEqual(buildActions(state, authority), []);
    const actions = buildActions(state, target);
    assert.ok(actions.some(a => a.fields.title === "Source only" && !a.deleted));
    assert.ok(actions.some(a => a.id === "target-match" && a.fields.notes === "source" && a.fields.scheduledAt === "2026-11-26T09:00"));
    assert.ok(actions.some(a => a.id === "target-only" && a.deleted));
    assert.ok(actions.some(a => a.id === "p-target" && a.deleted));
    assert.equal(actions.at(-1)?.id, "p-target");
    // A stale target snapshot must not turn discarded records into source creates.
    applySyncSnapshot(state, target, { overwriteVersion: 1, projects: [entity("p-target", "Target project")], tasks: [entity("target-match", "Shared", { notes: "target", scheduledAt: "2026-11-26T10:00", scheduledMinutes: 30 }), entity("target-only", "Target edited before deletion")] }, "2026-11-26T00:00:02Z");
    assert.deepEqual(buildActions(state, authority), []);
    assert.ok(buildActions(state, target).some(a => a.id === "target-only" && a.deleted));
    const sourceProject = actions.find(a => a.fields.title === "Source project" && !a.deleted)!;
    const sourceTask = actions.find(a => a.fields.title === "Source only" && !a.deleted)!;
    applySyncSnapshot(state, target, { overwriteVersion: 1, projects: [{ ...entity("created-project", "Source project"), syncId: sourceProject.syncId }], tasks: [{ ...entity("target-match", "Shared", { notes: "source", scheduledAt: "2026-11-26T09:00", scheduledMinutes: 60 }) }, { ...entity("created-task", "Source only"), syncId: sourceTask.syncId }] }, "2026-11-26T00:00:03Z");
    assert.ok(!buildActions(state, target).some(a => a.deleted));
    // New target tasks created after the initial overwrite still sync both ways.
    const next = structuredClone(state.latest[target]!);
    next.tasks.push(entity("new-target", "New after overwrite"));
    applySyncSnapshot(state, target, next, "2026-11-26T00:00:04Z");
    assert.ok(buildActions(state, authority).some(a => a.fields.title === "New after overwrite" && !a.deleted));
    next.tasks.push(entity("target-only", "Old target resurrected"));
    applySyncSnapshot(state, target, next, "2026-11-26T00:00:05Z");
    assert.ok(buildActions(state, target).some(a => a.id === "target-only" && a.deleted));
    assert.ok(!buildActions(state, authority).some(a => a.fields.title === "Old target resurrected"));
  });
}
test("overwrite requires upgraded clients and refuses deletion of a retained child's parent", () => {
  const state = emptySyncState();
  applySyncSnapshot(state, "navopath", { projects: [], tasks: [entity("n-child", "Shared child")] }, "2026-11-26T00:00:00Z");
  applySyncSnapshot(state, "superproductivity", { overwriteVersion: 1, projects: [], tasks: [entity("s-parent", "Target parent"), { ...entity("s-child", "Shared child"), parentId: "s-parent" }] }, "2026-11-26T00:00:01Z");
  assert.throws(() => confirmInitialSync(state, [], "overwrite-navopath"), /Update both/);
  state.latest.navopath!.overwriteVersion = 1;
  assert.throws(() => confirmInitialSync(state, [], "overwrite-navopath"), /parent of a matched task/);
  assert.deepEqual(state.canonical, {});
});
test("unmatched records carrying stale mappings still participate in a fresh pair", () => {
  const state = emptySyncState();
  applySyncSnapshot(state, "navopath", { projects: [], tasks: [{ ...entity("n1", "Local only"), syncId: "old-pair" }] }, "2026-11-26T00:00:00Z");
  applySyncSnapshot(state, "superproductivity", { projects: [], tasks: [] }, "2026-11-26T00:00:01Z");
  confirmInitialSync(state, []);
  assert.ok(buildActions(state, "superproductivity").some(a => a.fields.title === "Local only"));
});

test("target edits, deletion and unreviewed additions cannot flow back to the source during initial overwrite", () => {
  const state = emptySyncState();
  const source = { overwriteVersion: 1 as const, projects: [], tasks: [entity("n1", "Shared", { notes: "keep source" }), entity("n2", "Also shared")] };
  const target = { overwriteVersion: 1 as const, projects: [], tasks: [entity("s1", "Shared", { notes: "keep source" }), entity("s2", "Also shared")] };
  applySyncSnapshot(state, "navopath", source, "2026-11-26T00:00:00Z");
  applySyncSnapshot(state, "superproductivity", target, "2026-11-26T00:00:01Z");
  confirmInitialSync(state, [], "overwrite-navopath");
  assert.throws(() => applySyncSnapshot(state, "superproductivity", { overwriteVersion: 1, projects: [], tasks: [...target.tasks, entity("late", "Not in preview")] }, "2026-11-26T00:00:02Z"), /Target changed since overwrite preview/);
  applySyncSnapshot(state, "superproductivity", { overwriteVersion: 1, projects: [], tasks: [entity("s1", "Shared", { notes: "changed target" })] }, "2026-11-26T00:00:03Z");
  assert.deepEqual(buildActions(state, "navopath"), []);
  assert.ok(buildActions(state, "superproductivity").some(a => a.id === "s1" && a.fields.notes === "keep source"));
  assert.ok(buildActions(state, "superproductivity").some(a => a.fields.title === "Also shared" && !a.deleted));
  assert.ok(state.initialOverwrite);
});

test("fresh pairs exclude the protected SP Inbox while preserving its tasks", () => {
  const state = emptySyncState();
  applySyncSnapshot(state, "navopath", { overwriteVersion: 1, projects: [], tasks: [entity("n1", "Source")] }, "2026-11-26T00:00:00Z");
  applySyncSnapshot(state, "superproductivity", { overwriteVersion: 1, projects: [entity("INBOX_PROJECT", "Inbox"), entity("extra", "Extra")], tasks: [{ ...entity("s1", "Target task", { projectTitle: "Inbox" }), projectId: "INBOX_PROJECT" }] }, "2026-11-26T00:00:01Z");
  assert.deepEqual(createInitialPreview(state).projects.superproductivity.map(p => p.id), ["extra"]);
  assert.equal(createInitialPreview(state).tasks.superproductivity[0].fields.projectTitle, "");
  confirmInitialSync(state, [], "overwrite-navopath");
  assert.ok(buildActions(state, "superproductivity").some(a => a.id === "s1" && a.deleted));
  assert.ok(!buildActions(state, "superproductivity").some(a => a.id === "INBOX_PROJECT"));
  assert.deepEqual(buildActions(state, "navopath"), []);
});
