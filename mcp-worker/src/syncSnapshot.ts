import { mergeWorkspaceData, SYNC_COLLECTIONS } from "../../shared/workspaceMerge.ts";

type Json = Record<string, any>;
export type SyncProfile = { data: Json; settings: Json; revision: number; updated_at?: string };

export function combineSyncSnapshot(profile: SyncProfile, input: Json, accountId: string, mergedAt: string) {
  if (input.version !== 1 || input.accountId !== accountId || !input.data || !Array.isArray(input.data.tasks)
    || !Array.isArray(input.data.projects) || !input.settings || typeof input.settings !== "object"
    || Array.isArray(input.settings) || typeof input.updatedAt !== "string"
    || !Number.isFinite(Date.parse(input.updatedAt))) throw new Error("Invalid NavoPath sync snapshot");
  if (SYNC_COLLECTIONS.some((collection) => input.data[collection] !== undefined && !Array.isArray(input.data[collection]))
    || (input.data.sync !== undefined && (!input.data.sync || typeof input.data.sync !== "object" || Array.isArray(input.data.sync)))) {
    throw new Error("Invalid NavoPath sync collections");
  }

  // The current cloud record wins an exact timestamp tie. Distinct newer records
  // and deletion tombstones survive through the app's shared merge algorithm.
  const data = mergeWorkspaceData(input.data, profile.data, mergedAt);
  const cloudUpdatedAt = Date.parse(profile.updated_at || profile.data.savedAt || "") || 0;
  const settings = Date.parse(input.updatedAt) > cloudUpdatedAt ? input.settings : profile.settings;
  const withoutSaveTime = (value: Json) => { const { savedAt: _savedAt, ...rest } = value; return JSON.stringify(rest); };
  const changed = withoutSaveTime(data) !== withoutSaveTime(profile.data)
    || JSON.stringify(settings) !== JSON.stringify(profile.settings);
  return { data, settings, changed };
}
