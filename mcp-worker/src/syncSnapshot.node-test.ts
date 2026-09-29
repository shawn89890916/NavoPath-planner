// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";
import { combineSyncSnapshot } from "./syncSnapshot.ts";
import { SYNC_COLLECTIONS } from "../../shared/workspaceMerge.ts";

const at = "2026-09-29T12:00:00.000Z";
const item = (id, updatedAt, title = id) => ({ id, title, createdAt: updatedAt, updatedAt });
const data = (tasks = [], deleted = {}) => Object.fromEntries([
  ...SYNC_COLLECTIONS.map((collection) => [collection, collection === "tasks" ? tasks : []]),
  ["sync", { deleted }], ["chat", []], ["savedAt", at], ["version", 1],
]);
const profile = (tasks, settings = { theme: "paper" }, deleted = {}) => ({
  data: data(tasks, deleted), settings, revision: 4, updated_at: at,
});
const file = (tasks, settings = { theme: "paper" }, deleted = {}, updatedAt = at) => ({
  version: 1, accountId: "user-1", updatedAt, data: data(tasks, deleted), settings,
});

test("keeps distinct edits and picks the newer version of the same record", () => {
  const cloud = profile([item("shared", "2026-09-29T11:00:00Z", "cloud"), item("cloud-only", at)]);
  const incoming = file([item("shared", "2026-09-29T11:30:00Z", "folder"), item("folder-only", at)]);
  const merged = combineSyncSnapshot(cloud, incoming, "user-1", at);
  assert.equal(merged.data.tasks.find((task) => task.id === "shared").title, "folder");
  assert.deepEqual(merged.data.tasks.map((task) => task.id).sort(), ["cloud-only", "folder-only", "shared"]);
  assert.equal(merged.changed, true);
});

test("tombstones keep deleted records from returning", () => {
  const cloud = profile([], { theme: "paper" }, { "tasks:removed": "2026-09-29T11:00:00Z" });
  const incoming = file([item("removed", "2026-09-29T10:00:00Z")]);
  const merged = combineSyncSnapshot(cloud, incoming, "user-1", at);
  assert.deepEqual(merged.data.tasks, []);
  assert.equal(merged.data.sync.deleted["tasks:removed"], "2026-09-29T11:00:00Z");
});

test("settings use snapshot time, repeated snapshots are idempotent, and accounts cannot mix", () => {
  const cloud = profile([], { theme: "cloud" });
  const older = file([], { theme: "older" }, {}, "2026-09-29T10:00:00Z");
  assert.equal(combineSyncSnapshot(cloud, older, "user-1", at).settings.theme, "cloud");
  const newer = file([], { theme: "newer" }, {}, "2026-09-29T13:00:00Z");
  assert.equal(combineSyncSnapshot(cloud, newer, "user-1", at).settings.theme, "newer");
  assert.equal(combineSyncSnapshot(cloud, file([]), "user-1", at).changed, false);
  assert.throws(() => combineSyncSnapshot(cloud, { ...older, accountId: "user-2" }, "user-1", at));
});
