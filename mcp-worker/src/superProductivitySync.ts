export type SyncSide = "navopath" | "superproductivity";
export type InitialSyncMode = "merge" | "overwrite-navopath" | "overwrite-superproductivity";
export type SyncEntity = { id: string; syncId?: string; parentId?: string; projectId?: string; fields: Record<string, unknown> };
export type SyncSnapshot = { projects: SyncEntity[]; tasks: SyncEntity[]; overwriteVersion?: 1 };
export type SyncConflict = { id: string; syncId: string; kind: "project" | "task"; field: string; navopath: unknown; superproductivity: unknown; createdAt: string };
type Canonical = { kind: "project" | "task"; fields: Record<string, unknown>; deleted?: boolean; overwriteTarget?: SyncSide; ids: Partial<Record<SyncSide, string>> };
export type SyncState = {
  status: "waiting" | "preview" | "active" | "paused";
  latest: Partial<Record<SyncSide, SyncSnapshot>>;
  canonical: Record<string, Canonical>;
  pending: Record<string, Record<string, SyncSide>>;
  conflicts: SyncConflict[];
  baseRevision: number;
  initialOverwrite?: { source: SyncSide; target: SyncSide };
  ignoreSpInbox?: boolean;
};
export const emptySyncState = (): SyncState => ({ status: "waiting", latest: {}, canonical: {}, pending: {}, conflicts: [], baseRevision: 0 });

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
export function normalizeSyncSnapshot(value: unknown): SyncSnapshot {
  if (!isRecord(value)) throw new Error("Invalid synchronization snapshot");
  const normalize = (input: unknown, kind: "project" | "task"): SyncEntity[] => {
    if (!Array.isArray(input) || input.length > 5000) throw new Error(`Invalid ${kind} list`);
    return input.map((item) => {
      if (!isRecord(item) || typeof item.id !== "string" || !item.id || item.id.length > 200 || !isRecord(item.fields)) throw new Error(`Invalid ${kind}`);
      const fields: Record<string, unknown> = {};
      const allowed = kind === "project" ? ["title", "color"] : ["title", "notes", "completed", "dueDate", "estimateMinutes", "projectTitle", "scheduledAt", "scheduledMinutes"];
      for (const [key, field] of Object.entries(item.fields)) {
        if (!allowed.includes(key)) continue;
        const serialized = JSON.stringify(field);
        if (key.length > 80 || serialized === undefined || serialized.length > 100_000 || (typeof field === "number" && !Number.isFinite(field))) throw new Error(`Invalid ${kind} field`);
        fields[key] = field;
      }
      return { id: item.id, ...(kind === "task" && typeof item.projectId === "string" && item.projectId.length <= 200 ? { projectId: item.projectId } : {}), ...(kind === "task" && typeof item.parentId === "string" && item.parentId.length <= 200 ? { parentId: item.parentId } : {}), ...(typeof item.syncId === "string" && item.syncId.length < 240 ? { syncId: item.syncId } : {}), fields };
    });
  };
  return { projects: normalize(value.projects, "project"), tasks: normalize(value.tasks, "task"), ...(value.overwriteVersion === 1 ? { overwriteVersion: 1 as const } : {}) };
}

const normalizeTitle = (value: unknown) => String(value || "").normalize("NFKC").trim().toLocaleLowerCase();
export function createInitialPreview(state: SyncState) {
  const navopath: SyncSnapshot = state.latest.navopath || { projects: [], tasks: [] };
  const superproductivity: SyncSnapshot = state.latest.superproductivity || { projects: [], tasks: [] };
  const candidates = (kind: "project" | "task") => {
    const left = navopath[kind === "project" ? "projects" : "tasks"];
    const right = superproductivity[kind === "project" ? "projects" : "tasks"];
    const rightByTitle = new Map<string, SyncEntity[]>();
    for (const item of right) { const title = normalizeTitle(item.fields.title); if (title) rightByTitle.set(title, [...(rightByTitle.get(title) || []), item]); }
    const leftCounts = new Map<string, number>();
    for (const item of left) { const title = normalizeTitle(item.fields.title); if (title) leftCounts.set(title, (leftCounts.get(title) || 0) + 1); }
    return { navopath: left, superproductivity: right, suggestions: left.flatMap(a => {
      const matches = rightByTitle.get(normalizeTitle(a.fields.title)) || [];
      return matches.length === 1 && leftCounts.get(normalizeTitle(a.fields.title)) === 1 ? [{ navopathId: a.id, superproductivityId: matches[0].id }] : [];
    }) };
  };
  return { status: state.status, projects: candidates("project"), tasks: candidates("task"), conflicts: state.conflicts, overwriteSupported: navopath.overwriteVersion === 1 && superproductivity.overwriteVersion === 1 };
}

