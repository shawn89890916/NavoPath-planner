type CalendarAdmin = {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{ error: unknown | null }>;
  from(table: string): any;
};

export async function replaceOccurrences<Occurrence extends object>(
  admin: CalendarAdmin,
  userId: string,
  sourceId: string,
  occurrences: Occurrence[],
) {
  const { error } = await admin.rpc("replace_navopath_calendar_occurrences", {
    target_user_id: userId,
    target_source_id: sourceId,
    replacement_occurrences: occurrences,
  });
  if (error) throw error;
}

export async function removeSourceAfterInitialSyncFailure(
  admin: CalendarAdmin,
  userId: string,
  sourceId: string,
) {
  const { error } = await admin.from("navopath_calendar_sources")
    .delete()
    .eq("id", sourceId)
    .eq("user_id", userId);
  if (error) throw error;
}
