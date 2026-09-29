/** Pure workspace merge used by the app and the remote sync bridge. */
export const SYNC_COLLECTIONS = [
  "goals", "projects", "tasks", "events", "habits", "habitDailyStates",
  "timeEntries", "longTasks", "notes", "drafts", "aiConversations",
  "aiMemories", "scheduleTemplates",
] as const;

export type SyncCollection = typeof SYNC_COLLECTIONS[number];
export type SyncItem = { id?: string; updatedAt?: string; createdAt?: string; savedAt?: string };
export type WorkspaceShape = { sync?: { deleted?: Record<string, string> } };
const COLLECTION_NAMES = new Set<string>(SYNC_COLLECTIONS);
const MAX_CLOCK_SKEW_MS = 7 * 24 * 60 * 60 * 1_000;
const MAX_TIMESTAMP_MS = Date.parse("9999-12-31T23:59:59.999Z");

export function syncItems(data: WorkspaceShape, collection: SyncCollection): SyncItem[] {
  const value = (data as Record<string, unknown>)[collection];
  return Array.isArray(value) ? value as SyncItem[] : [];
}

export function syncItemTime(item: SyncItem) {
  return Date.parse(item.updatedAt || item.createdAt || item.savedAt || "") || 0;
}

export function syncReferenceTime(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && parsed <= MAX_TIMESTAMP_MS ? parsed : Date.now();
}

export function tombstoneTime(value: unknown, referenceTime: number) {
  if (typeof value !== "string") return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && parsed <= MAX_TIMESTAMP_MS && parsed <= referenceTime + MAX_CLOCK_SKEW_MS ? parsed : null;
}

export function mergeDeleted(remote: unknown, local: unknown, referenceTime: number) {
  const merged: Record<string, string> = {};
  for (const source of [remote, local]) {
    if (!source || typeof source !== "object" || Array.isArray(source)) continue;
    for (const [key, deletedAt] of Object.entries(source)) {
      const separator = key.indexOf(":");
      if (separator <= 0 || separator === key.length - 1 || !COLLECTION_NAMES.has(key.slice(0, separator))) continue;
      const candidateTime = tombstoneTime(deletedAt, referenceTime);
      if (candidateTime === null) continue;
      const currentTime = tombstoneTime(merged[key], referenceTime);
      if (currentTime === null || candidateTime >= currentTime) merged[key] = deletedAt as string;
    }
  }
  return merged;
}

export function pruneSupersededTombstones(data: WorkspaceShape, deleted: Record<string, string>, referenceTime: number) {
  for (const collection of SYNC_COLLECTIONS) {
    for (const item of syncItems(data, collection)) {
      if (!item.id) continue;
      const key = `${collection}:${item.id}`;
      const deletedAt = tombstoneTime(deleted[key], referenceTime);
      if (deletedAt !== null && deletedAt < syncItemTime(item)) delete deleted[key];
    }
  }
}

export function mergeWorkspaceData<T extends WorkspaceShape>(remote: T, local: T, mergedAt: string): T {
  const referenceTime = syncReferenceTime(mergedAt);
  const deleted = mergeDeleted(remote.sync?.deleted, local.sync?.deleted, referenceTime);
  const merged = { ...remote, ...local, sync: { deleted } } as Record<string, unknown> & WorkspaceShape;
  for (const collection of SYNC_COLLECTIONS) {
    const byId = new Map<string, SyncItem>();
    for (const item of syncItems(remote, collection)) if (item.id) byId.set(item.id, item);
    for (const item of syncItems(local, collection)) {
      if (!item.id) continue;
      const current = byId.get(item.id);
      if (!current || syncItemTime(item) >= syncItemTime(current)) byId.set(item.id, item);
    }
    merged[collection] = Array.from(byId.values()).filter((item) => {
      const deletedAt = tombstoneTime(deleted[`${collection}:${item.id}`], referenceTime);
      return deletedAt === null || deletedAt < syncItemTime(item);
    });
  }
  pruneSupersededTombstones(merged, deleted, referenceTime);
  const localRecord = local as Record<string, unknown>;
  const remoteRecord = remote as Record<string, unknown>;
  merged.chat = localRecord.chat || remoteRecord.chat || [];
  merged.savedAt = mergedAt;
  return merged as T;
}