export function confirmInitialSync(state: SyncState, matches: Array<{ kind: "project" | "task"; navopathId: string; superproductivityId: string; preferredSide?: SyncSide }>, mode: InitialSyncMode = "merge") {
  if (!state.latest.navopath || !state.latest.superproductivity) throw new Error("Both apps must send a snapshot before the first sync");
  if (!["merge", "overwrite-navopath", "overwrite-superproductivity"].includes(mode)) throw new Error("Invalid initial sync mode");
  const authority: SyncSide | undefined = mode === "overwrite-navopath" ? "navopath" : mode === "overwrite-superproductivity" ? "superproductivity" : undefined;
  if (authority) {
    const preview = createInitialPreview(state);
    if (!preview.overwriteSupported) throw new Error("Update both sync plugins before using overwrite");
    matches = [...preview.projects.suggestions.map(match => ({ ...match, kind: "project" as const, preferredSide: authority })), ...preview.tasks.suggestions.map(match => ({ ...match, kind: "task" as const, preferredSide: authority }))];
    for (const side of ["navopath", "superproductivity"] as const) {
      const titles = state.latest[side]!.projects.map(item => normalizeTitle(item.fields.title)).filter(Boolean);
      if (new Set(titles).size !== titles.length) throw new Error("Overwrite cannot safely map duplicate project titles. Rename duplicates or use merge.");
    }
    const target: SyncSide = authority === "navopath" ? "superproductivity" : "navopath";
    const kept = new Set(matches.filter(match => match.kind === "task").map(match => target === "navopath" ? match.navopathId : match.superproductivityId));
    // Never cascade-delete a matched child via an unmatched parent.
    const targetTasks = state.latest[target]!.tasks;
    if (targetTasks.some(task => kept.has(task.id) && task.parentId && !kept.has(task.parentId))) throw new Error("Overwrite would remove a parent of a matched task. Move that task first or use merge.");
  }
  // A fresh pair must never trust mappings from an earlier connection.
  for (const snapshot of Object.values(state.latest)) for (const item of [...snapshot.projects, ...snapshot.tasks]) delete item.syncId;
  state.canonical = {}; state.pending = {}; state.conflicts = [];
  if (authority) state.initialOverwrite = { source: authority, target: authority === "navopath" ? "superproductivity" : "navopath" };
  else delete state.initialOverwrite;
  const seen = new Set<string>();
  const matchedLeft = new Set<string>(); const matchedRight = new Set<string>();
  const leftByKind = { project: new Map(state.latest.navopath.projects.map(item => [item.id, item])), task: new Map(state.latest.navopath.tasks.map(item => [item.id, item])) };
  const rightByKind = { project: new Map(state.latest.superproductivity.projects.map(item => [item.id, item])), task: new Map(state.latest.superproductivity.tasks.map(item => [item.id, item])) };
  for (const match of matches) {
    if (!match || !["project", "task"].includes(match.kind) || (match.preferredSide !== undefined && !["navopath", "superproductivity"].includes(match.preferredSide))) throw new Error("Invalid initial match");
    const key = `${match.kind}:${match.navopathId}:${match.superproductivityId}`;
    if (seen.has(key) || matchedLeft.has(`${match.kind}:${match.navopathId}`) || matchedRight.has(`${match.kind}:${match.superproductivityId}`)) throw new Error("Duplicate initial match");
    seen.add(key); matchedLeft.add(`${match.kind}:${match.navopathId}`); matchedRight.add(`${match.kind}:${match.superproductivityId}`);
    const a = leftByKind[match.kind].get(match.navopathId);
    const b = rightByKind[match.kind].get(match.superproductivityId);
    if (!a || !b) throw new Error("Initial match references an unknown item");
    const syncId = crypto.randomUUID();
    a.syncId = b.syncId = syncId;
    const source: SyncSide = match.preferredSide || "navopath";
    const target: SyncSide = source === "navopath" ? "superproductivity" : "navopath";
    const preferred = source === "navopath" ? a : b;
    const other = source === "navopath" ? b : a;
    state.canonical[syncId] = { kind: match.kind, fields: { ...(authority ? {} : other.fields), ...preferred.fields }, ids: { navopath: a.id, superproductivity: b.id } };
    state.pending[syncId] = Object.fromEntries(Object.keys(preferred.fields).filter(key => key !== "scheduleBlocks" && JSON.stringify(preferred.fields[key]) !== JSON.stringify(other.fields[key])).map(key => [key, target]));
  }
  for (const side of ["navopath", "superproductivity"] as const) for (const kind of ["projects", "tasks"] as const) {
    for (const entity of state.latest[side]![kind]) {
      if (!entity.syncId) {
        entity.syncId = crypto.randomUUID();
        const kindName = kind === "projects" ? "project" : "task";
        const discard = Boolean(authority && side !== authority);
        state.canonical[entity.syncId] = { kind: kindName, fields: { ...entity.fields }, ids: { [side]: entity.id }, ...(discard ? { deleted: true, overwriteTarget: side } : {}) };
        state.pending[entity.syncId] = discard ? { $deleted: side } : { $create: side === "navopath" ? "superproductivity" : "navopath" };
      }
    }
  }
  state.status = "active"; state.baseRevision++;
  return state;
}

