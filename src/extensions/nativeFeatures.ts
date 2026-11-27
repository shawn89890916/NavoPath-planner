import type { ExtensionSnapshot } from "./types";

/** Host-backed contributions use the same activation and disposal as other plugins. */
export const nativeFeatureIds: readonly string[] = ["habits", "engagement", "navo-ai", "desktop-widget", "flowtime", "countdown", "cloud-drive-sync", "reading"];
export function nativeFeatureActive(snapshot: ExtensionSnapshot, id: string): boolean {
  return !snapshot.safeMode && snapshot.preferences.installed[`official:${id}`]?.enabled === true && snapshot.nativeFeatures?.includes(id) === true;
}

export function metricsPluginActive(snapshot: ExtensionSnapshot): boolean {
  return !snapshot.safeMode && snapshot.preferences.installed["official:metrics"]?.enabled === true && snapshot.views.some(view => view.owner === "official:metrics" && view.nativeMode === "metrics");
}
