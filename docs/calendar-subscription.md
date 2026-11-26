# NavoPath calendar subscription

NavoPath publishes a private, read-only iCalendar feed from the existing Cloudflare Worker. The feed contains scheduled timeline blocks, calendar events, and incomplete task deadlines that do not already have a timeline block.

## Deploy

1. Apply `supabase/migrations/20260719153000_calendar_feed_tokens.sql` to the linked Supabase project.
2. Deploy `mcp-worker` with its existing `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` secrets.
3. Deploy the main web application. If it uses a non-default Worker URL, set `VITE_MCP_ENDPOINT` to the Worker `/mcp` endpoint before building.

The raw subscription token is generated in the browser. Supabase stores only its SHA-256 digest. Replacing the link revokes the previous active token for that user.

## Subscribe

1. Sign in to NavoPath.
2. Open **Settings → Advanced → Calendar & Integrations → Calendar**.
3. Select **Create subscription link**.
4. On iPhone, select **Subscribe in Calendar**. For another client, copy the HTTPS link and add it as an iCalendar or Webcal subscription.

Calendar subscriptions are read-only. Changes made in Apple Calendar or Notion Calendar do not update NavoPath, and calendar clients decide when to refresh remote feeds.

## Super Productivity timeline history
SP's native task timeline only selects incomplete tasks with one timed slot per task. Keep the NavoPath Sync plugin connected for two-way task and active schedule changes. To display completed execution records, returned-unfinished records and additional blocks, add a separate read-only iCalendar source in SP:

1. Use your existing NavoPath calendar subscription URL (or create one only if none exists).
2. Replace its final `.ics` with `-history.ics`, or use **Copy SP timeline history link** in Calendar settings when generating a subscription.
3. In Super Productivity, add an iCalendar calendar integration with that URL. Leave automatic task import disabled. Do not subscribe to the full NavoPath feed as well, which would duplicate active slots.

The history feed has a stable UID per recorded block, excludes cancelled records and the primary incomplete-task timed slot already mirrored by the plugin, and does not contain task notes. Calendar events are read-only; completion and execution history stay in NavoPath. SP determines its display range and polling frequency. Revoking the existing calendar token revokes both feeds.