export function applySyncSnapshot(state: SyncState, side: SyncSide, snapshot: SyncSnapshot, timestamp: string) {
  if (state.status === "paused") return { state, assignments: [], actions: [] };
  // Inbox is SP's reserved fallback project, not a user project. New pairs
  // exclude it; existing active connections retain their previous mapping.
  if (side === "superproductivity" && state.status !== "active" && snapshot.overwriteVersion === 1) state.ignoreSpInbox = true;
  if (side === "superproductivity" && state.ignoreSpInbox) {
    snapshot = { ...snapshot, projects: snapshot.projects.filter(item => item.id !== "INBOX_PROJECT"), tasks: snapshot.tasks.map(item => item.projectId === "INBOX_PROJECT" ? { ...item, fields: { ...item.fields, projectTitle: "" } } : item) };
  }
  if (state.status !== "active") {
    if (JSON.stringify(state.latest[side]) !== JSON.stringify(snapshot)) { state.latest[side] = snapshot; state.baseRevision++; }
    return { state, assignments: [] as Array<{ kind: "project" | "task"; id: string; syncId: string }>, actions: [] as ReturnType<typeof buildActions> };
  }
  const previous = state.latest[side] || { projects: [], tasks: [] };
  const overwritingTarget = state.initialOverwrite?.target === side;
  if (overwritingTarget) {
    // A record created after the reviewed preview is not authorized for deletion,
    // and must not be silently imported into the authoritative workspace either.
    for (const kind of ["project", "task"] as const) {
      const key = kind === "project" ? "projects" : "tasks";
      const knownIds = new Set(Object.values(state.canonical).filter(entry => entry.kind === kind).map(entry => entry.ids[side]));
      for (const item of snapshot[key]) {
        const linked = item.syncId ? state.canonical[item.syncId] : undefined;
        if (!knownIds.has(item.id) && !(linked?.kind === kind && !linked.deleted && state.pending[item.syncId!]?.$create === side)) {
          throw new Error("Target changed since overwrite preview. Disconnect and review a new preview before importing or deleting the new records.");
        }
      }
    }
  }
  const assignments: Array<{ kind: "project" | "task"; id: string; syncId: string }> = [];
  for (const kind of ["project", "task"] as const) {
    const key = kind === "project" ? "projects" : "tasks";
    for (const item of snapshot[key]) {
      const old = previous[key].find(entry => entry.id === item.id);
      const suppliedSyncId = item.syncId;
      const discarded = Object.entries(state.canonical).find(([, entry]) => entry.overwriteTarget === side && entry.deleted && entry.kind === kind && entry.ids[side] === item.id)?.[0];
      const knownDuringOverwrite = overwritingTarget ? Object.entries(state.canonical).find(([, entry]) => entry.kind === kind && entry.ids[side] === item.id)?.[0] : undefined;
      const syncId = discarded || old?.syncId || knownDuringOverwrite || (item.syncId && state.canonical[item.syncId] && !state.canonical[item.syncId].deleted && (!state.canonical[item.syncId].ids[side] || state.canonical[item.syncId].ids[side] === item.id || state.pending[item.syncId]?.$create === side) ? item.syncId : undefined) || crypto.randomUUID(); item.syncId = syncId;
      let canonical = state.canonical[syncId];
      if (!canonical) {
        canonical = state.canonical[syncId] = { kind, fields: { ...item.fields }, ids: {} };
        state.pending[syncId] = { $create: side === "navopath" ? "superproductivity" : "navopath" };
      }
      canonical.ids[side] = item.id;
      if (suppliedSyncId !== syncId) assignments.push({ kind, id: item.id, syncId });
      if (canonical.deleted && canonical.overwriteTarget === side) {
        state.pending[syncId] = { $deleted: side }; continue;
      }
      if (state.pending[syncId]?.$create === side) delete state.pending[syncId].$create;
      if (overwritingTarget) {
        const pending = state.pending[syncId] ||= {};
        if (canonical.deleted) { pending.$deleted = side; continue; }
        // Never let the first target snapshot overwrite source values, even
        // when a matched target was edited after the confirmation.
        for (const [field, value] of Object.entries(canonical.fields)) {
          // SP's timed schedule and day-only due date are mutually exclusive.
          const projected = side === "superproductivity" && field === "dueDate" && canonical.fields.scheduledAt ? null : value;
          const equal = (side === "superproductivity" && field === "color" && value == null) || JSON.stringify(item.fields[field]) === JSON.stringify(projected);
          if (equal) { if (pending[field] === side) delete pending[field]; }
          else pending[field] = side;
        }
        continue;
      }
      for (const field of new Set([...Object.keys(old?.fields || {}), ...Object.keys(item.fields)])) {
        if (side === "superproductivity" && field === "scheduleBlocks") continue;
        const changed = JSON.stringify(old?.fields[field]) !== JSON.stringify(item.fields[field]);
        const pendingTo = state.pending[syncId]?.[field];
        if (pendingTo === side && JSON.stringify(item.fields[field]) === JSON.stringify(canonical.fields[field])) { delete state.pending[syncId][field]; continue; }
        if (!changed || state.conflicts.some(c => c.syncId === syncId && c.field === field)) continue;
        if (pendingTo === side && JSON.stringify(item.fields[field]) !== JSON.stringify(canonical.fields[field])) {
          state.conflicts.push({ id: crypto.randomUUID(), syncId, kind, field, navopath: side === "navopath" ? item.fields[field] : canonical.fields[field], superproductivity: side === "superproductivity" ? item.fields[field] : canonical.fields[field], createdAt: timestamp });
        } else if (JSON.stringify(item.fields[field]) !== JSON.stringify(canonical.fields[field])) {
          canonical.fields[field] = item.fields[field];
          state.pending[syncId] = { ...(state.pending[syncId] || {}), [field]: side === "navopath" ? "superproductivity" : "navopath" };
        }
      }
    }
  }
  for (const kind of ["project", "task"] as const) {
    const key = kind === "project" ? "projects" : "tasks";
    for (const old of previous[key]) if (!snapshot[key].some(item => item.id === old.id)) {
      const syncId = old.syncId; if (!syncId) continue;
      const canonical = state.canonical[syncId]; if (!canonical) continue;
      const pendingTo = state.pending[syncId]?.$deleted;
      const changedBeforeDelete = Object.entries(old.fields).some(([field, value]) => JSON.stringify(value) !== JSON.stringify(canonical.fields[field]));
      if (canonical.overwriteTarget === side && canonical.deleted) {
        if (state.pending[syncId]) delete state.pending[syncId].$deleted;
      } else if (overwritingTarget) {
        const pending = state.pending[syncId] ||= {};
        const replacement = snapshot[key].find(item => item.syncId === syncId);
        if (canonical.deleted) delete pending.$deleted;
        else if (!replacement) pending.$create = side;
      } else if (pendingTo === side && changedBeforeDelete) {
        state.conflicts.push({ id: crypto.randomUUID(), syncId, kind, field: "$deleted", navopath: side === "navopath" ? true : false, superproductivity: side === "superproductivity" ? true : false, createdAt: timestamp });
      } else if (pendingTo === side) {
        delete state.pending[syncId].$deleted;
      } else {
        canonical.deleted = true;
        state.pending[syncId] = { ...(state.pending[syncId] || {}), $deleted: side === "navopath" ? "superproductivity" : "navopath" };
      }
    }
  }
  state.latest[side] = snapshot; state.baseRevision++;
  if (overwritingTarget && !Object.values(state.pending).some(pending => Object.values(pending).includes(side))) delete state.initialOverwrite;
  return { state, assignments, actions: buildActions(state, side) };
}

