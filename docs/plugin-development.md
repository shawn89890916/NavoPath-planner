# NavoPath community plugin and theme development

NavoPath API v1 loads installable packages on desktop, web and mobile. The
combined public reference for plugin API, design standards, publishing and MCP
is available at `/plugin-guide` and `/plugin-guidelines`. Start
with `integrations/navopath-plugin-template` or
`integrations/navopath-theme-template`; both include an MIT license and an
`AGENT-PROMPT.md` that can be handed to a coding assistant. You can install a
package directly from a file, add a catalog URL, or submit it to the official
community catalog through a pull request.

## Package contract

A `.navopackage.json` is UTF-8 JSON with `{ manifest, files }`.

```json
{
  "manifest": {
    "kind": "plugin", "apiVersion": 1, "id": "my-plugin",
    "name": "My plugin", "description": "What it does", "author": "You",
    "version": "1.0.0", "minAppVersion": "1.5.0",
    "platforms": ["desktop", "web", "mobile"], "main": "main.js"
  },
  "files": {
    "main.js": { "encoding": "utf8", "data": "export default { onload(ctx) {} };" }
  }
}
```

Use the manifest `version` as the release version. Choose the value before
packaging; bump it for every published change using `MAJOR.MINOR.PATCH` (a
pre-release suffix such as `1.2.0-beta.1` is allowed). The installed app checks
this value against the catalog and offers an update when it increases.

### Plugin presentation standard

- Keep `description` short, specific and action-oriented. Explain what the
  plugin adds and mention external services or data use.
- A plugin may include `icon: "icon.svg"` and the SVG in `files`. Use a square
  `viewBox="0 0 24 24"`, one-color strokes/fills with `currentColor`, no text,
  scripts, remote references or background. When no icon is provided, NavoPath
  uses the plugin name's first letter.
- Prefer manifest `settingsOptions` for simple, non-secret preferences on NavoPath
  1.7.0-beta.109 or newer (set `minAppVersion` accordingly). The host renders them
  below the installed plugin using native settings controls, theme, spacing and
  reset behavior. Supported kinds are boolean, number, string, color and select;
  keys are saved through the existing plugin configuration store. Read them with
  `settings.get()`, using the declared default if the key has not been saved.
  For example: `"settingsOptions": [{ "key": "compact", "label": "Compact display", "type": "boolean", "default": false }]`.
  Number options can specify min, max and step; select options specify choices
  as value/label pairs. Do not declare API keys, passwords or access tokens here.
- Use `settings.registerPage` for complex workflows or older clients. The
  contribution still uses the host's scrollable settings surface and theme
  tokens; do not build nested card containers for ordinary controls. Every
  installed plugin without configurable options still has its details action.
- Register a workspace tool once with `ui.registerPage(name, mount)`. NavoPath
  renders its launcher in the header or dock and gives the content one scrollable
  page. The same mount works in both orientations. The portrait More menu is a
  small launcher menu anchored above the last dock button.
- Use `ui.setLauncherStatus({ label, weather?, active? })` after registering a
  page to update its accessible label, an optional weather symbol, or an activity
  indicator. The host creates the button and handles opening, closing and selection.
- Use `ui.registerPlanningView(name, mount)` for a view in the Tasks menu. The
  host mounts planning content in the task region next to the timeline.

Catalog entries may include `downloads` (non-negative integer) and
`publishedAt` (ISO 8601 date) from a real release/statistics source. The market
shows “Unavailable” when a source does not provide a value; do not estimate or
invent counts. Independent catalog entries can include `iconUrl` for a public
HTTPS copy of the packaged SVG.

Each file uses `encoding: "utf8"` for source/text or `"base64"` for binary
assets, with its content in `data`. Use safe package-relative paths. The
optional `styles` manifest field points to bundled CSS. `desktop` may declare
a desktop-only entry; make unsupported platforms explicit in `platforms`.

Plugins export a default object containing `onload(ctx)`, optional `onunload()`
and `onSettingsChange(settings)`. An onload may return a cleanup function.
The entry point must be self-contained ESM: bundle external imports with
esbuild or another bundler. Do not package the NavoPath application, React,
node_modules, credentials, or build output from the host application.

Installed plugin code is trusted application code with the user's access.
Describe external services and data use clearly. Installation and enabling
are separate actions. A theme is declarative CSS/assets/options and cannot
contain an executable entry point. Safe mode suspends plugin execution.

## Public PluginContext SDK

`src/extensions/types.ts` is the authoritative API definition.

