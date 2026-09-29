import type { PlannerData } from "./types";
import { normalizeData } from "./browserFallback";
import {
  SYNC_COLLECTIONS, mergeDeleted, mergeWorkspaceData, pruneSupersededTombstones,
  syncItems, syncReferenceTime, tombstoneTime,
} from "../shared/workspaceMerge";

export { SYNC_COLLECTIONS };

export function withDeletionTombstones(
  previous: PlannerData | null,
  next: PlannerData,
  deletedAt = new Date().toISOString(),
): PlannerData {
  const deletionTime = syncReferenceTime(deletedAt);
  const effectiveDeletedAt = new Date(deletionTime).toISOString();
  const deleted = mergeDeleted(previous?.sync?.deleted, next.sync?.deleted, deletionTime);
  if (previous) {
    for (const collection of SYNC_COLLECTIONS) {
      const nextIds = new Set(syncItems(next, collection).map((item) => item.id).filter(Boolean));
      for (const item of syncItems(previous, collection)) {
        if (!item.id || nextIds.has(item.id)) continue;
        const key = `${collection}:${item.id}`;
        const existingTime = tombstoneTime(deleted[key], deletionTime);
        if (existingTime === null || deletionTime >= existingTime) deleted[key] = effectiveDeletedAt;
      }
    }
  }
  pruneSupersededTombstones(next, deleted, deletionTime);
  if (!previous && Object.keys(deleted).length === 0 && !next.sync) return next;
  return { ...next, sync: { deleted } };
}

export function preparePlannerDataRestore(
  data: PlannerData,
  previous: PlannerData | null = null,
  restoredAt = new Date().toISOString(),
): PlannerData {
  let restoredTime = syncReferenceTime(restoredAt);
  const deleted = mergeDeleted(previous?.sync?.deleted, data.sync?.deleted, restoredTime);
  for (const deletedAt of Object.values(deleted)) {
    const deletedTime = tombstoneTime(deletedAt, restoredTime);
    if (deletedTime !== null) restoredTime = Math.max(restoredTime, deletedTime + 1);
  }
  const effectiveRestoredAt = new Date(restoredTime).toISOString();
  const restored: any = { ...data };
  for (const collection of SYNC_COLLECTIONS) {
    restored[collection] = syncItems(data, collection).map((item) => ({
      ...item,
      updatedAt: effectiveRestoredAt,
    }));
  }
  return normalizeData(restored);
}

export function mergePlannerData(
  remote: PlannerData,
  local: PlannerData,
  mergedAt = new Date().toISOString(),
): PlannerData {
  return normalizeData(mergeWorkspaceData(remote, local, mergedAt));
}