export function buildActions(state: SyncState, side: SyncSide) {
  if (state.status === "paused") return [];
  const actions: Array<{ syncId: string; kind: "project" | "task"; id?: string; fields: Record<string, unknown>; deleted?: boolean }> = [];
  for (const [syncId, canonical] of Object.entries(state.canonical)) {
    const pending = state.pending[syncId] || {};
    const current = (state.latest[side]?.[canonical.kind === "project" ? "projects" : "tasks"] || []).find(item => item.syncId === syncId);
    const targetId = current?.id || canonical.ids[side];
    const create = (pending.$create === side || (pending.$deleted === side && !canonical.deleted && !current)) && !current;
    const conflicting = new Set(state.conflicts.filter(conflict => conflict.syncId === syncId).map(conflict => conflict.field));
    const scheduleConflicted = conflicting.has("scheduledAt") || conflicting.has("scheduledMinutes");
    const isBlocked = (field: string) => conflicting.has(field) || (scheduleConflicted && (field === "scheduledAt" || field === "scheduledMinutes"));
    const fields = create ? { ...canonical.fields } : Object.fromEntries(Object.entries(canonical.fields).filter(([key, value]) => !isBlocked(key) && pending[key] === side && JSON.stringify(state.latest[side]?.[canonical.kind === "project" ? "projects" : "tasks"].find(item => item.syncId === syncId)?.fields[key]) !== JSON.stringify(value)));
    // A scheduled block is start + duration. Send both when either changes,
    // even if one field is already acknowledged, so clients never invent a default.
    if (canonical.kind === "task" && (Object.hasOwn(fields, "scheduledAt") || Object.hasOwn(fields, "scheduledMinutes"))) {
      for (const field of ["scheduledAt", "scheduledMinutes"]) if (Object.hasOwn(canonical.fields, field) && !isBlocked(field)) fields[field] = canonical.fields[field];
    }
    if (create || Object.keys(fields).length || (pending.$deleted === side && canonical.deleted)) actions.push({ syncId, kind: canonical.kind, id: targetId, fields, ...(canonical.deleted ? { deleted: true } : {}) });
  }
  const order = (action: typeof actions[number]) => action.deleted ? (action.kind === "task" ? 2 : 3) : (action.kind === "project" ? 0 : 1);
  return actions.sort((a, b) => order(a) - order(b));
}

