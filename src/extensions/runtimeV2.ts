import type {
  PluginContextV2, PluginModuleV2, V2ActivityFacts, V2ActivityQuery, V2Capability,
  V2ContributionKind, V2ContributionMap, V2Dispose, V2ErrorCode, V2ManifestContract,
  V2MetricsProvider, V2Page, V2StorageRead, V2StorageResult, V2StorageWrite,
  V2Task, V2TaskCommand, V2TaskGroup, V2TaskQuery, V2TaskResult,
} from "./sdkV2";

/** Host-only adapter. All writes must be owned by the eventual authoritative
 * host command/transport implementation; this layer never simulates cloud CAS. */
export interface V2HostAdapter {
  readonly owner: string;
  readonly language: PluginContextV2["language"];
  readonly platform: PluginContextV2["platform"];
  readonly supported: ReadonlySet<V2Capability>;
  readonly granted: ReadonlySet<V2Capability>;
  isCurrent(): boolean;
  tasks?: {
    list?(query: V2TaskQuery | undefined, signal: AbortSignal): Promise<readonly V2Task[]>;
    execute?(command: V2TaskCommand, signal: AbortSignal): Promise<V2TaskResult>;
  };
  activity?: { query(query: V2ActivityQuery, signal: AbortSignal): Promise<V2ActivityFacts> };
  storage?: {
    read(key: string, signal: AbortSignal): Promise<V2StorageRead>;
    write(key: string, command: V2StorageWrite, signal: AbortSignal): Promise<V2StorageResult>;
    subscribe(key: string, listener: () => void): V2Dispose;
  };
  contribute?<K extends V2ContributionKind>(kind: K, stableId: string, value: V2ContributionMap[K]): V2Dispose;
  toast?(message: string): void;
}
export class V2ContractError extends Error {
  constructor(readonly code: V2ErrorCode, message: string) { super(message); this.name = "V2ContractError"; }
}
const capabilities = new Set<V2Capability>([
  "tasks.read", "tasks.write", "activity.read", "storage.read", "storage.write",
  "ui.tasksGroup", "ui.workspace", "ui.planning", "ui.settings", "ui.toast", "metrics.provider",
]);
function validId(id: string) { return typeof id === "string" && /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,99}$/.test(id); }
function storageKey(key: string) {
  if (typeof key !== "string" || !key || key.length > 200 || /[\x00-\x1f]/.test(key)) {
    throw new V2ContractError("INVALID_INPUT", "Invalid storage key");
  }
  return key;
}
export function negotiateV2(manifest: V2ManifestContract, host: V2HostAdapter): readonly V2Capability[] {
  if (manifest.apiVersion !== 2) throw new V2ContractError("UNSUPPORTED_PROTOCOL", "Expected protocol 2");
  if (!Array.isArray(manifest.permissions) || new Set(manifest.permissions).size !== manifest.permissions.length) {
    throw new V2ContractError("INVALID_INPUT", "Invalid permission declaration");
  }
  for (const capability of manifest.permissions) {
    if (!capabilities.has(capability) || !host.supported.has(capability)) {
      throw new V2ContractError("UNSUPPORTED_CAPABILITY", capability);
    }
    if (!host.granted.has(capability)) throw new V2ContractError("PERMISSION_DENIED", capability);
    const adapter = capability === "tasks.read" ? host.tasks?.list
      : capability === "tasks.write" ? host.tasks?.execute
      : capability === "activity.read" ? host.activity?.query
      : capability === "storage.read" ? host.storage?.read
      : capability === "storage.write" ? host.storage?.write
      : capability === "ui.toast" ? host.toast : host.contribute;
    if (!adapter || (capability === "storage.read" && !host.storage?.subscribe)) {
      throw new V2ContractError("UNSUPPORTED_CAPABILITY", capability);
    }
  }
  return Object.freeze([...manifest.permissions]);
}
export function createV2Session(manifest: V2ManifestContract, host: V2HostAdapter) {
  const granted = negotiateV2(manifest, host);
  const controller = new AbortController();
  const cleanups = new Set<V2Dispose>();
  const contributionKeys = new Set<string>();
  let closing: Promise<void> | undefined;
  const check = (capability?: V2Capability) => {
    if (controller.signal.aborted || !host.isCurrent()) throw new V2ContractError("INACTIVE", "Plugin activation ended");
    if (capability && !granted.includes(capability)) throw new V2ContractError("PERMISSION_DENIED", capability);
  };
  const track = (cleanup: V2Dispose): V2Dispose => {
    check();
    let done = false;
    const once = async () => {
      if (done) return;
      done = true;
      cleanups.delete(once);
      await cleanup();
    };
    cleanups.add(once);
    return once;
  };
  const call = async <T>(capability: V2Capability, run: () => Promise<T>): Promise<T> => {
    check(capability);
    const value = await run();
    check(capability);
    return structuredClone(value);
  };
  const wrapPage = (page: V2Page, ensure: () => void, active: () => boolean): V2Page => ({
    id: page.id, name: page.name,
    async mount(container) {
      ensure();
      const cleanup = await page.mount(container);
      if (!active()) { if (cleanup) await cleanup(); return; }
      return cleanup ? track(cleanup) : undefined;
    },
  });
  const wrapGroup = (group: V2TaskGroup, ensure: () => void): V2TaskGroup => ({
    id: group.id, name: group.name, actions: structuredClone(group.actions),
    async resolve(candidateIds) {
      ensure();
      const allowed = new Set(candidateIds);
      const ids = await call("ui.tasksGroup", async () => group.resolve([...candidateIds]));
      ensure();
      return [...new Set(ids)].filter(id => allowed.has(id));
    },
    invoke: group.invoke ? async id => {
      ensure();
      if (!group.actions?.some(action => action.id === id)) throw new V2ContractError("INVALID_INPUT", "Unknown group action");
      await group.invoke!(id);
      ensure();
    } : undefined,
  });
  const wrapMetrics = (provider: V2MetricsProvider, ensure: () => void): V2MetricsProvider => ({
    id: provider.id, name: provider.name,
    async query(facts) {
      ensure();
      const rows = await call("metrics.provider", async () => provider.query(structuredClone(facts)));
      ensure();
      return rows;
    },
  });
  const contribute = <K extends V2ContributionKind>(kind: K, value: V2ContributionMap[K]): V2Dispose => {
    check(kind);
    if (!validId(value.id) || typeof value.name !== "string" || !value.name.trim() || value.name.length > 200) {
      throw new V2ContractError("INVALID_INPUT", "Invalid contribution");
    }
    const stableId = host.owner + ":" + kind + ":" + value.id;
    if (contributionKeys.has(stableId)) throw new V2ContractError("DUPLICATE_CONTRIBUTION", stableId);
    let registered = true;
    const active = () => registered && !controller.signal.aborted && host.isCurrent();
    const ensure = () => {
      if (!active()) throw new V2ContractError("INACTIVE", "Plugin contribution ended");
      check(kind);
    };
    const wrapped = (kind === "ui.tasksGroup" ? wrapGroup(value as V2TaskGroup, ensure)
      : kind === "metrics.provider" ? wrapMetrics(value as V2MetricsProvider, ensure)
      : wrapPage(value as V2Page, ensure, active)) as V2ContributionMap[K];
    contributionKeys.add(stableId);
    let off: V2Dispose;
    try { off = host.contribute!(kind, stableId, wrapped); }
    catch (error) { registered = false; contributionKeys.delete(stableId); throw error; }
    return track(async () => {
      registered = false;
      try { await off(); } finally { contributionKeys.delete(stableId); }
    });
  };
  const context: PluginContextV2 = Object.freeze({
    apiVersion: 2 as const, id: host.owner, language: host.language, platform: host.platform,
    capabilities: granted, signal: controller.signal, register: track,
    tasks: Object.freeze({
      list: (query?: V2TaskQuery) => call("tasks.read", () => host.tasks!.list!(structuredClone(query), controller.signal)),
      execute: (command: V2TaskCommand) => call("tasks.write", () => host.tasks!.execute!(structuredClone(command), controller.signal)),
    }),
    activity: Object.freeze({
      query: (query: V2ActivityQuery) => call("activity.read", () => host.activity!.query(structuredClone(query), controller.signal)),
    }),
    storage: Object.freeze({
      read: (key: string) => call("storage.read", () => host.storage!.read(storageKey(key), controller.signal)),
      write: (key: string, command: V2StorageWrite) => call("storage.write", () => host.storage!.write(storageKey(key), structuredClone(command), controller.signal)),
      subscribe: (key: string, listener: () => void) => {
        check("storage.read");
        return track(host.storage!.subscribe(storageKey(key), () => {
          if (!controller.signal.aborted && host.isCurrent()) listener();
        }));
      },
    }),
    ui: Object.freeze({
      registerTaskGroup: (group: V2TaskGroup) => contribute("ui.tasksGroup", group),
      registerWorkspacePage: (page: V2Page) => contribute("ui.workspace", page),
      registerPlanningView: (page: V2Page) => contribute("ui.planning", page),
      registerSettingsPage: (page: V2Page) => contribute("ui.settings", page),
      toast: (message: string) => { check("ui.toast"); host.toast!(message); },
    }),
    metrics: Object.freeze({ registerProvider: (provider: V2MetricsProvider) => contribute("metrics.provider", provider) }),
  });
  async function close(onunload?: () => void | Promise<void>) {
    if (!closing) {
      // Revoke before invoking any plugin code. Defer cleanup so re-entrant close
      // from an abort listener observes the same promise.
      closing = Promise.resolve().then(async () => {
        const errors: unknown[] = [];
        try { await onunload?.(); } catch (error) { errors.push(error); }
        for (const cleanup of [...cleanups].reverse()) {
          try { await cleanup(); } catch (error) { errors.push(error); }
        }
        if (errors.length) throw new AggregateError(errors, "Plugin cleanup failed");
      });
      controller.abort();
    }
    return closing;
  }
  return { context, close };
}
export async function activateV2(module: PluginModuleV2, manifest: V2ManifestContract, host: V2HostAdapter) {
  const session = createV2Session(manifest, host);
  try {
    const cleanup = await module.onload(session.context);
    if (cleanup) {
      if (session.context.signal.aborted || !host.isCurrent()) await cleanup();
      else session.context.register(cleanup);
    }
    if (!host.isCurrent()) throw new V2ContractError("INACTIVE", "Plugin activation ended during startup");
    return { context: session.context, dispose: () => session.close(() => module.onunload?.()) };
  } catch (error) {
    try { await session.close(() => module.onunload?.()); }
    catch (cleanup) { throw new AggregateError([error, cleanup], "Plugin activation and cleanup failed"); }
    throw error;
  }
}
