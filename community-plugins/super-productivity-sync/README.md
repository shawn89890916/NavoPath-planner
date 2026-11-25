# Super Productivity Sync

Connect one Super Productivity installation to NavoPath using a five-minute pairing code. The first exchange previews both task and project lists; exact-title matches are suggestions, and the user confirms which records represent the same item.

The sync service transfers common project and task fields, including titles, notes, completion state, due dates, estimates, project assignment, and the nearest scheduled block. NavoPath keeps its full multi-block schedule. Historical time tracking, recurrence rules, priorities, tags, and other NavoPath-only fields are outside the shared field set.

Conflicts keep both values until the user chooses one. Deletions propagate and tasks or projects deleted by the other app remain restorable there for 30 days. NavoPath Cloud stores an encrypted-transport sync snapshot and scoped token hashes; the Super Productivity plugin stores the device token in its secret store.

Install **Super Productivity Sync** from the NavoPath extension catalog. Create a pairing code in its settings page, then paste it into the Super Productivity plugin. To disconnect all paired devices, use **Disconnect** in NavoPath.

## Super Productivity companion plugin

The companion plugin requires Super Productivity 20.0.0 or newer. [Download the Super Productivity plugin ZIP](../../integrations/super-productivity-navopath/navopath-sync-1.0.1.zip), then upload it from Settings → Plugins. Re-uploading a ZIP with the same plugin ID updates the existing installation.
