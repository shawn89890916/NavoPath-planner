# NavoPath folder sync bridge

The **Sync** tab under **Calendar & Integrations** connects one always-on Windows or macOS computer to a user-owned cloud-synced folder. NavoPath cloud remains the workspace relay for web, iPhone, and Windows clients. The bridge mirrors the complete planner backup scope to `navopath-workspace.json` in the chosen folder and merges newer record changes back into the account. It does not use CloudKit or require an Apple Developer account.

## Setup

1. Install Node.js 20 or newer and an iCloud Drive, OneDrive, Dropbox, or other cloud client. Confirm that the provider's folder exists locally and finishes syncing.
2. Sign in to NavoPath. In **Calendar & Integrations → MCP**, create a separate token named `Sync Bridge`. The token is shown once.
3. In the adjacent **Sync** tab, select the provider and copy the setup prompt to a trusted local Agent. The prompt points to [`sync-bridge/bridge.mjs`](../sync-bridge/bridge.mjs). The Agent saves that script outside the cloud folder, runs `node bridge.mjs setup --folder <folder> --endpoint <MCP endpoint>`, and lets the user enter the token at the hidden terminal prompt.
4. Run `node bridge.mjs install` on that same computer. This installs a Windows logon task or macOS LaunchAgent and starts it. The bridge retries temporary failures and reports its folder, health, error, and last success time to NavoPath's Sync tab.

Keep only one bridge computer active for an account and folder. The computer must remain signed in and its cloud client must keep running. Other NavoPath clients catch up when opened or reconnected. The bridge stores the MCP token in macOS Keychain or Windows user-scoped DPAPI storage under the local NavoPath configuration directory; it never writes the token into the cloud folder or snapshot.

## Manual transfer

Use **Account & Data → Data & Backup** to export a full JSON backup, place the downloaded `navopath-backup-*.json` file in any cloud folder, then import it on the other device after saving a copy of that device's current data. Manual import replaces that device's current data. The bridge's `navopath-workspace.json` is a separate versioned file and should not be substituted for the manual backup.

## Data and conflicts

- The bridge uses the same per-record modification-time merge and deletion tombstones as NavoPath's existing account sync. Settings use the newer whole-snapshot timestamp. A profile revision check prevents a concurrent write from being overwritten; the next bridge cycle retries it.
- The file includes the NavoPath account ID. A file from a different account or a corrupt file stops the bridge without replacing the file. Cloud-provider conflict copies also pause syncing until the user reviews them.
- The previous valid canonical file is copied to the local NavoPath configuration directory before replacement. The bridge reports failures to the Sync tab when the network is reachable.
- The file contains planner data and settings in readable JSON. Users should choose a cloud provider and folder they trust. Authentication sessions and MCP tokens are not included.

## Deployment

Apply `supabase/migrations/20260929090000_sync_bridge_status.sql` before deploying the MCP Worker and web app. The Worker exposes authenticated snapshot and status operations at `/api/sync/snapshot` and `/api/sync/status` as well as MCP tools `sync_get_snapshot`, `sync_merge_snapshot`, and `sync_report_status`. The web app reads status through the signed-in user's row-level-security policy.