| Surface | Methods and behavior |
| --- | --- |
| Identity | `apiVersion`, `id`, `manifest`, `platform`, `window`, `language` |
| App | `app.getData/saveData`, `getSettings/saveSettings`, `getAccountId`, `toast`; host settings/data writes use the normal app persistence path |
| NavoPath integrations | `integrations.superProductivity.createPairingCode()` and `request(path, method?, body?)`; requires a signed-in cloud account and provides the scoped sync connection API |
| Collections | `tasks`, `projects`, `calendar`: `list`, `get(id)`, async `create`, `update`, `remove` |
| Settings | `settings.get()`, async `save(patch)`, `registerPage(name, mount)` |
| Synced storage | Async `storage.get(key)`, `set`, `remove`; use for plugin data |
| Device storage | `localStorage.get(key)`, `set`; keep API keys and device preferences here |
| UI | `ui.registerPage(name, mount)`, `ui.setLauncherStatus(status)`, `ui.registerPlanningView(name, mount)`, `ui.toast(message)` |
| Commands | `commands.register(id, name, run, shortcut?)`, `execute(id)` |
| Events | `events.on(name, listener)`, `emit(name, payload?)`; `on(target,event,listener)` for DOM events |
| Lifecycle | `register(dispose)`, `interval(callback, milliseconds)`; SDK registrations clean up on unload |
| Timer modes | `timers.registerMode(provider)`; the main window owns advancement |
| Patches | `patch(target,key,wrapper)` returns cleanup; restore patches when unloading |
| Assets | `resourceUrl(relativePath)` resolves packaged assets |
| Desktop | `desktop.invoke(method,payload?)`; `desktop` is null on web/mobile |

A mount receives an `HTMLElement`, appends DOM, and returns a cleanup function.
Use accessible native controls, theme variables, shared geometry, and the
visual rules in `NavoPathStyle.md`. Do not inject untrusted text with innerHTML.
Cancel in-flight network requests on unload. Check `ctx.platform` and
`ctx.desktop` before calling desktop capabilities. Desktop invocation uses the
host's method bridge. A declared desktop entry runs with full Node.js file,
network and process capabilities in its dedicated utility process. Export named
methods through CommonJS `module.exports` or ESM exports; optional `onLoad` and
`onUnload` hooks run on startup and shutdown. The renderer dispatches only to
that installed entry's methods. Do not treat trusted plugins as sandboxed code.

### Workspace page contract

The host accepts one workspace page registration per plugin. Use fluid widths
inside the mount and return cleanup for listeners and network requests. Keep
ordinary preferences with the tool when they are part of its workflow. Separate
administrative options may use `settings.registerPage`.

Starting in 1.7.0 Beta 13, migrate old toolbar DOM and view-opening calls to
`ui.registerPage` and set `minAppVersion` to `1.7.0-beta.13` in the migrated
package. Launcher status accepts plain data. The supported weather symbols are
`sun`, `cloud`, `fog`, `rain`, `snow`, `storm` and `unknown`.

```js
export default {
  onload(ctx) {
    ctx.ui.registerPage('Example', container => {
      const button = document.createElement('button');
      button.textContent = 'Say hello';
      button.onclick = () => ctx.ui.toast('Ready');
      container.append(button);
      return () => button.remove();
    });
  }
};
```

`app.internal` is reserved for host integration. Prefer the documented collections and
registrations. If you patch an owning function, restore it, keep the change
bounded to your plugin lifecycle, and declare the compatibility assumptions.

The Super Productivity connection API is available to plugins through
`ctx.integrations.superProductivity`. Pairing codes are single-use and expire
after five minutes. The plugin should retain the returned code only long enough
to show it to the user, and should use the allowlisted sync paths (`state`,
`snapshot`, `confirm`, `resolve`, `restore`, and `revoke`) for its connection.
Do not request or store a user's full NavoPath MCP token.

## Timer mode providers

The public interface is `TimerModeProvider` in `src/extensions/timers.ts`.
A provider has a unique `id`, bilingual `label` and optional `description`,
`normalizePreferences`, `createRuntime`, `normalizeRuntime`, `advance`, and
`workMilliseconds`. Optional `createDeadlineRuntime` aligns a mode to a task
deadline; `notification` supplies localized descriptors for its own transition
IDs. All runtime state must be JSON serializable. Keep phase-specific fields
inside the provider's state; the host treats them as opaque.

