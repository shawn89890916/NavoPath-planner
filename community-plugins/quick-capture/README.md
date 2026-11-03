# Quick Capture / 快速收集

Install and enable in Settings → Community plugins. Open **Plugin tools → Quick
Capture** in the application header. Enter a title, optionally choose a project,
and add a real task to today's candidates. Whitespace-only titles are rejected;
titles have a 500-character limit. The date uses your device's local day.

Set an optional default project on this plugin's settings page. Archived or
deleted projects cannot receive new tasks. Capture preserves the text after a
save failure so you can retry. No external service or private host API is used.

Disabling removes the view and settings page and releases listeners. Tasks you
already created remain in your planner. Build using `npm run extensions:build`.
