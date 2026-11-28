# NavoPath plugin template

Copy this directory, choose a unique manifest ID, edit `main.js`, and run
`node package.mjs`. Import the resulting `.navopackage.json` in Settings →
Plugins → Import. Enable explicitly to execute code.

The entry point is a self-contained ES module exporting `{ onload(ctx),
onunload?() }`. Bundle external dependencies with esbuild or another bundler;
bare module imports cannot resolve inside the installed package. Do not bundle
NavoPath or React. This template includes the current host API declarations in `api/` and the
complete development guide in `API.md`.

Use `ctx.settings.get/save/registerPage` for synchronized plugin configuration,
`ctx.storage.get/set/remove` for synchronized data, and `ctx.localStorage.get/set`
for device-only secrets. Register resources using `ctx.register(dispose)`;
SDK registrations dispose automatically. Use `ctx.ui.registerPage` to register a workspace page and return cleanup. `ctx.desktop` is null on web and
mobile. Check availability instead of assuming a desktop environment.

MIT licensed. Never commit API keys, account exports, node_modules or app bundles.

## Protocol 2 preview

`examples/protocol-v2.ts` demonstrates the experimental type-only public
contract in `api/v2.d.ts`. It is exercised by host contract tests, not by
installed clients. Keep `manifest.json` on API v1; do not publish the example
as a working v2 package until host integration is available.
