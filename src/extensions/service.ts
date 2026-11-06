import type { ExtensionService } from "./serviceCore";
import type { CatalogEntry, CompactPluginPlacement, ExtensionHost, ExtensionKind, ExtensionPreferences, ExtensionSnapshot } from "./types";
import { defaultExtensionPreferences } from "./packages";

// Keep executable loading, cloud transport and package management off the
// product site's and the initial workspace's critical parsing path.
let implementation: ExtensionService | undefined;
let pending: Promise<ExtensionService> | undefined;
let configureRevision = 0;
const listeners = new Set<() => void>();
let snapshot: ExtensionSnapshot = { preferences: defaultExtensionPreferences(), catalog: [], updates: {}, status: {}, busy: false, error: "", safeMode: false, settingsPages: [], views: [], launcherStatus: {} };
async function engine() {
  return implementation ?? (pending ??= import("./serviceCore").then(({ ExtensionService }) => {
    implementation = new ExtensionService();
    implementation.subscribe(() => { snapshot = implementation!.getSnapshot(); for (const listener of listeners) listener(); });
    snapshot = implementation.getSnapshot();
    return implementation;
  }));
}
export const extensionService = {
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  getSnapshot: () => snapshot,
  getPluginIcon: (key: string) => implementation?.getPluginIcon(key),
  isReady: () => implementation?.isReady() ?? false,
  configure: async (host: ExtensionHost | null) => {
    const revision = ++configureRevision;
    if (!host && !implementation && !pending) return;
    const current = await engine();
    if (revision === configureRevision) await current.configure(host);
  },
  getConfig: (key: string) => implementation?.getConfig(key) ?? {},
  getActiveThemeDescriptor: () => implementation?.getActiveThemeDescriptor(),
  saveConfig: async (key: string, patch: Record<string, unknown>) => (await engine()).saveConfig(key, patch),
  setSafeMode: async (enabled: boolean) => (await engine()).setSafeMode(enabled),
  setPreference: async (patch: Partial<ExtensionPreferences>) => (await engine()).setPreference(patch),
  setCompactPlacement: async (key: string, placement: CompactPluginPlacement, replaceKey?: string) => (await engine()).setCompactPlacement(key, placement, replaceKey),
  refreshCatalog: async () => (await engine()).refreshCatalog(),
  checkUpdates: async () => (await engine()).checkUpdates(),
  install: async (entry: CatalogEntry) => (await engine()).install(entry),
  importFile: async (file: File, kind?: ExtensionKind) => (await engine()).importFile(file, kind),
  installFromUrl: async (url: string, kind?: ExtensionKind) => (await engine()).installFromUrl(url, kind),
  toggle: async (key: string, enabled: boolean) => (await engine()).toggle(key, enabled),
  uninstall: async (key: string) => (await engine()).uninstall(key),
  rollback: async (key: string) => (await engine()).rollback(key),
  update: async (key: string) => (await engine()).update(key),
  selectTheme: async (key: string | null) => (await engine()).selectTheme(key),
  addSource: async (url: string, name?: string) => (await engine()).addSource(url, name),
  removeSource: async (id: string) => (await engine()).removeSource(id),
  executeCommand: async (id: string) => (await engine()).executeCommand(id),
};
export const areExtensionsReady = () => extensionService.isReady();
