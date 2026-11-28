import { describe, expect, it } from "vitest";
import { createVersionedStorage, flushVersionedStorage, type VersionedBackend, type WireRow } from "./versionedStorage";
import type { V2StorageWrite } from "./sdkV2";

function fixture(account: string) {
  const rows = new Map<string, WireRow>();
  let offline = false;
  const backend: VersionedBackend = {
    async read(owner, key, user) {
      if (offline) throw new Error("offline");
      return rows.get(JSON.stringify([user, owner, key])) ?? null;
    },
    async compareAndSwap(owner, key, user, command) {
      if (offline) throw new Error("offline");
      const id = JSON.stringify([user, owner, key]), old = rows.get(id);
      if ((old ? String(old.revision) : null) !== command.expectedRevision) return old ?? null;
      const next = { revision: Number(old?.revision ?? 0) + 1, value: { version: 2, command } };
      rows.set(id, next); return next;
    },
  };
  const signal = new AbortController().signal;
  const storage = createVersionedStorage({ account, owner: "official:reading", current: () => true, backend, notify: () => {}, subscribe: () => () => {} });
  const set = (operationId: string, expectedRevision: string | null, value: number): V2StorageWrite => ({ kind: "set", operationId, expectedRevision, value });
  return { rows, backend, signal, storage, set, offline: (value: boolean) => { offline = value; } };
}
describe("versioned plugin storage", () => {
  it("preserves tombstones and refuses a stale create", async () => {
    const f = fixture("v2-tombstone"), s = f.storage;
    expect(await s.read("book", f.signal)).toEqual({ status: "absent", revision: null });
    const create = f.set("create", null, 1);
    expect(await s.write("book", create, f.signal)).toEqual({ status: "committed", revision: "1" });
    expect(await s.write("book", create, f.signal)).toEqual({ status: "committed", revision: "1" });
    expect(await s.write("book", { kind: "remove", operationId: "delete", expectedRevision: "1" }, f.signal)).toEqual({ status: "committed", revision: "2" });
    expect(await s.read("book", f.signal)).toEqual({ status: "absent", revision: "2" });
    expect(await s.write("book", f.set("stale", null, 3), f.signal)).toEqual({ status: "conflict", current: { status: "absent", revision: "2" } });
  });
  it("retains offline writes, refuses replacement and detects remote conflict on replay", async () => {
    const f = fixture("v2-offline"), s = f.storage;
    await s.write("book", f.set("initial", null, 1), f.signal);
    f.offline(true);
    const pending = f.set("pending", "1", 2);
    expect(await s.write("book", pending, f.signal)).toEqual({ status: "pending", operationId: "pending" });
    expect(await s.write("book", f.set("other", "1", 3), f.signal)).toMatchObject({ status: "conflict", current: { status: "pending" } });
    f.offline(false);
    await f.backend.compareAndSwap("v2:official:reading", "book", "v2-offline", f.set("remote", "1", 4));
    await flushVersionedStorage(f.backend, "v2-offline", () => true, () => {});
    expect(await s.read("book", f.signal)).toEqual({ status: "value", revision: "2", value: 4 });
    expect(await s.write("book", pending, f.signal)).toMatchObject({ status: "conflict" });
    expect(await s.write("book", f.set("resolved", "2", 5), f.signal)).toEqual({ status: "committed", revision: "3" });
  });
  it("does not interpret an unknown offline account as an empty value", async () => {
    const f = fixture("v2-unknown");
    f.offline(true);
    expect(await f.storage.read("book", f.signal)).toEqual({ status: "unavailable" });
    expect(await f.storage.write("book", f.set("new", null, 1), f.signal)).toEqual({ status: "unavailable" });
    expect(f.rows.size).toBe(0);
  });
  it("isolates accounts and keys and rejects invalid revisions and non-JSON", async () => {
    const a = fixture("v2-alice"), b = fixture("v2-bob");
    await a.storage.write("book", a.set("one", null, 1), a.signal);
    expect(await b.storage.read("book", b.signal)).toEqual({ status: "absent", revision: null });
    await expect(a.storage.write("book", a.set("bad", "0", 1), a.signal)).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(a.storage.write("book", a.set("bad", "1", NaN), a.signal)).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
  it("replays an accepted offline operation after reconnect without incrementing twice", async () => {
    const f = fixture("v2-replay");
    await f.storage.read("book", f.signal);
    f.offline(true);
    const cmd = f.set("queued", null, 1);
    expect(await f.storage.write("book", cmd, f.signal)).toMatchObject({ status: "pending" });
    f.offline(false);
    await flushVersionedStorage(f.backend, "v2-replay", () => true, () => {});
    expect(await f.storage.write("book", cmd, f.signal)).toEqual({ status: "committed", revision: "1" });
  });
});
