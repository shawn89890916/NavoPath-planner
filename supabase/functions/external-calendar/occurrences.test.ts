import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { removeSourceAfterInitialSyncFailure, replaceOccurrences } from "./occurrences.ts";

const oldOccurrence = { id: "old", source_id: "source-1", user_id: "user-1", external_uid: "old-event" };

function makeAdmin({ rpcFailure = false } = {}) {
  const state = { occurrences: [oldOccurrence], sources: ["source-1"], rpcCalls: [] as unknown[], deletes: [] as unknown[] };
  const admin = {
    async rpc(name: string, args: Record<string, unknown>) {
      state.rpcCalls.push({ name, args });
      // Model PostgreSQL function statement rollback: failed replacement leaves
      // the pre-call set intact, just as the SQL function's transaction does.
      const before = [...state.occurrences];
      state.occurrences = state.occurrences.filter((row) => row.source_id !== args.target_source_id);
      if (rpcFailure) {
        state.occurrences = before;
        return { error: new Error("insert constraint failed") };
      }
      state.occurrences.push(...(args.replacement_occurrences as Record<string, unknown>[]).map((row) => ({
        ...row,
        user_id: args.target_user_id,
        source_id: args.target_source_id,
      })));
      return { error: null };
    },
    from(table: string) {
      return {
        delete() {
          const filters: Record<string, string>[] = [];
          const builder = {
            eq(column: string, value: string) {
              filters.push({ [column]: value });
              return builder;
            },
            then(resolve: (value: { error: null }) => unknown, reject: (reason: unknown) => unknown) {
              try {
                state.deletes.push({ table, filters });
                if (table === "navopath_calendar_sources") state.sources = [];
                resolve({ error: null });
              } catch (error) { reject(error); }
            },
          };
          return builder;
        },
      };
    },
  };
  return { admin, state };
}

test("replacement sends one transactional RPC and replaces the old set", async () => {
  const { admin, state } = makeAdmin();
  const replacement = [{ external_uid: "new-event", start_at: "2026-09-26T09:00:00Z" }];
  await replaceOccurrences(admin, "user-1", "source-1", replacement);

  assert.equal(state.rpcCalls.length, 1);
  assert.deepEqual(state.rpcCalls[0], {
    name: "replace_navopath_calendar_occurrences",
    args: { target_user_id: "user-1", target_source_id: "source-1", replacement_occurrences: replacement },
  });
  assert.deepEqual(state.occurrences.map((row) => row.external_uid), ["new-event"]);
});

test("empty replacement atomically clears previous occurrences", async () => {
  const { admin, state } = makeAdmin();
  await replaceOccurrences(admin, "user-1", "source-1", []);
  assert.deepEqual(state.occurrences, []);
});

test("failed replacement propagates the RPC error and retains previous occurrences", async () => {
  const { admin, state } = makeAdmin({ rpcFailure: true });
  await assert.rejects(replaceOccurrences(admin, "user-1", "source-1", [{ external_uid: "bad" }]), /insert constraint failed/);
  assert.deepEqual(state.occurrences, [oldOccurrence]);
});

test("initial sync failure removes its newly created source", async () => {
  const { admin, state } = makeAdmin();
  await removeSourceAfterInitialSyncFailure(admin, "user-1", "source-1");
  assert.deepEqual(state.sources, []);
  assert.deepEqual(state.deletes, [{ table: "navopath_calendar_sources", filters: [{ id: "source-1" }, { user_id: "user-1" }] }]);
});

test("atomic replacement RPC validates ownership, runs delete and insert together, and is service-role only", async () => {
  const migration = await readFile(new URL("../../migrations/20260926120000_atomic_external_calendar_occurrences.sql", import.meta.url), "utf8");
  assert.match(migration, /create or replace function public\.replace_navopath_calendar_occurrences/i);
  assert.match(migration, /language plpgsql\s+security invoker/i);
  assert.match(migration, /where id = target_source_id and user_id = target_user_id/i);
  assert.ok(migration.indexOf("delete from public.navopath_calendar_occurrences") < migration.indexOf("insert into public.navopath_calendar_occurrences"));
  assert.match(migration, /revoke all on function public\.replace_navopath_calendar_occurrences\(uuid, uuid, jsonb\) from public, anon, authenticated/i);
  assert.match(migration, /grant execute on function public\.replace_navopath_calendar_occurrences\(uuid, uuid, jsonb\) to service_role/i);
});
