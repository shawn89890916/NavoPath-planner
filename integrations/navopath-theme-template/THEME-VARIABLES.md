# Theme authoring reference

Themes may define their own palette, typography, spacing, layout and controls.
The built-in NavoPath theme is retained as a fallback. Use existing variables
first; selectors can override any part of the visible application.

| Purpose | CSS variables |
| --- | --- |
| Backgrounds | `--bg-app`, `--bg-app-soft`, `--timeline-paper` |
| Surfaces | `--surface-main`, `--surface-raised`, `--surface-card` |
| Text | `--text-main`, `--text-muted`, `--text-faint` |
| Rules | `--border-soft`, `--border-subtle` |
| Interactions | `--accent-active`, `--accent-rgb`, `--accent-on` |
| Timeline | `--timeline-font-scale`, `--timeline-slot-height` |
| Header | `--header-bg`, `--header-fg`, `--header-border` |
| Input | `--input-bg`, `--input-border` |

Use `.df-app.theme-light` / `.df-app.theme-dark` to target the main workspace.
`body[data-navopath-base-theme="light"]` / `"dark"` supplies inherited values
to portal surfaces. Widget roots use `.df-widget-root[data-theme="light"]`
and `.df-widget-popover-root[data-theme="light"]`, with matching dark selectors.
Single active theme CSS follows the base stylesheet; saved user overrides take
precedence. Keep light and dark option variables distinct, as in this template.

Package fonts and images locally and reference them with relative `url(...)`.
The host resolves their Blob URLs and revokes them when the theme is switched.
Include binary files as `encoding: "base64"` in JSON packages, or use ZIP.
Theme packages cannot declare `main` or `desktop` script entries. Dynamic
behavior can be provided by a separately installed plugin.

Verify text contrast, keyboard focus, touch targets, reduced motion, narrow
screens, both modes, widget windows, option changes and restoration to default.
