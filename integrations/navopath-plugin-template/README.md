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
SDK registrations dispose automatically. Use `ctx.ui.addHeaderItem` or
`registerView` to mount DOM and return cleanup. `ctx.desktop` is null on web and
mobile. Check availability instead of assuming a desktop environment.

MIT licensed. Never commit API keys, account exports, node_modules or app bundles.
