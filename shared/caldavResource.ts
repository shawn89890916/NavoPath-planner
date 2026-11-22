import type { CalDavResource } from "../src/types";

export function calendarResourceForEvent(id: string): CalDavResource {
  const filename = id.replace(/[^a-zA-Z0-9_-]/g, character =>
    "_" + character.charCodeAt(0).toString(16) + "_");
  return { file: `event-${filename}.ics`, uid: `event-${id}@navopath.app` };
}

export function calendarResourceForMigratedEvent(taskId: string) {
  // Older clients kept the app-generated event ID only in the task ID.
  const original = /^migrated_event_(event_[a-z0-9]+_[a-f0-9]{0,6})_primary$/.exec(taskId);
  return original ? calendarResourceForEvent(original[1]) : undefined;
}
