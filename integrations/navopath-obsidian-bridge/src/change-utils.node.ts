import test from "node:test";
import assert from "node:assert/strict";
import { batchWorkspaceChanges, boundedWorkspaceFragments, detectManifestChanges, eventDedupeKey, isPathWatched, isValidDeviceToken, normalizeWatchedRoots, schedulingExcerpt, workspaceChangeMetadata, type BridgeManifest, type DetectedChange } from "./change-utils.ts";

test("bounds Chinese and escaped excerpts by serialized bytes without breaking Unicode", () => {
  const fragments = Array.from({ length: 20 }, (_, index) => ({ path: `升学/资料/${index}.md`, excerpt: '截止申请😀\\"\n'.repeat(400), content_hash: "sha256:abc" }));
  const bounded = boundedWorkspaceFragments(fragments);
  assert.ok(bounded.length > 0);
  assert.ok(bounded.length < fragments.length);
  assert.ok(new TextEncoder().encode(JSON.stringify(bounded)).byteLength <= 22_000);
  for (const fragment of bounded) {
    assert.doesNotMatch(fragment.excerpt, /[\uD800-\uDFFF]/u);
    assert.ok(fragments.find((source) => source.path === fragment.path)!.excerpt.startsWith(fragment.excerpt));
  }
  assert.deepEqual(boundedWorkspaceFragments([{ path: "large".repeat(200), excerpt: "deadline", content_hash: "sha256:abc" }], 100), []);
});

test("batches long Unicode paths without dropping changes and leaves space for fragments", () => {
  const changes: DetectedChange[] = Array.from({ length: 140 }, (_, index) => ({ path: `升学/资料/${"中".repeat(480)}${index}.md`, changeType: "created", current: { hash: "a".repeat(64), mtime: 1, size: 10 } }));
  const batches = batchWorkspaceChanges(changes);
  assert.deepEqual(batches.flat(), changes);
  assert.ok(batches.length > 2);
  for (const batch of batches) {
    const fragments = boundedWorkspaceFragments(batch.slice(0, 20).map((change) => ({ path: change.path, excerpt: "截止".repeat(1800), content_hash: "sha256:abc" })));
    const payload = { changed_files: batch.map(workspaceChangeMetadata), fragments, summary: "中".repeat(650), schedule_impact: "中".repeat(100), timestamp: new Date().toISOString(), dedupe_key: "obsidian-" + "a".repeat(64) };
    assert.ok(new TextEncoder().encode(JSON.stringify(payload)).byteLength < 64_000);
  }
  assert.equal(batchWorkspaceChanges(changes.slice(0, 1)).length, 1);
  assert.deepEqual(batchWorkspaceChanges([]), []);
});

test("accepts only complete NavoPath device tokens", () => {
  assert.equal(isValidDeviceToken(`nvp_${"a".repeat(64)}`), true);
  assert.equal(isValidDeviceToken(`nvp_${"a".repeat(63)}`), false);
  assert.equal(isValidDeviceToken("nvp_not-a-token"), false);
});

test("watches only configured allowlisted folders", () => {
  const roots = ["升学/资料", "项目/NavoPath"];
  assert.equal(isPathWatched("升学/资料/申请.md", roots), true);
  assert.equal(isPathWatched("升学\\资料\\申请.md", roots), true);
  assert.equal(isPathWatched("项目/NavoPath/NavoPath.md", roots), true);
  assert.equal(isPathWatched("升学/资料备份/申请.md", roots), false);
  assert.equal(isPathWatched("日记/今天.md", roots), false);
});

test("normalizes legacy single roots and removes duplicates", () => {
  assert.deepEqual(normalizeWatchedRoots("升学\\资料"), ["升学/资料"]);
  assert.deepEqual(normalizeWatchedRoots(["升学/资料/", "升学\\资料", "项目/NavoPath"]), ["升学/资料", "项目/NavoPath"]);
});

test("detects only content changes and deletions", () => {
  const previous: BridgeManifest = {
    "升学/资料/a.md": { hash: "same", mtime: 1, size: 10 },
    "升学/资料/deleted.md": { hash: "gone", mtime: 2, size: 5 },
  };
  const current: BridgeManifest = {
    "升学/资料/a.md": { hash: "same", mtime: 99, size: 10 },
    "升学/资料/new.md": { hash: "new", mtime: 3, size: 8 },
  };
  assert.deepEqual(detectManifestChanges(previous, current).map(({ path, changeType }) => ({ path, changeType })), [
    { path: "升学/资料/deleted.md", changeType: "deleted" },
    { path: "升学/资料/new.md", changeType: "created" },
  ]);
});

test("extracts scheduling evidence instead of the whole note", () => {
  const content = `---\nstatus: active\ndue: 2026-09-01\n---\n背景材料很长。\n- [ ] 8月30日前提交推荐信\n普通说明。\n面试时间 09:30。`;
  const excerpt = schedulingExcerpt(content, 200);
  assert.match(excerpt, /due: 2026-09-01/);
  assert.match(excerpt, /提交推荐信/);
  assert.match(excerpt, /09:30/);
  assert.doesNotMatch(excerpt, /普通说明/);
});

test("dedupe key is stable for retries and changes when mtime changes", async () => {
  const change = [{ path: "升学/资料/a.md", changeType: "modified" as const, current: { hash: "abc", mtime: 10, size: 3 } }];
  assert.equal(await eventDedupeKey(change), await eventDedupeKey([...change]));
  assert.notEqual(await eventDedupeKey(change), await eventDedupeKey([{ ...change[0], current: { ...change[0].current, mtime: 11 } }]));
});
