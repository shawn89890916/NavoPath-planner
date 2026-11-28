import { cacheEntries, cacheGet, cacheUpdate } from "./cache";
import { V2ContractError, type V2HostAdapter } from "./runtimeV2";
import type { V2Json, V2StorageRead, V2StorageResult, V2StorageWrite } from "./sdkV2";

export type VersionedRow = { revision: string; command: V2StorageWrite };
export type WireRow = { revision: unknown; value: unknown };
export interface VersionedBackend {
  read(owner: string, key: string, account: string): Promise<WireRow | null>;
  compareAndSwap(owner: string, key: string, account: string, command: V2StorageWrite): Promise<WireRow | null>;
}
type Entry = { owner: string; key: string; current: VersionedRow | null; pending?: V2StorageWrite; rejected?: V2StorageWrite };
const invalid = () => new V2ContractError("INVALID_INPUT", "Invalid versioned storage command");
const validRevision = (value: unknown): value is string => typeof value === "string" && /^[1-9][0-9]{0,18}$/.test(value) && Number.isSafeInteger(Number(value));
function json(value: unknown, depth = 0): V2Json {
  if (depth > 40) throw invalid();
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return Array.from(value, item => json(item, depth + 1));
  if (value && typeof value === "object" && [Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, json((value as Record<string, unknown>)[key], depth + 1)]));
  }
  throw invalid();
}
export function normalizeStorageCommand(command: V2StorageWrite): V2StorageWrite {
  if (!command || !/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/.test(command.operationId) ||
      (command.expectedRevision !== null && !validRevision(command.expectedRevision))) throw invalid();
  const base = { expectedRevision: command.expectedRevision, operationId: command.operationId };
  if (command.kind === "remove") return { kind: "remove", ...base };
  if (command.kind !== "set") throw invalid();
  const value = json(command.value);
  const normalized = { kind: "set" as const, ...base, value };
  if (new TextEncoder().encode(JSON.stringify(normalized)).byteLength > 900_000) throw invalid();
  return normalized;
}
function same(a?: V2StorageWrite, b?: V2StorageWrite) { return !!a && !!b && JSON.stringify(a) === JSON.stringify(b); }
function decode(row: WireRow | null): VersionedRow | null {
  if (!row) return null;
  const revision = String(row.revision);
  const value = row.value as { version?: unknown; command?: V2StorageWrite } | null;
  if (!validRevision(revision) || value?.version !== 2 || !value.command) throw new Error("Unknown versioned storage record");
  return { revision, command: normalizeStorageCommand(value.command) };
}
const readRow = (row: VersionedRow | null): V2StorageRead =>
  !row || row.command.kind === "remove" ? { status: "absent", revision: row?.revision ?? null } : { status: "value", revision: row.revision, value: row.command.value };
const readEntry = (entry: Entry | null): V2StorageRead => !entry ? { status: "unavailable" } :
  entry.pending ? { status: "pending", revision: entry.pending.expectedRevision, value: entry.pending.kind === "set" ? entry.pending.value : null } : readRow(entry.current);
export const versionedPrefix = (account: string) => "account:" + account + ":v2-storage:";
export const versionedOwner = (owner: string) => "v2:" + owner;
const localKey = (account: string, owner: string, key: string) => versionedPrefix(account) + JSON.stringify([owner, key]);
const newer = (a: VersionedRow | null, b: VersionedRow | null) => a && (!b || Number(a.revision) >= Number(b.revision)) ? a : b;
type Notify = (owner: string, key: string) => void;