export function restoreSyncEntity(state: SyncState, side: SyncSide, syncId: string, localId: string) {
  const canonical = state.canonical[syncId];
  if (!canonical || !canonical.deleted || !localId || localId.length > 200) throw new Error("Deleted item cannot be restored");
  canonical.deleted = false;
  delete canonical.overwriteTarget;
  canonical.ids[side] = localId;
  state.pending[syncId] = { ...(state.pending[syncId] || {}), $deleted: side === "navopath" ? "superproductivity" : "navopath" };
  state.baseRevision++;
  return state;
}

export function resolveSyncConflict(state: SyncState, conflictId: string, chosen: SyncSide) {
  const index = state.conflicts.findIndex(item => item.id === conflictId); if (index < 0) throw new Error("Conflict not found");
  const conflict = state.conflicts[index]; const canonical = state.canonical[conflict.syncId]; if (!canonical) throw new Error("Conflict item not found");
  const value = chosen === "navopath" ? conflict.navopath : conflict.superproductivity;
  if (conflict.field === "$deleted") canonical.deleted = Boolean(value); else canonical.fields[conflict.field] = value;
  if (conflict.field === "$deleted") {
    const restoreSide = chosen;
    canonical.deleted = Boolean(value);
    state.pending[conflict.syncId] = { ...(state.pending[conflict.syncId] || {}), $deleted: restoreSide === "navopath" ? "superproductivity" : "navopath" };
  } else {
    state.pending[conflict.syncId] = { ...(state.pending[conflict.syncId] || {}), [conflict.field]: chosen === "navopath" ? "superproductivity" : "navopath" };
  }
  state.conflicts.splice(index, 1); state.baseRevision++;
  return state;
}
