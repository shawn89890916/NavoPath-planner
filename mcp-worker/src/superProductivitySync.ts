export type SyncSide = "navopath" | "superproductivity";
export type InitialSyncMode = "merge" | "overwrite-navopath" | "overwrite-superproductivity";
export type SyncEntity = { id: string; syncId?: string; parentId?: string; projectId?: string; fields: Record<string, unknown> };
export type SyncSnapshot = { projects: SyncEntity[]; tasks: SyncEntity[]; overwriteVersion?: 1; hierarchyVersion?: 1 };
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
  return { projects: normalize(value.projects, "project"), tasks: normalize(value.tasks, "task"), ...(value.overwriteVersion === 1 ? { overwriteVersion: 1 as const } : {}), ...(value.hierarchyVersion === 1 ? { hierarchyVersion: 1 as const } : {}) };
}

const SP_INBOX = "INBOX_PROJECT";
const sameField = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// Existing connections can contain a tombstone for SP's non-deletable Inbox.
// Retire that mapping without emitting a deletion on either side.
function withoutInbox(snapshot: SyncSnapshot): SyncSnapshot {
  const inbox = snapshot.projects.find(item => item.id === SP_INBOX);
  const uniqueInboxTitle = inbox && !snapshot.projects.some(item => item.id !== SP_INBOX && item.fields.title === inbox.fields.title);
  return { ...snapshot, projects: snapshot.projects.filter(item => item.id !== SP_INBOX), tasks: snapshot.tasks.map(item =>
    item.projectId === SP_INBOX || (!item.projectId && inbox && uniqueInboxTitle && item.fields.projectTitle === inbox.fields.title)
      ? { ...item, fields: { ...item.fields, projectTitle: "" } } : item) };
}
function repairReservedInbox(state: SyncState) {
  const previous = state.latest.superproductivity;
  if (previous) state.latest.superproductivity = withoutInbox(previous);
  state.ignoreSpInbox = true;
  for (const [id, entry] of Object.entries(state.canonical)) {
    if (entry.kind !== "project" || entry.ids.superproductivity !== SP_INBOX) continue;
    const local = state.latest.navopath?.projects.find(item => item.id === entry.ids.navopath);
    delete state.pending[id];
    state.conflicts = state.conflicts.filter(conflict => conflict.syncId !== id);
    if (!local) { delete state.canonical[id]; continue; }
    // If a real NavoPath project was linked to Inbox, preserve it. Only create
    // its regular counterpart where doing so cannot change an overwrite source.
    entry.ids = { navopath: local.id };
    entry.fields = { ...local.fields };
    delete entry.deleted; delete entry.overwriteTarget;
    if (state.initialOverwrite?.source !== "superproductivity") state.pending[id] = { $create: "superproductivity" };
  }
}

function projectedEqual(side: SyncSide, fields: Record<string, unknown>, field: string, value: unknown) {
  if (side === "superproductivity" && field === "color" && fields[field] == null) return true;
  return sameField(value, side === "superproductivity" && field === "dueDate" && fields.scheduledAt ? null : fields[field]);
}