async function flushOne(backend: VersionedBackend, account: string, storageKey: string, entry: Entry, current: () => boolean, notify: Notify): Promise<V2StorageResult> {
  const command = entry.pending;
  if (!command || !current()) return { status: "unavailable" };
  let row: VersionedRow | null;
  try { row = decode(await backend.compareAndSwap(versionedOwner(entry.owner), entry.key, account, command)); }
  catch { return { status: "pending", operationId: command.operationId }; }
  // A duplicate retry can observe its own committed operation; a later revision
  // never gets overwritten by a retry of an older operation.
  const committed = row && same(row.command, command);
  await cacheUpdate<Entry>(storageKey, old => {
    if (!old || !same(old.pending, command)) return old;
    return { ...old, current: newer(old.current, row), pending: undefined, rejected: committed ? undefined : command };
  });
  if (current()) notify(entry.owner, entry.key);
  return committed && row ? { status: "committed", revision: row.revision } : { status: "conflict", current: readRow(row) };
}

/** Accepted outbox entries survive plugin deactivation; replay is scoped to
 * the authenticated account and uses the original expected revision. */
export async function flushVersionedStorage(backend: VersionedBackend, account: string, current: () => boolean, notify: Notify) {
  if (account === "preview") return;
  for (const [key, entry] of await cacheEntries<Entry>(versionedPrefix(account))) {
    if (!current()) return;
    if (entry.pending) await flushOne(backend, account, key, entry, current, notify);
  }
}

export function createVersionedStorage(options: {
  account: string; owner: string; current: () => boolean; backend: VersionedBackend;
  notify: Notify; subscribe: (key: string, listener: () => void) => () => void | Promise<void>;
}): NonNullable<V2HostAdapter["storage"]> {
  const { account, owner, backend, notify, subscribe } = options;
  const check = (signal: AbortSignal) => {
    if (signal.aborted || !options.current()) throw new V2ContractError("INACTIVE", "Plugin storage activation ended");
  };
  async function read(key: string, signal: AbortSignal): Promise<V2StorageRead> {
    check(signal);
    const id = localKey(account, owner, key);
    let entry = await cacheGet<Entry>(id);
    check(signal);
    if (entry?.pending || account === "preview") return readEntry(entry ?? { owner, key, current: null });
    try {
      const remote = decode(await backend.read(versionedOwner(owner), key, account));
      check(signal);
      entry = await cacheUpdate<Entry>(id, old => old?.pending ? old : { owner, key, current: newer(old?.current ?? null, remote), rejected: old?.rejected });
    } catch { check(signal); }
    check(signal);
    return readEntry(entry);
  }
  return {
    read, subscribe,
    async write(key, input, signal) {
      check(signal);
      const command = normalizeStorageCommand(input);
      const id = localKey(account, owner, key);
      await read(key, signal);
      let result: V2StorageResult = { status: "unavailable" };
      const staged = await cacheUpdate<Entry>(id, old => {
        check(signal);
        const entry = old ?? (account === "preview" ? { owner, key, current: null } : null);
        if (!entry) return null;
        if (same(entry.current?.command, command)) {
          result = { status: "committed", revision: entry.current!.revision }; return entry;
        }
        if (entry.pending) {
          result = same(entry.pending, command) ? { status: "pending", operationId: command.operationId } : { status: "conflict", current: readEntry(entry) };
          return entry;
        }
        if (entry.rejected?.operationId === command.operationId || entry.current?.command.operationId === command.operationId ||
            (entry.current?.revision ?? null) !== command.expectedRevision) {
          result = { status: "conflict", current: readRow(entry.current) }; return entry;
        }
        if (account === "preview") {
          const revision = String(Number(entry.current?.revision ?? 0) + 1);
          result = { status: "committed", revision };
          return { owner, key, current: { revision, command } };
        }
        result = { status: "pending", operationId: command.operationId };
        return { ...entry, pending: command, rejected: undefined };
      });
      check(signal);
      if ((result as V2StorageResult).status === "pending" && staged?.pending && same(staged.pending, command)) {
        notify(owner, key);
        return flushOne(backend, account, id, staged, () => !signal.aborted && options.current(), notify);
      }
      if (account === "preview" && (result as V2StorageResult).status === "committed") notify(owner, key);
      return result;
    },
  };
}
