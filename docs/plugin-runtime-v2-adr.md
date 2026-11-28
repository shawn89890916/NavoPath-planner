# Plugin Runtime 2.0 — P0 audit and proposed ADR

Status: initial source audit and proposed contract; not implemented.
Baseline: desktop-beta a97f7581557d176213b3acfce60a432cae1e72c2 (1.7.0-beta.138), inspected 2026-11-28. Rebase before product changes. Preserve existing classification and release boundaries. The public API package is already generated as @navopath/plugin-api 2.0.0; its runtime protocol is apiVersion 1. "Runtime 2.0" means the proposed runtime protocol 2, not a claim that SDK package version 2.0.0 is new.

## 1. Source inventory

Source links are repository-relative to the pinned baseline. Catalog: public/extensions/catalog.json, 25 entries (19 plugins, 6 themes). Entry files for all 19 inspected. Classification concerns where business logic lives, not market classification or author.

| Extension | Existing implementation / boundary | Proposed migration |
|---|---|---|
| Reading | community-plugins/reading/main.ts invokes registerNativeFeature; src/reading, main.tsx, service/serviceCore and MetricsInsights contain dedicated logic | First v2 pilot; task group, task link, storage, view, metrics |
| Habits | nativeFeature; main.tsx HabitCandidateCard, domain persistence and habit state | After Reading; generic task group and recurring domain facts; keep core task history |
| Engagement | nativeFeature; core feature gates and task/timeline score rendering | Generic optional annotation/metadata provider; preserve original TaskBlock styling and existing values |
| Navo AI | nativeFeature; main.tsx UI and execution gate; backend/assistant jobs require additional review | Later; narrow provider/commands and credential/job capability, not arbitrary host access |
| Desktop Widget | nativeFeature; main.tsx widget snapshots and IPC gates | Keep native window/IPC and shared timer in Core; plugin owns presentation/activation where feasible |
| Flowtime | nativeFeature; main.tsx timer feature gate | Reuse timers.registerMode and host clock; review persisted runtime migration |
| Countdown | nativeFeature; built-in reserved timer id and widget actions | Preserve baseline timer semantics, clarify provider boundary before migration |
| Cloud Drive Sync | nativeFeature; serviceCore legacy bridge migration and server-side lifecycle | Retain native credential/transport capabilities, move orchestration behind reviewed connector contract |
| List | registerNativePlanningView list | Host task renderer/interaction capabilities + independently registered view |
| Kanban | registerNativePlanningView kanban | Same, avoid duplicating drag behavior |
| Matrix | registerNativePlanningView eisenhower | Same |
| Metrics | registerNativePlanningView metrics; main.tsx gates analytics capture; src/metrics contains queries/views | Existing facts/collection boundary plus provider registration; full migration later |
| Schedule Templates | registerNativeToolPage schedule-templates | Workspace page plus reviewed schedule batch API |
| Pomodoro | substantive plugin plan, timer provider and settings; also host internal tool surface | Reuse existing provider and timer; replace internal tool-page/opening assumptions |
| Daily Overview | package logic, public collections, page/command/event registration | v1 compatibility fixture; migrate via scoped snapshots and host UI |
| Quick Capture | package logic, tasks.create, project lookup, page/settings | v1 compatibility fixture; move writes to command API |
| Class Timetable | package parser, background registration; app.getData/saveData | Calendar import/batch command, preserve fixed-course background ownership |
| Weather | package logic, storage, status, network; imports src/extensions/weatherGlyphs | SDK shared glyph resource or bundled package-owned equivalent, network permission |
| Super Productivity Sync | package logic; imports host types and pluginSurface; uses app.getData/saveData and scoped integration/commitBatch | Later, review sync direction, idempotency and rollback; no protocol rewrite in pilot |
| Six themes | graphite, linen, minimal, ocean, sage, typewriter; CSS/assets | Preserve existing declarative v1 theme contract |

13 registration-only entries, six with substantive package logic (some hybrid). No claim that the six are fully isolated. Full per-feature backend/IPC data-flow tracing for AI, widget and cloud bridge remains a migration-specific gate.

## 2. Existing architecture and reuse

