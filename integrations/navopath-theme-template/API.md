# NavoPath community plugin and theme development

NavoPath API v1 loads installable packages on desktop, web and mobile. Start
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
| UI | `ui.addHeaderItem(name, mount)`, `registerView(name, mount)`, `toast(message)` |
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

```js
export default {
  onload(ctx) {
    ctx.ui.addHeaderItem('Example', container => {
      const button = document.createElement('button');
      button.textContent = ctx.settings.get().label || 'Example';
      button.onclick = () => ctx.ui.toast('Ready');
      container.append(button);
      return () => button.remove();
    });
    ctx.settings.registerPage('Example', container => {
      const input = document.createElement('input');
      input.setAttribute('aria-label', 'Header label');
      input.value = ctx.settings.get().label || '';
      input.onchange = () => { void ctx.settings.save({ label: input.value }); };
      container.append(input);
      return () => input.remove();
    });
  }
};
```

`app.internal` is an advanced escape hatch for deliberate host integration. Its
members are not stable public APIs. Prefer the documented collections and
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
The Linen sample in `community-plugins/linen` is a complete installable theme.

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
