/**
 * Experimental protocol-2 contract. Production preview supports only approved
 * catalog packages requesting the implemented capabilities.
 * No host-internal types or runtime dependencies are exported from this file.
 */
export type V2Dispose = () => void | Promise<void>;
export type V2Json = null | boolean | number | string | V2Json[] | { [key: string]: V2Json };
export type V2Capability =
  | "tasks.read" | "tasks.write" | "activity.read"
  | "storage.read" | "storage.write"
  | "ui.tasksGroup" | "ui.workspace" | "ui.planning" | "ui.settings" | "ui.toast"
  | "metrics.provider";

export interface V2ManifestContract {
  readonly apiVersion: 2;
  readonly permissions: readonly V2Capability[];
}
export type V2ErrorCode = "UNSUPPORTED_PROTOCOL" | "UNSUPPORTED_CAPABILITY" |
  "PERMISSION_DENIED" | "INACTIVE" | "DUPLICATE_CONTRIBUTION" | "INVALID_INPUT";
export interface V2Task {
  readonly id: string;
  readonly title: string;
  readonly completed: boolean;
  readonly projectId?: string;
  readonly dueDate?: string;
  readonly estimateMinutes?: number;
  readonly updatedAt?: string;
}
export interface V2TaskQuery {
  readonly ids?: readonly string[];
  readonly includeCompleted?: boolean;
}
export type V2TaskCommand =
  | { readonly kind: "create"; readonly operationId: string; readonly title: string;
      readonly projectId?: string; readonly estimateMinutes?: number; readonly entityId?: string }
  | { readonly kind: "complete"; readonly operationId: string; readonly taskId: string; readonly completed: boolean; readonly expectedUpdatedAt?: string }
  | { readonly kind: "rename"; readonly operationId: string; readonly taskId: string; readonly title: string; readonly expectedUpdatedAt?: string };
export type V2TaskResult =
  /** Accepted by the core local mutation/history path; cloud sync may still be pending. */
  | { readonly status: "accepted" | "committed"; readonly task: V2Task }
  | { readonly status: "conflict" | "unavailable"; readonly message: string };
export interface V2ActivityQuery {
  /** Half-open ISO timestamp interval; actual and planned records are separate. */
  readonly from: string;
  readonly to: string;
  readonly taskIds?: readonly string[];
}
export interface V2ActivityFact {
  readonly id: string;
  readonly taskId: string;
  readonly start: string;
  readonly end: string;
  readonly minutes: number;
}
export interface V2ActivityFacts {
  readonly planned: readonly V2ActivityFact[];
  readonly actual: readonly V2ActivityFact[];
}
export type V2StorageRead =
  | { readonly status: "value"; readonly revision: string; readonly value: V2Json }
  | { readonly status: "absent"; readonly revision: string | null }
  | { readonly status: "pending"; readonly revision: string | null; readonly value: V2Json }
  | { readonly status: "unavailable" };
export type V2StorageWrite =
  | { readonly kind: "set"; readonly value: V2Json; readonly expectedRevision: string | null; readonly operationId: string }
  | { readonly kind: "remove"; readonly expectedRevision: string | null; readonly operationId: string };
export type V2StorageResult =
  | { readonly status: "committed"; readonly revision: string }
  | { readonly status: "pending"; readonly operationId: string }
  | { readonly status: "conflict"; readonly current: V2StorageRead }
  | { readonly status: "unavailable" };

export interface V2ContributionBase { readonly id: string; readonly name: string }
export interface V2TaskGroup extends V2ContributionBase {
  /** Only these existing candidate IDs are eligible; the host renders task rows. */
  resolve(candidateIds: readonly string[]): readonly string[] | Promise<readonly string[]>;
  /** Notify the host when plugin-private membership changes. */
  subscribe?(invalidate: () => void): V2Dispose;
  readonly actions?: readonly { readonly id: string; readonly label: string }[];
  invoke?(actionId: string): void | Promise<void>;
}
/** Trusted plugin DOM mount. This is deliberately not an untrusted-code sandbox. */
export interface V2Page extends V2ContributionBase {
  mount(container: HTMLElement): void | V2Dispose | Promise<void | V2Dispose>;
}
export interface V2MetricRow { readonly label: string; readonly value: number; readonly unit?: string }
export interface V2MetricsProvider extends V2ContributionBase {
  /** Host supplies already-filtered facts; providers must not start extra collectors. */
  query(facts: V2ActivityFacts): readonly V2MetricRow[] | Promise<readonly V2MetricRow[]>;
}
export interface V2ContributionMap {
  "ui.tasksGroup": V2TaskGroup;
  "ui.workspace": V2Page;
  "ui.planning": V2Page;
  "ui.settings": V2Page;
  "metrics.provider": V2MetricsProvider;
}
export type V2ContributionKind = keyof V2ContributionMap;
export interface PluginContextV2 {
  readonly apiVersion: 2;
  readonly id: string;
  readonly language: "zh" | "en";
  readonly platform: "desktop" | "web" | "mobile";
  readonly capabilities: readonly V2Capability[];
  readonly signal: AbortSignal;
  register(dispose: V2Dispose): V2Dispose;
  readonly tasks: {
    list(query?: V2TaskQuery): Promise<readonly V2Task[]>;
    execute(command: V2TaskCommand): Promise<V2TaskResult>;
  };
  readonly activity: { query(query: V2ActivityQuery): Promise<V2ActivityFacts> };
  readonly storage: {
    read(key: string): Promise<V2StorageRead>;
    write(key: string, command: V2StorageWrite): Promise<V2StorageResult>;
    subscribe(key: string, listener: () => void): V2Dispose;
  };
  readonly ui: {
    registerTaskGroup(group: V2TaskGroup): V2Dispose;
    registerWorkspacePage(page: V2Page): V2Dispose;
    registerPlanningView(page: V2Page): V2Dispose;
    registerSettingsPage(page: V2Page): V2Dispose;
    toast(message: string): void;
  };
  readonly metrics: { registerProvider(provider: V2MetricsProvider): V2Dispose };
}
export interface PluginModuleV2 {
  onload(context: PluginContextV2): void | V2Dispose | Promise<void | V2Dispose>;
  onunload?(): void | Promise<void>;
}
