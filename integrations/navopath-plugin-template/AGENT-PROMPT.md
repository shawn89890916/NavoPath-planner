Build an installable NavoPath API v1 community plugin using this template.
Read README.md and API.md first. Keep a self-contained ESM
default export with onload(ctx), package relative resources, and use the public
PluginContext SDK. Register cleanup for timers, listeners, DOM and patches.
Implement a real settings page with validation; keep secrets device-local.
Support desktop/web/mobile or declare precise manifest platforms. Test enable,
disable, reinstall, update, failure recovery and two-window behavior. Do not
modify the app core to implement plugin behavior. Return source, MIT license,
README, a .navopackage.json file, and the exact SHA-256 of that file.
