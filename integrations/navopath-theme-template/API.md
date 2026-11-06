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
- Use `settings.registerPage` for configurable options. Every installed plugin
  still gets a Settings action with its version, author and platform details if
  it has no custom settings page.
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