Current flow: catalog/import -> packages.validateManifest/readPackage + hash -> serviceCore account/cache/preferences/reconcile -> runtime.loadPlugin (Blob URL ESM in renderer) -> PluginContext -> extension views/settings registry or nativeFeature/nativeMode -> App/PlanningView host branches. Desktop entries optionally execute in utilityProcess via electron/extension-host.cjs. Theme contract is separate.

- src/extensions/packages.ts: validates manifest, apiVersion === 1 and minimum app version, HTTPS and package structure. Keep .navopackage.json, source identity, hash and bounded package validation.
- src/extensions/serviceCore.ts: serial operation/reconcile tails, installed/removed state, cache, update/reinstall/rollback and safe mode. Enabled updates attempt activation then restore previous version on load failure. Keep these paths; add activation-scoped ownership and migration transaction boundary.
- src/extensions/runtime.ts: register(), scoped event/interval/patch cleanup, resource URLs and desktop stop. Preserve cleanup and error handling. App bridge currently exposes broad host internals.
- src/extensions/ExtensionMount.tsx: per-mount detached root, async stale cleanup and retry. Reuse for trusted legacy views. pluginSurface.ts provides Shadow DOM CSS isolation, not a security sandbox.
- src/extensions/timers.ts: registerTimerMode/advance/workMilliseconds/removal notifications; main window clock remains authoritative. No second timer.
- src/main.tsx: renderCandidateTask already shared among candidate groups; saveTaskOperation owns history for Reading task creation. Reuse these; do not clone TaskCard or task mutation logic.
- src/extensions/transport.ts: planner auth client, user-scoped table navopath_extension_values, package bucket and realtime; no new auth system.
- scripts/build-extensions.mjs, docs/plugin-development.md, integrations/navopath-plugin-api, plugin/theme templates: deterministic build, generated declarations and examples; external registry supports independent repository release artifact and checksum. Extend rather than create parallel SDK/package format.

## 3. Concrete gaps and risks

| Evidence | Gap / consequence | Proposal |
|---|---|---|
| types.ts exposes ExtensionHost, raw PlannerData and app.internal | Public contract leaks private models; broad whole-data writes | V2 DTOs, immutable snapshots, validated narrow commands with existing undo/history |
| runtime.ts collection CRUD calls host.saveData on full snapshot | Concurrent read-modify-write risk; generic CRUD does not explicitly use saveTaskOperation | command dispatcher with expected revision and operation id; preserve domain-specific validation |
| main.tsx readingEnabled, ReadingRuntimeLazy, readingCandidates, shelf owner branch; service.ts read/writeReadingLibrary; serviceCore native feature special case; MetricsInsights readingLibrary | Updating Reading requires changing Core | generic tasks.group, planning view, metrics.provider registry; remove dedicated branches only after equivalent migration |
| serviceCore bridge guard checks account/generation, not per activation; dispose guards some registrations | stale callback on same account may still hold callable APIs; raw timers/listeners cannot be guaranteed cleaned | generation + activation lease; revoke before unload; abort signal + tracked cleanup, reject stale calls |
| serviceCore getValue/writeValue/flushQueue; transport.setExtensionValue upserts one key | last-write-wins, offline unknown-vs-absent issue; queue operation id only prevents deleting newer pending item | strict read state for all v2 callers; server CAS revision and conflict response as a separate data-layer change |
| Reading prepareReadingTask links library before core task is saved | interruption may leave inert link | generic task-domain reference, host-owned recoverable idempotent command; preserve v1 history |
| packages.ts exact protocol 1; builder copies entire host types.ts and models | API package semver and runtime version conflated; no narrow stable boundary | versioned v1/v2 context factories; stable public contracts as source, generate declarations from those |
| runtime.ts dynamic import in same renderer, global document.head styles; main.tsx internal exposes window/document/plannerApi/services; electron preload exposes native bridge | permission declarations alone cannot constrain code; Shadow DOM only style isolation | explicitly trusted execution for initial pilot; v2 capability checks plus sandboxed host-rendered UI/isolated worker before arbitrary untrusted code |
| electron/extension-host.cjs utility process with Node; dedicated process and sender key, verified extraction | process isolation is not OS capability confinement; fresh extracted directories may persist (stop shown does not remove them) | disallow native entry for untrusted v2 packages; audit cleanup/retention and RPC allowlists |
| docs/plugin-development.md says device local storage for API keys | namespacing is not secure credential storage | correct guidance in implementation; broker credentials without exposing raw tokens to other plugins |
| installBytes expected hash optional for import/direct URL; hash from same source is integrity, not publisher proof | imported code is trusted user code, not safe merely because hashed | trust tier, explicit consent; publisher verification before broad marketplace execution |
| generated bundled package URL uses main/public/extensions/packages/id.navopackage.json; registry external release URL supported | mutable bundled URL complicates old hash restore; catalog/version must match fixed artifact | immutable versioned artifacts, reuse registry independent publish flow, avoid bundling optional plugin code in Core |

