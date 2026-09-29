import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { SyncBridgeStatus } from "./types";

export async function listSyncBridgeStatuses(supabase: SupabaseClient, user: User): Promise<SyncBridgeStatus[]> {
  const { data, error } = await supabase
    .from("navopath_sync_bridge_status")
    .select("device_id, device_name, folder_path, status, last_success_at, last_seen_at, error")
    .eq("user_id", user.id)
    .order("last_seen_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    deviceId: row.device_id,
    folderPath: row.folder_path,
    deviceName: row.device_name,
    status: row.status,
    lastSuccessAt: row.last_success_at ?? undefined,
    lastSeenAt: row.last_seen_at ?? undefined,
    error: row.error ?? undefined,
  }));
}
