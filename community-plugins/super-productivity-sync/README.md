# Super Productivity Sync

Connect one Super Productivity installation to NavoPath using a five-minute pairing code. The first exchange previews both task and project lists. Unique exact-title matches are suggestions. Select all or clear matches, search, and choose which app supplies shared fields per match. Merge imports unmatched records separately. With both updated plugins and the updated cloud service, choose an explicit overwrite mode to retain the source and move unmatched target records into Recently deleted. Review counts and confirm deletion before applying changes. After initial overwrite, normal two-way sync resumes.

The sync service transfers common project and task fields, including titles, notes, completion state, due dates, estimates, project assignment, and the nearest scheduled block (start and duration). Local changes trigger a debounced upload; remote changes are polled every 15 seconds while the apps are running. NavoPath keeps its full multi-block schedule; extra blocks are not represented in Super Productivity's single-timed-task model. Historical time tracking, recurrence rules, priorities, tags, and other NavoPath-only fields are outside the shared field set.

Conflicts keep both values until the user chooses one. Deletions propagate and tasks or projects deleted by the other app remain restorable there for 30 days. NavoPath Cloud stores an encrypted-transport sync snapshot and scoped token hashes; the Super Productivity plugin keeps the device token in its device-local secret store.

Install **Super Productivity Sync** from the NavoPath extension catalog. Create a pairing code in its settings page, then paste it into the Super Productivity plugin. To disconnect all paired devices, use **Disconnect** in NavoPath.

## Super Productivity companion plugin

The companion plugin requires Super Productivity 20.1.0 or newer. [Download the Super Productivity plugin ZIP](../../integrations/super-productivity-navopath/navopath-sync-1.0.5.zip), then upload it from Settings → Plugins. Re-uploading a ZIP with the same plugin ID updates the existing installation. Open NavoPath Sync from the SP plugin menu or its Settings configuration button. The new host runtime keeps syncing when the dialog is closed. If old iframe storage is not accessible, generate a new pairing code for this device; existing mappings are retained for the same pair.
