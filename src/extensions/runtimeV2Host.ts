import type { ExtensionContribution, ExtensionHost, ExtensionPackage, ExtensionPlatform, Dispose } from "./types";
import type { PluginModuleV2, V2ContributionKind, V2Page, V2Task, V2TaskQuery } from "./sdkV2";
import { activateV2, negotiateV2, V2ContractError, type V2HostAdapter } from "./runtimeV2";
import { createResourceUrls } from "./runtime";
import { v2PreviewCapabilities, validV2PreviewPermissions } from "./v2PreviewPolicy";

export interface V2PreviewBridge {
  readonly key: string;
  readonly platform: ExtensionPlatform;
  readonly host: ExtensionHost;
  isCurrent(): boolean;
  register(kind: "views" | "settingsPages", contribution: ExtensionContribution): Dispose;
}
function listTasks(host: ExtensionHost, query?: V2TaskQuery): readonly V2Task[] {
  if (query !== undefined && (!query || typeof query !== "object" ||
    (query.ids !== undefined && (!Array.isArray(query.ids) || query.ids.some(id => typeof id !== "string"))) ||
    (query.includeCompleted !== undefined && typeof query.includeCompleted !== "boolean"))) {
    throw new V2ContractError("INVALID_INPUT", "Invalid task query");
  }
  const ids = query?.ids ? new Set(query.ids) : undefined;
  return host.getData().tasks.filter(task => (!ids || ids.has(task.id)) && (query?.includeCompleted || !task.completed))
    .map(task => ({
      id: task.id, title: task.title, completed: task.completed, projectId: task.projectId,
      dueDate: task.dueDate || undefined,
      estimateMinutes: Number.isFinite(task.estimatedHours) ? task.estimatedHours! * 60 : undefined,
    }));
}

/** Protocol 2 preview uses the real extension view registry, not native feature IDs.
 * Executable packages still run as trusted renderer code, not sandboxed code. */
export async function loadV2Preview(
  pkg: ExtensionPackage,
  bridge: V2PreviewBridge,
  importer: (url: string) => Promise<{ default?: PluginModuleV2 }> = url => import(/* @vite-ignore */ url),
) {
  if (!bridge.key.startsWith("official:") || pkg.manifest.apiVersion !== 2 ||
    bridge.key !== "official:" + pkg.manifest.id || !validV2PreviewPermissions(pkg.manifest.permissions) ||
    pkg.manifest.desktop !== undefined || pkg.manifest.styles !== undefined || pkg.manifest.mcp !== undefined ||
    pkg.manifest.settingsOptions !== undefined) {
    throw new Error("Protocol 2 preview requires an approved catalog plugin and supported permissions");
  }
  const permissions = pkg.manifest.permissions;
  const manifest = { apiVersion: 2 as const, permissions };
  const resources = createResourceUrls(pkg);
  const registered = new Set<V2ContributionKind>();
  const adapter: V2HostAdapter = {
    owner: bridge.key, platform: bridge.platform, language: bridge.host.getSettings().language,
    supported: new Set(v2PreviewCapabilities), granted: new Set(permissions), isCurrent: bridge.isCurrent,
    tasks: { list: async query => listTasks(bridge.host, query) },
    contribute(kind, id, value) {
      if (kind !== "ui.workspace" && kind !== "ui.planning" && kind !== "ui.settings") {
        throw new V2ContractError("UNSUPPORTED_CAPABILITY", kind);
      }
      if (registered.has(kind)) throw new V2ContractError("DUPLICATE_CONTRIBUTION", "Only one page per plugin and surface");
      const page = value as V2Page;
      const off = bridge.register(kind === "ui.settings" ? "settingsPages" : "views", {
        id, owner: bridge.key, name: page.name, mount: page.mount,
        ...(kind === "ui.planning" ? { planningView: true } : {}),
        ...(pkg.manifest.icon ? { iconUrl: resources.get(pkg.manifest.icon) } : {}),
      });
      registered.add(kind);
      return async () => { try { await off(); } finally { registered.delete(kind); } };
    },
    toast: message => bridge.host.toast(message),
  };
  // Check before running module top-level code, not merely before onload.
  try {
    negotiateV2(manifest, adapter);
    if (!bridge.isCurrent()) throw new V2ContractError("INACTIVE", "Workspace changed");
    const module = (await importer(resources.get(pkg.manifest.main!))).default;
    if (!module || typeof module.onload !== "function") throw new Error("Plugin must export default { onload(context) }");
    if (!bridge.isCurrent()) throw new V2ContractError("INACTIVE", "Workspace changed");
    const loaded = await activateV2(module, manifest, adapter);
    return {
      iconUrl: pkg.manifest.icon ? resources.get(pkg.manifest.icon) : undefined,
      dispose: async () => { try { await loaded.dispose(); } catch (error) { console.warn("[extensions] v2 cleanup", error); } finally { resources.dispose(); } },
      async configChanged(_config: Record<string, unknown>) { /* v2 settings API not available in this preview */ },
    };
  } catch (error) { resources.dispose(); throw error; }
}
