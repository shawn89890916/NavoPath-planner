# NavoPath Sync for Super Productivity

This plugin pairs with the NavoPath community plugin to sync projects and tasks across devices.

## Pair

1. Install and enable **Super Productivity Sync** in NavoPath and copy the short-lived pairing code.
2. Install this plugin in Super Productivity, paste the code and select **Connect**.
3. Open NavoPath Sync from the plugin menu or its Settings configuration button. Review the first-import preview. Exact title matches are suggestions; you can uncheck any match. Choose merge (keep unique records on both sides) or explicitly overwrite one side from the other. Overwrite requires both updated plugins, lists deletion counts, and needs a second confirmation. The reserved SP Inbox is excluded in new connections, and removed SP projects are archived rather than hard-deleted to retain local notes and history. After first sync, normal two-way sync resumes.

Create a new pairing code for each Super Productivity device. The connection token is kept in Super Productivity's device-local secret store. Task links and sync state use synced plugin data. If the old iframe token is inaccessible after an upgrade, generate a new pairing code; mappings for the same pair are retained.

## Data and scheduling

Project and task titles, notes, due dates, estimates, project names, completion state and the nearest scheduled block are sent to the NavoPath Cloud connection API. NavoPath keeps its complete schedule history; Super Productivity receives the nearest scheduled block and its duration as the task's start time and estimate. NavoPath-only fields and time-tracking history are not synchronized.

The host-side `plugin.js` runtime uses the guarded `PluginAPI.request` host permission, task-change hooks, and a 15-second remote polling interval. It stays active with the dialog closed. Its token stays in device-local secret storage and is not written to synced plugin data or exports. Revoke the connection from the NavoPath plugin page to invalidate its tokens.

## Development

Use **Forget this device** to remove the local token. To revoke all paired devices and clear the cloud state, disconnect in NavoPath. Sync-deleted tasks and projects can be restored from the plugin for 30 days.

For v1.0.4+, zip `manifest.json`, `plugin.js` and `LICENSE` at the archive root, then import the zip from Super Productivity → Settings → Plugins. The previous `index.html` is kept as the legacy iframe implementation and is not included in the host-runtime ZIP.

## 1.1.0 review changes

Both plugins must be updated for hierarchy synchronization. The host runtime uses addTask(parentId) and batchUpdateForProject, verifies host state after changes, and journals deletion before exposing Restore. Project removal archives rather than hard-deletes; no deleteProject permission is requested. Unchanged link state is not written again. The ZIP contains only the manifest, host runtime, and license.
