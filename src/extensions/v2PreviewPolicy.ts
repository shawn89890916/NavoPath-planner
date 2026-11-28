import type { V2Capability } from "./sdkV2";

/** Deliberately small production preview. Do not advertise unwired capabilities. */
export const v2PreviewCapabilities: readonly V2Capability[] = Object.freeze([
  "tasks.read", "tasks.write", "activity.read", "metrics.provider", "storage.read", "storage.write", "ui.tasksGroup", "ui.workspace", "ui.planning", "ui.settings", "ui.toast",
]);
export function validV2PreviewPermissions(value: unknown): value is V2Capability[] {
  return Array.isArray(value) && value.length <= v2PreviewCapabilities.length &&
    new Set(value).size === value.length && value.every(permission => v2PreviewCapabilities.includes(permission));
}