`advance` returns `{ ...runtime, runtime, displaySeconds, transitions,
countsAsWork }`. Return authoritative work accounting from
`workMilliseconds(runtime, preferences, from, now)` for delayed ticks, pauses,
sleep, breaks, and overrun. Never install another wall-clock interval to advance
the host task timer. The main window advances once; widget and popover windows
receive serializable mode metadata, runtime and display snapshots. Disabling
settles work synchronously before the provider is removed, then switches to a
paused stopwatch. Reload restores installed modes before normalizing their
persisted runtime. See `community-plugins/pomodoro` for the complete official
provider, deadline planner, registered settings page and phase notifications.

## CSS-only themes

Use `kind: "theme"`, `styles`, optional assets and `options`. A theme has no
`main` or desktop executable code. An option declares `key`, `label`, `type`
(`color`, `number`, `string`, `boolean`), CSS `variable`, `default`, and optional
`min/max`. The host applies option values as CSS variables. Preserve readable
light/dark contrast, keyboard focus, reduced motion and mobile touch targets.
The Linen, Minimal, Sage, Graphite, Ocean and Typewriter samples in `community-plugins` are complete
installable themes. Optional `preview` points to a packaged raster image
(`.png`, `.jpg`, `.jpeg`, `.webp`, or `.avif`) stored with base64 encoding.
Use a real, readable app screenshot without personal data, and keep thumbnails
small. A catalog may also include a public HTTPS `previewUrl` for browsing
before installation. Use `previews: { "light": "preview-light.png", "dark": "preview-dark.png" }`
to supply both modes; each image must be a packaged binary resource. Catalogs
may expose `previewUrls: { "light": "https://...", "dark": "https://..." }`.
The market shows the two real screenshots together and lets users inspect each
mode separately. Built-in previews are available offline with the app.

The bundled Pomodoro uses the host focus page. If no task is active, the user
may start a standalone session. Reset that session before starting work linked
to a task. Quick Capture and Daily Overview demonstrate workspace pages.


## Catalog and release workflow

A catalog JSON has `{ "version": 1, "name": "Your catalog", "packages": [...] }`.
Each entry contains the manifest, an HTTPS `downloadUrl` and `sha256` of the
**exact package file bytes**. IDs are scoped to the source; different sources
can publish the same manifest ID independently. Use a new semver for each
published change and preserve previous package artifacts so rollback works.

```sh
node scripts/build-extensions.mjs
node scripts/build-extensions.mjs --check
npx vitest run src/extensions src/widget/widgetTimer.test.ts
```

The repository build script bundles official plugin sources, emits installable
packages under `public/extensions/packages`, updates the catalog and creates
the lazy offline fallback from the same bytes. It never bundles extension code
into the core timer. The official index is served at `/extensions/catalog.json`.
For third-party packages, copy a template and run `node package.mjs` there,
then compute SHA-256 using `Get-FileHash -Algorithm SHA256` or `sha256sum`.

Submit source, manifest, README, license, generated package and catalog change
in one PR. Use the community extension PR template. CI verifies deterministic
package bytes/catalog hashes and extension tests. Before submitting, verify
install/enable/disable/uninstall, reload, updates/rollback, offline failures,
settings persistence, account isolation, desktop and mobile/web fallbacks,
light/dark styling, and cleanup after failed startup. Ordinary settings and
plugin data follow account sync; local secrets remain on the device.

Authors who maintain an independent repository can instead publish a package
in their own GitHub release and add `{ manifest, downloadUrl, sha256 }` to
`community-plugins/registry.json` through a PR. CI downloads that exact public
HTTPS artifact, verifies its checksum and manifest, and never executes it.
Maintainers review the source and merge the listing. Registry packages are
downloaded on demand and are not bundled into the application.

The type-only SDK is in `integrations/navopath-plugin-api`. Each template also
ships the same declarations in `api/` plus this guide as `API.md`; editors can
use `import("./api").PluginContext` in JSDoc without installing the host.

`calendar.registerBackground(predicate)` registers ownership of fixedCourse calendar backgrounds. Disposing hides backgrounds without deleting them. Backgrounds never block task placement or compress task columns.

## Experimental protocol 2 (development preview)

The generated type-only SDK includes `PluginContextV2` in `api/v2.d.ts`.
The contract, activation layer and tests are in `src/extensions/sdkV2.ts`,
`runtimeV2.ts`, and `runtimeV2.test.ts`. The production preview adapter in
`runtimeV2Host.ts` connects `tasks.read`, `tasks.write`, `ui.tasksGroup`, `ui.workspace`, `ui.planning`,
`ui.settings` and `ui.toast` to the existing host. One page per plugin per
surface is supported. Task reads default to incomplete tasks and expose only
the public DTO; pass `includeCompleted: true` to include completed tasks.

