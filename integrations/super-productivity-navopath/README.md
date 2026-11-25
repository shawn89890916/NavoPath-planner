# NavoPath Sync for Super Productivity

This plugin pairs with the NavoPath community plugin to sync projects and tasks across devices.

## Pair

1. Install and enable **Super Productivity Sync** in NavoPath and copy the short-lived pairing code.
2. Install this plugin in Super Productivity, paste the code and select **Connect**.
3. Review the first-import preview. Exact title matches are suggestions; you can uncheck any match. Confirm to start syncing.

Create a new pairing code for each Super Productivity device. The connection token is kept in Super Productivity's local plugin secret store; task links and sync state use Super Productivity's synced plugin data.

## Data and scheduling

Project and task titles, notes, due dates, estimates, project names, completion state and the nearest scheduled block are sent to the NavoPath Cloud connection API. NavoPath keeps its complete schedule history; Super Productivity receives the nearest scheduled block and its duration as the task's start time and estimate. NavoPath-only fields and time-tracking history are not synchronized.

The plugin uses the guarded `PluginAPI.request` host permission and stores credentials with `PluginAPI.setSecret`. Revoke the connection from the NavoPath plugin page to invalidate its tokens.

## Development

Use **Forget this device** to remove the local token. To revoke all paired devices and clear the cloud state, disconnect in NavoPath. Sync-deleted tasks and projects can be restored from the plugin for 30 days.

Zip `manifest.json`, `index.html` and `LICENSE` at the archive root, then import the zip from Super Productivity → Settings → Plugins.