Static findings, not demonstrated exploits. Same-renderer code remains trusted and may bypass an SDK; do not claim sandboxing from API design. This audit has not run live cross-device, real desktop or adversarial tests. RLS policy and backend DDL are not audited here; do not assert server-side CAS exists.

## 4. Proposed ADR: incrementally evolve existing runtime

Decision: adopt additive protocol 2, keep v1 adapter and existing source-scoped owner keys. Do not rename existing SDK package solely because of this project. Separate package/API semver from runtime major. Do not change Core/Official/Community product classification. First milestone supports trusted plugin authors; preserve legacy functionality while tightening v2. The SDK contains no raw internal services, window/document, plannerApi, direct database or arbitrary IPC. DTOs and stable ids are owned by the public contract, copied/validated at the boundary. Runtime only grants declared supported capabilities. Capability checks are not an untrusted-code security boundary.

### Minimal contract sketch (proposed names, not implemented)

```ts
interface PluginContextV2 {
  readonly apiVersion: 2;
  readonly id: string; // runtime-issued source-scoped key
  readonly signal: AbortSignal; // activation lease
  readonly capabilities: readonly string[];
  readonly language: 'zh' | 'en';
  readonly platform: 'desktop' | 'web' | 'mobile';
  register(dispose: () => void | Promise<void>): () => void;
  tasks: {
    list(query?: TaskQuery): Promise<readonly TaskDTO[]>;
    execute(command: TaskCommand): Promise<TaskCommandResult>;
    subscribe(listener: (change: TaskChange) => void): Dispose;
  };
  activity: {
    query(query: ActivityQuery): Promise<ActivityFacts>;
  };
  storage: {
    read<T>(key: string): Promise<VersionedValue<T>>;
    write<T>(key: string, next: T, options: WriteOptions): Promise<WriteResult>;
    subscribe(key: string, listener: () => void): Dispose;
  };
  ui: {
    registerTaskGroup(contribution: TaskGroupContribution): Dispose;
    registerPlanningView(contribution: PlanningViewContribution): Dispose;
    registerSettingsPage(contribution: SettingsContribution): Dispose;
    toast(message: string): void;
  };
  metrics: {
    registerProvider(provider: MetricsProvider): Dispose;
  };
}
```

- Manifest supports protocol major, existing minAppVersion, capabilities and declared contributions. Keep legacy validation strict. V2 context instantiated per activation; stable contribution identity = owner + local id, not random persistent navigation identity. Dispose/revoke on disable, update, account switch and safe mode. Cleanups idempotent; stale activation cannot alter replacement.
- TaskGroupContribution returns eligible candidate IDs and a small host-rendered header/action/form contribution; host validates against current candidate set and resolves overlap deterministically, renders the canonical task rows, owns collapse/order/focus/drag. Plugin can register a full planning view through existing mount path while trusted; shared design tokens and UI primitives through host renderer, not a bundled React copy. Untrusted UI requires separate constrained renderer/RPC.
- TaskCommand uses operationId, optional expectedRevision, validated input, and a generic owner/entity reference. Host issues ownership; no plugin may impersonate another owner. Existing task/timeline execution is the source of truth. Store link on Core task or equivalent transactionally recoverable association; old Reading library-v1 links remain readable including retained history. Do not silently introduce shared schema changes; choose migration design and obtain approval before applying.
- ActivityFacts distinguish scheduled record intervals and actual tracked entries; provide existing engagement-derived accounting optionally. MetricsProvider receives current filter/range-clipped facts, returns structured rows/charts; no duplicate capture or hidden timer. Metrics-disabled core remains usable.
- VersionedValue explicitly distinguishes known absent, value, unavailable, conflict, pending. WriteOptions requires expected revision and operation id; implementation must use atomic server compare-and-set for true cross-device guarantees. A local-only comparison is not enough. Preserve v1 key values, migration journal and rollback. Backend schema changes require separate approval; until then do not expose a falsely strong sync guarantee.
- Use existing settingsOptions, page registration, timer provider and source registry. Connector/job API, arbitrary UI extensions, plugin-to-plugin messaging and native workers are deferred unless required by pilot. No new runtime libraries.

