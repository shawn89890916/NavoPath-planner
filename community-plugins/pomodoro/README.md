# Pomodoro

Deadline-aligned focus cycles, short and long breaks, and accurate work accounting.

Install from NavoPath Settings → Community plugins → Browse, then enable it.
Click **Pomodoro / 番茄钟** in the application header, or choose **Plugin tools →
Open Pomodoro**. The plugin settings page also includes an Open Pomodoro action.
Use **Start**, **Pause**, **Resume**, and **Save** in the host focus screen.
An active timeline task receives actual focus work logs. With no active task,
Pomodoro starts an unlinked session and clearly labels that no task work is logged.
An unlinked session remains unlinked if a scheduled task starts later; **Reset**
begins a fresh session that can link to the currently active timeline task.
The entry opens the same host timer session used by the desktop widget.
All configuration is contributed by the installed plugin. Disabling or removing
the package releases its UI, timers, network listeners and commands.

Build and validate using `node scripts/build-extensions.mjs` and
`node scripts/build-extensions.mjs --check` from the repository root.

The plugin owns planning, phase advancement, preferences, notifications and
work calculations. The main window is the single clock owner; widget windows
receive snapshots. Short and long breaks never count as task work. Disabling
settles elapsed work before switching to a paused stopwatch. Auto-start is
optional; when off, each new phase waits for an explicit start. A deadline plan
retains its absolute task deadline across a pause.