Preview manifests declare `apiVersion: 2` and a unique array of supported
`permissions`. Preview packages are restricted to the approved official
catalog and existing explicit enable lifecycle; local imports and direct
third-party sources are rejected. No desktop entry, global styles, MCP
declaration or declarative settings options are accepted at this stage.
The original example `examples/protocol-v2.ts` exercises the broader mock
contract; `examples/protocol-v2-preview.ts` demonstrates the wired subset.
Neither example is published in the catalog.

The v2 context has no raw app/internal, planner state, arbitrary desktop IPC
or host module import. The static boundary check is a development guard;
approved packages remain trusted renderer code, not sandboxed code.
Tasks groups return candidate IDs (not duplicated TaskCard components). The host
assigns overlapping membership by stable group ID, keeps native order and renders
unclaimed candidates normally. Optional subscribe(invalidate) refreshes membership.
Task commands use the core task-operation/history path and return `accepted`
for local acceptance, not cloud acknowledgement. Reuse the same operation ID
for a retry of the same create; the host derives a stable task ID and checks
existing deletion tombstones. Rename and completion require the latest
`expectedUpdatedAt` unless already at the desired state. The first adapter
rejects domain entity links and edits of protected habit/course/calendar tasks.
This is not a cross-device atomic guarantee or a durable command ledger.
Activity queries, Metrics providers and versioned
storage remain unwired and must fail rather than fall back to unsafe v1 writes.
Do not store credentials in ordinary plugin data.

Keep existing plugin packages on v1. Older clients reject unknown manifest
protocols when loading a catalog, so publishing v2 packages requires a
separate compatible catalog/version delivery design. No v2 SDK or plugin
release, catalog publication or database migration has occurred.

### Protocol 2 preview: activity and metric providers

Approved protocol-2 packages may request `activity.read` to query concrete scheduled intervals and measured time entries by explicit half-open ISO timestamp interval (up to 366 days) and optional task IDs. Estimated all-day records and projected recurrences are omitted; planned duration is raw, not engagement-weighted. Metric providers require `metrics.provider`; they receive the existing Metrics overview's filtered facts and return at most 50 finite numeric rows. Providers are evaluated only while the overview is open, are isolated from other providers' asynchronous failures, and are removed on deactivation. Provider output refreshes when host facts change, the overview is reopened, or its optional subscribe callback invalidates the result. The host disposes subscriptions on unmount and deactivation. Neither capability starts a collector, grants access to raw history, or enables storage writes.

### Protocol 2 preview: versioned storage

`storage.read` and `storage.write` use a separate per-account, per-plugin namespace, the existing cloud revision trigger, conditional updates, and insert-only creation. A remove writes a tombstone; its non-null revision must be used when recreating a value. JSON null is a legitimate set value. Callers must read before editing, send the observed revision, and use a unique operation ID per logical edit. An unknown offline value is unavailable, not absent. Accepted offline writes are durably queued, one per key; a second write must wait or resolve the conflict. Pending removals report a null pending value. Reconnect replays the original expected revision and reports conflicts without overwriting newer cloud data. After a conflict, read the current value and explicitly submit a new operation ID with the current revision. Latest-operation replay is idempotent; a replay after subsequent edits conflicts rather than reapplying. Preview accounts commit locally only. V1 data is not migrated implicitly. Uninstall retains data and accepted pending writes. No schema change or production data migration is required by this implementation; real multi-device integration verification is still required.

### Protocol 2 preview: immutable task association

A task creation command may include an existing plugin entity ID. The host encodes an owner-scoped digest in the stable task identity at creation, so task and association enter the same core save/undo pipeline without a separate mapping write. Plugins recover links using `tasks.list({ entityIds: [...] , includeCompleted: true })`; only matching entities from the caller's namespace are returned and annotated with the supplied entity ID. The host does not access or validate the plugin's domain model. A plugin must persist the entity before creating its linked task, retain legacy mappings when migrating old tasks, and handle entity deletion without deleting user tasks. Task deletion uses the existing core tombstone ledger. No raw domain ID, new task fields, or new cloud schema are needed. Associations are immutable; task IDs remain stable. This does not make separate domain writes and core task sync a cross-device transaction, nor guarantee same-operation misuse with differing entity IDs across concurrent devices.

Use `tasks.resolveEntityLinks(taskIds, entityIds)` to recover owner-scoped associations for IDs supplied by activity facts, including deleted task IDs with retained time entries. It resolves identity only; it does not assert that an input task or entity still exists. This lets metrics providers use the already filtered host facts without asking for a second full activity scan.