## 5. Sequencing and gates

P1a: public contract types in existing SDK generator, version negotiation and mock host. Add fixtures for v1 unchanged, unsupported version, denied capability, revoked lease, duplicate contributions and account switch. Extend generated templates and docs only as needed. Static boundary check for new v2 plugins rejects src/** imports and direct internal calls; legacy exceptions explicit. No runtime promises for unwired methods.

P1b/P2a: generic contribution registry and lifecycle lease; host Tasks rendering adapter and command dispatcher, activity/metrics read projections. Test mount/unmount, callback abort, overlapping groups, drag/history, missing optional provider and malformed input. Keep existing native gates for unmigrated plugins.

P2b: storage/recovery design, conflict tests and explicit backend/schema approval before migration. Reuse offline outbox; pending write recovery and migration idempotence. Test simultaneous devices, deletion, failed read, account swap and update rollback. Do not use production accounts to test.

P3: Reading package owns model/UI/progress and uses generic APIs. Migrate existing official:reading/library-v1 without changing key or losing associations; import/upgrade guard and fallback. Delete Reading-specific code from App/service/Metrics only when parity confirmed. Use Quick Capture or Daily Overview as second independent contract test to rule out Reading-shaped APIs.

P4/P5: per-plugin migration according to inventory, separate review for AI/Widget/Cloud bridge and native privileges. Independent versioned Reading artifact and marketplace listing through existing registry/catalog; validate new package against a fixed compatible desktop build (build once, update plugin only, prove no Core diff). Separate user-authorized publication from preflight. Secure untrusted execution before open marketplace; trust model documented.

Release: P0 documentation-only; no runtime version bump or product build needed for this record. Later product changes follow bilingual changelog, full CI, CSS and size checks, real desktop/compact/mobile validation, preserve task-block geometry and original budgets. Merge tested candidate into desktop-beta and hand off at Desktop Release Run workflow; do not dispatch release without explicit authorization.

## 6. Remaining audit work

- Inventory is based on all catalog entry files and key runtime source paths, not a full dependency graph of every imported file. Before moving AI/widget/bridge/timer implementations, trace their worker/IPC/cloud functions, shutdown and data ownership.
- Inspect migration/RLS and backend capabilities before implementing versioned cloud values. No backend changes approved or performed.
- Verify live published release/catalog status and current branch again before implementation; baseline is source snapshot only.
- Run real install/upgrade/uninstall and Windows resource measurements after P1/P2 code exists. Static audit alone does not prove release readiness.

## P2a implementation checkpoint

The preview now wires the real host view registry and read-only task projections.
Supported capabilities are explicitly bounded to tasks.read and workspace,
planning, settings pages and toast. All other operations fail at negotiation.
The existing v1 loader and native features remain unchanged. Catalog source
and package integrity checks precede activation; package execution is still
trusted renderer code. No v2 package is published yet. Legacy clients reject
unknown manifest protocols in the catalog; use a distinct compatibility
channel or another backward-compatible strategy before publishing v2.
Production Task groups, writes, activity/metrics, storage CAS, Reading
migration and security isolation remain open.

## P2b implementation checkpoint

The host now owns candidate task group rendering and deterministic membership,
using the existing TaskCard and TaskGroup. A contribution subscription can
invalidate membership; disposal releases callbacks and subscriptions.
The preview task command adapter uses existing saveTaskOperation and
setTaskCompletion, with stable owner/operation creation IDs, deletion
tombstones and local revision checks. Success is local acceptance, not a
cloud commit. Entity links and server CAS are still unavailable; the Reading
migration and independent catalog release are not complete.