// Parent relationships use canonical sync IDs, never another host's local IDs.
// Keep legacy snapshots readable; only two upgraded clients participate in this field.
function hierarchyReady(state: SyncState) {
  return state.latest.navopath?.hierarchyVersion === 1 && state.latest.superproductivity?.hierarchyVersion === 1;
}
function parentLink(snapshot: SyncSnapshot | undefined, task: SyncEntity | undefined): string | null | undefined {
  if (!snapshot || snapshot.hierarchyVersion !== 1 || !task) return undefined;
  if (!task.parentId) return null;
  return snapshot.tasks.find(item => item.id === task.parentId)?.syncId;
}
function relationConflict(state: SyncState, id: string, navopath: unknown, superproductivity: unknown, timestamp: string) {
  if (!state.conflicts.some(c => c.syncId === id && c.field === "parentSyncId"))
    state.conflicts.push({ id: crypto.randomUUID(), syncId: id, kind: "task", field: "parentSyncId", navopath, superproductivity, createdAt: timestamp });
}
function observeHierarchy(state: SyncState, side: SyncSide, previous: SyncSnapshot, timestamp: string) {
  if (!hierarchyReady(state)) return;
  const current = state.latest[side]!;
  const other: SyncSide = side === "navopath" ? "superproductivity" : "navopath";
  const otherSnapshot = state.latest[other]!;
  for (const task of current.tasks) {
    const id = task.syncId;
    if (!id) continue;
    const canonical = state.canonical[id];
    if (!canonical || canonical.deleted || canonical.kind !== "task") continue;
    const value = parentLink(current, task);
    if (value === undefined || value === id) continue;
    const previousValue = parentLink(previous, previous.tasks.find(item => item.id === task.id));
    const otherValue = parentLink(otherSnapshot, otherSnapshot.tasks.find(item => item.syncId === id));
    const pending = state.pending[id] ||= {};
    if (!Object.hasOwn(canonical.fields, "parentSyncId")) {
      // Migration: existing mismatched trees require explicit review, not a silent move.
      canonical.fields.parentSyncId = value;
      if (otherValue === undefined) pending.parentSyncId = other;
      else if (value !== otherValue) relationConflict(state, id, side === "navopath" ? value : otherValue, side === "superproductivity" ? value : otherValue, timestamp);
      continue;
    }
    const expected = canonical.fields.parentSyncId;
    if (pending.parentSyncId === side && value === expected) { delete pending.parentSyncId; continue; }
    if (state.conflicts.some(c => c.syncId === id && c.field === "parentSyncId")) continue;
    if (state.initialOverwrite?.target === side || pending.parentSyncId === side && previousValue === undefined) {
      if (value !== expected) pending.parentSyncId = side;
      continue;
    }
    if (previousValue === undefined || previousValue === value || value === expected) continue;
    if (pending.parentSyncId === side) relationConflict(state, id, side === "navopath" ? value : expected, side === "superproductivity" ? value : expected, timestamp);
    else { canonical.fields.parentSyncId = value; pending.parentSyncId = other; }
  }
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
  if (hierarchyReady(state)) {
    for (const [id, entry] of Object.entries(state.canonical)) {
      if (entry.kind !== "task" || entry.deleted) continue;
      const match = matches.find(m => m.kind === "task" && m.navopathId === entry.ids.navopath && m.superproductivityId === entry.ids.superproductivity);
      const source = authority || match?.preferredSide || (entry.ids.navopath ? "navopath" : "superproductivity");
      const target: SyncSide = source === "navopath" ? "superproductivity" : "navopath";
      const parent = parentLink(state.latest[source], state.latest[source]?.tasks.find(task => task.syncId === id));
      if (parent === undefined || parent === id) continue;
      entry.fields.parentSyncId = parent;
      const targetParent = parentLink(state.latest[target], state.latest[target]?.tasks.find(task => task.syncId === id));
      if (parent !== targetParent) (state.pending[id] ||= {}).parentSyncId = target;
    }
  }
  state.status = "active"; state.baseRevision++;
  return state;
}

