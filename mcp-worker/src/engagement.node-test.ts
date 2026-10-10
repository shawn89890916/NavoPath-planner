// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";
import { listEngagement, setEngagement } from "./engagement.ts";
import { batchUpdateTasks, normalizeTaskOperations, previewTaskOperations, undoChange } from "./cloudAssistant.ts";

function task(overrides = {}) {
  return { id: "task-1", title: "Test task", projectId: "project-1", completed: false, engagement: 20, estimatedHours: 1,
    timelineRecords: [
      { id: "first", taskId: "task-1", scheduledDate: "2026-10-09", scheduledStart: "23:00", scheduledEndDate: "2026-10-10", scheduledEnd: "01:00", executionStatus: "completed", engagement: 50 },
      { id: "second", taskId: "task-1", scheduledDate: "2026-10-10", scheduledStart: "09:00", scheduledEnd: "10:00", executionStatus: "completed" },
      { id: "future", taskId: "task-1", scheduledDate: "2026-10-11", scheduledStart: "09:00", scheduledEnd: "10:00", executionStatus: "scheduled" },
    ], ...overrides };
}

test("engagement uses each execution's rating and a default of 80, never the task fallback", () => {
  const value = listEngagement([task()], true);
  assert.deepEqual(value.entries.map((entry) => [entry.recordId, entry.engagement, entry.durationMinutes, entry.engagedMinutes]), [["first", 50, 120, 60], ["second", 80, 60, 48]]);
  assert.deepEqual(value.summary, { executions: 2, explicitlyRated: 1, durationMinutes: 180, engagedMinutes: 108, statisticsMinutes: 108, durationWeightedEngagement: 60 });
});

test("disabled engagement preserves saved ratings and reports raw statistics duration", () => {
  const value = listEngagement([task()], false);
  assert.equal(value.enabled, false);
  assert.equal(value.summary.statisticsMinutes, 180);
  assert.equal(value.entries[0].engagement, 50);
  assert.equal(value.entries[0].statisticsMinutes, 120);
});

test("filters by execution start date and project, and summarizes before pagination", () => {
  const value = listEngagement([task(), task({ id: "other", projectId: "other" })], true, { projectId: "project-1", from: "2026-10-09", to: "2026-10-10", limit: 1 });
  assert.equal(value.entries.length, 1);
  assert.equal(value.entries[0].durationMinutes, 120);
  assert.equal(value.summary.executions, 2);
  assert.equal(value.nextOffset, 1);
  assert.equal(listEngagement([task()], true, { from: "2026-10-10", to: "2026-10-10" }).entries[0].recordId, "second");
  assert.equal(listEngagement([task()], true, { offset: 1, limit: 1 }).nextOffset, null);
  assert.throws(() => listEngagement([task()], true, { from: "2026-10-11", to: "2026-10-09" }), /from/);
});

test("supports completed tasks without records and all-day executions without inventing a date", () => {
  const undated = task({ completed: true, timelineRecords: [], engagement: 70 });
  assert.equal(listEngagement([undated], true).entries[0].engagedMinutes, 42);
  assert.equal(listEngagement([undated], true, { from: "2026-10-09" }).summary.executions, 0);
  assert.equal(listEngagement([task({ timelineRecords: [{ ...task().timelineRecords[0], scheduledStart: "", scheduledEnd: "" }] })], true).entries[0].durationMinutes, 60);
  assert.deepEqual(setEngagement(undated, 90), { engagement: 90 });
});

test("rating one execution preserves siblings, task fallback and original data", () => {
  const original = task();
  const preview = previewTaskOperations({ tasks: [original] }, [{ type: "set_engagement", taskId: "task-1", recordId: "first", engagement: 70 }]);
  assert.equal(preview.data.tasks[0].timelineRecords[0].engagement, 70);
  assert.equal(preview.data.tasks[0].timelineRecords[1].engagement, undefined);
  assert.equal(preview.data.tasks[0].engagement, 20);
  assert.equal(original.timelineRecords[0].engagement, 50);
  assert.deepEqual(preview.inverseOperations, [{ type: "restore_task", taskId: "task-1", task: original }]);
});

test("rejects missing or foreign record IDs, incomplete executions and unsupported scores", () => {
  assert.throws(() => setEngagement(task(), 70), /recordId is required/);
  assert.throws(() => setEngagement(task(), 70, "another-task-record"), /not found/);
  assert.throws(() => setEngagement(task(), 70, "future"), /completed/);
  assert.throws(() => setEngagement(task({ timelineRecords: [] }), 70), /completed/);
  for (const score of [0, 9, 33, 101, NaN, "70"]) {
    assert.throws(() => normalizeTaskOperations([{ type: "set_engagement", taskId: "task-1", engagement: score }]), /10–100/);
  }
  assert.equal(listEngagement([task({ completed: true })], true).summary.executions, 3);
  assert.equal(listEngagement([task({ completed: true, timelineRecords: [{ ...task().timelineRecords[0], executionStatus: "cancelled" }] })], true).summary.executions, 0);
});

test("engagement commit and undo reuse the authenticated caller, revision, idempotency and audit RPCs", async () => {
  const originalFetch = globalThis.fetch;
  const original = task();
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), body: init?.body ? JSON.parse(init.body) : null });
    if (String(url).includes("dayflow_profiles?")) return Response.json([{ data: { tasks: [original] }, settings: {}, revision: 5 }]);
    if (String(url).includes("navopath_cloud_change_sets?")) return Response.json([{ id: "change-1", status: "applied", applied_revision: 5, undo_expires_at: new Date(Date.now() + 60000).toISOString(), inverse_operations: [{ type: "restore_task", taskId: original.id, task: original }] }]);
    return Response.json([{ id: "change-1" }]);
  };
  try {
    const env = { SUPABASE_URL: "https://example.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "test-only" };
    const outcome = await batchUpdateTasks(env, "verified-caller", { operations: [{ type: "set_engagement", taskId: "task-1", recordId: "first", engagement: 90, user_id: "attacker" }], dryRun: false, commit: true, idempotencyKey: "test-engagement-1", source: "mcp" });
    assert.equal(outcome.applied, true);
    assert.match(calls[0].url, /user_id=eq.verified-caller/);
    assert.equal(calls[1].body.target_user_id, "verified-caller");
    assert.equal(calls[1].body.expected_revision, 5);
    assert.equal(calls[1].body.next_idempotency_key, "test-engagement-1");
    assert.equal(calls[1].body.next_data.tasks[0].timelineRecords[0].engagement, 90);
    assert.equal(calls[1].body.next_inverse_operations[0].task.timelineRecords[0].engagement, 50);
    await undoChange(env, "verified-caller", "change-1");
    assert.equal(calls.at(-1).body.target_user_id, "verified-caller");
    assert.deepEqual(calls.at(-1).body.next_data.tasks[0], original);
  } finally { globalThis.fetch = originalFetch; }
});