export function applySyncSnapshot(state: SyncState, side: SyncSide, snapshot: SyncSnapshot, timestamp: string) {
  if (state.status === "paused") return { state, assignments: [], actions: [] };
  // Migrate legacy active connections as well as first-pair previews.
  repairReservedInbox(state);
  if (side === "superproductivity") snapshot = withoutInbox(snapshot);
  if (state.status !== "active") {
    if (JSON.stringify(state.latest[side]) !== JSON.stringify(snapshot)) { state.latest[side] = snapshot; state.baseRevision++; }
    return { state, assignments: [] as Array<{ kind: "project" | "task"; id: string; syncId: string }>, actions: [] as ReturnType<typeof buildActions> };
  }
  const hierarchyWasReady = hierarchyReady(state);
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
      const acknowledgingCreate = state.pending[syncId]?.$create === side;
      if (acknowledgingCreate) delete state.pending[syncId].$create;
      if (overwritingTarget || acknowledgingCreate) {
        const pending = state.pending[syncId] ||= {};
        if (canonical.deleted) { pending.$deleted = side; continue; }
        // A created host record can exist before its second scheduling update
        // succeeds. Treat its first snapshot as acknowledgement, not a new
        // user edit. Retry all unapplied source fields without erasing them.
        for (const field of Object.keys(canonical.fields)) {
          if (field === "parentSyncId") continue;
          // SP's timed schedule and day-only due date are mutually exclusive.
          const equal = projectedEqual(side, canonical.fields, field, item.fields[field]);
          if (equal) { if (pending[field] === side) delete pending[field]; }
          else pending[field] = side;
        }
        continue;
      }
      for (const field of new Set([...Object.keys(old?.fields || {}), ...Object.keys(item.fields)])) {
        if (side === "superproductivity" && field === "scheduleBlocks") continue;
        // A timed SP task cannot express an independent NavoPath due date.
        if (side === "superproductivity" && field === "dueDate" && item.fields.scheduledAt) {
          if (state.pending[syncId]?.dueDate === side) delete state.pending[syncId].dueDate;
          continue;
        }
        const changed = JSON.stringify(old?.fields[field]) !== JSON.stringify(item.fields[field]);
        const pendingTo = state.pending[syncId]?.[field];
        if (pendingTo === side && projectedEqual(side, canonical.fields, field, item.fields[field])) { delete state.pending[syncId][field]; continue; }
        if (!changed || state.conflicts.some(c => c.syncId === syncId && c.field === field)) continue;
        if (pendingTo === side && !projectedEqual(side, canonical.fields, field, item.fields[field])) {
          state.conflicts.push({ id: crypto.randomUUID(), syncId, kind, field, navopath: side === "navopath" ? item.fields[field] : canonical.fields[field], superproductivity: side === "superproductivity" ? item.fields[field] : canonical.fields[field], createdAt: timestamp });
        } else if (!projectedEqual(side, canonical.fields, field, item.fields[field])) {
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
  observeHierarchy(state, side, previous, timestamp);
  if (!hierarchyWasReady && hierarchyReady(state)) {
    const other: SyncSide = side === "navopath" ? "superproductivity" : "navopath";
    observeHierarchy(state, other, state.latest[other]!, timestamp);
  }
  // Recover schedules that were previously acknowledged incorrectly or never
  // queued. Only retry a missing target slot when the canonical scheduled slot
  // still exists on its source; never overwrite a different explicit slot.
  const localByLink = new Map((state.latest.navopath?.tasks || []).map(item => [item.syncId,item]));
  const remoteByLink = new Map((state.latest.superproductivity?.tasks || []).map(item => [item.syncId,item]));
  for (const [syncId, entry] of Object.entries(state.canonical)) {
    if (entry.kind !== "task" || entry.deleted || !entry.fields.scheduledAt ||
        state.conflicts.some(c => c.syncId === syncId && ["scheduledAt", "scheduledMinutes", "$deleted"].includes(c.field))) continue;
    const pending = state.pending[syncId] ||= {};
    if (pending.$deleted || pending.$create) continue;
    const a = localByLink.get(syncId);
    const b = remoteByLink.get(syncId);
    if (!a || !b) continue;
    for (const [source,target,origin,destination] of [["navopath","superproductivity",a,b],["superproductivity","navopath",b,a]] as const) {
      if (state.initialOverwrite && state.initialOverwrite.source !== source) continue;
      if (sameField(origin.fields.scheduledAt, entry.fields.scheduledAt) && sameField(origin.fields.scheduledMinutes, entry.fields.scheduledMinutes) && !destination.fields.scheduledAt && !pending.scheduledAt && !pending.scheduledMinutes) {
        pending.scheduledAt = target; pending.scheduledMinutes = target;
      }
    }
  }
  if (overwritingTarget && !Object.values(state.pending).some(pending => Object.values(pending).includes(side))) delete state.initialOverwrite;
  return { state, assignments, actions: buildActions(state, side) };
}

export function buildActions(state: SyncState, side: SyncSide) {
  if (state.status === "paused") return [];
  const actions: Array<{ syncId: string; kind: "project" | "task"; id?: string; fields: Record<string, unknown>; deleted?: boolean }> = [];
  for (const [syncId, canonical] of Object.entries(state.canonical)) {
    if (canonical.kind === "project" && canonical.ids.superproductivity === SP_INBOX) continue;
    const pending = state.pending[syncId] || {};
    const current = (state.latest[side]?.[canonical.kind === "project" ? "projects" : "tasks"] || []).find(item => item.syncId === syncId);
    const targetId = current?.id || canonical.ids[side];
    const create = (pending.$create === side || (pending.$deleted === side && !canonical.deleted && !current)) && !current;
    const conflicting = new Set(state.conflicts.filter(conflict => conflict.syncId === syncId).map(conflict => conflict.field));
    const scheduleConflicted = conflicting.has("scheduledAt") || conflicting.has("scheduledMinutes");
    const isBlocked = (field: string) => conflicting.has(field) || (scheduleConflicted && (field === "scheduledAt" || field === "scheduledMinutes"));
    const fields = create ? { ...canonical.fields } : Object.fromEntries(Object.entries(canonical.fields).filter(([key]) => key !== "parentSyncId" && !isBlocked(key) && pending[key] === side && !projectedEqual(side, canonical.fields, key, current?.fields[key])));
    delete fields.parentSyncId;
    const relation = canonical.fields.parentSyncId;
    const source: SyncSide = side === "navopath" ? "superproductivity" : "navopath";
    const sourceTask = state.latest[source]?.tasks.find(item => item.syncId === syncId);
    // Never create a known child as a flat task while the peer is on the old protocol.
    if (create && canonical.kind === "task" && sourceTask?.parentId && state.latest[source]?.hierarchyVersion === 1 && (!hierarchyReady(state) || !Object.hasOwn(canonical.fields, "parentSyncId"))) continue;
    if (hierarchyReady(state) && canonical.kind === "task" && !canonical.deleted && !isBlocked("parentSyncId") &&
        (create || pending.parentSyncId === side) && Object.hasOwn(canonical.fields, "parentSyncId")) {
      if (create || parentLink(state.latest[side], current) !== relation) fields.parentSyncId = relation;
    }
    if (create && conflicting.has("parentSyncId")) continue;
    // A scheduled block is start + duration. Send both when either changes,
    // even if one field is already acknowledged, so clients never invent a default.
    if (canonical.kind === "task" && (Object.hasOwn(fields, "scheduledAt") || Object.hasOwn(fields, "scheduledMinutes"))) {
      for (const field of ["scheduledAt", "scheduledMinutes"]) if (Object.hasOwn(canonical.fields, field) && !isBlocked(field)) fields[field] = canonical.fields[field];
      // Clearing a timed SP slot must restore its independent canonical due day.
      if (side === "superproductivity" && !canonical.fields.scheduledAt && Object.hasOwn(canonical.fields, "dueDate") && !isBlocked("dueDate")) fields.dueDate = canonical.fields.dueDate;
    }
    if (create || Object.keys(fields).length || (pending.$deleted === side && canonical.deleted)) actions.push({ syncId, kind: canonical.kind, id: targetId, fields, ...(canonical.deleted ? { deleted: true } : {}) });
  }
  const order = (action: typeof actions[number]) => action.deleted ? (action.kind === "task" ? 2 : 3) : (action.kind === "project" ? 0 : 1);
  const depth = (id: string) => {
    let n = 0, parent = state.canonical[id]?.fields.parentSyncId;
    const seen = new Set([id]);
    while (typeof parent === "string" && !seen.has(parent)) { seen.add(parent); n++; parent = state.canonical[parent]?.fields.parentSyncId; }
    return n;
  };
  return actions.sort((a, b) => order(a) - order(b) ||
    (a.kind === "task" && b.kind === "task" ? (a.deleted ? depth(b.syncId) - depth(a.syncId) : depth(a.syncId) - depth(b.syncId)) : 0));
}

export function restoreSyncEntity(state: SyncState, side: SyncSide, syncId: string, localId: string) {
  const canonical = state.canonical[syncId];
  if (canonical && !canonical.deleted && canonical.ids[side] === localId && localId) return state;
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
