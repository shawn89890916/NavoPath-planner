# NavoPath theme template

Edit the manifest and CSS, then run `node package.mjs`. Import the resulting
`.navopackage.json` through Appearance → Community themes. Themes contain CSS,
assets and declarative options only. JavaScript entry points are rejected.

Read THEME-VARIABLES.md and API.md. Community themes may define their own
palette, typography and layout; retain readable light/dark contrast, keyboard
focus indicators and reduced motion support. Options declare a key, label,
type, CSS variable and default value. Relative image/font assets can be packaged
as base64 files; the host resolves package-relative CSS resource URLs. Theme
options update CSS variables without executing code. Use the existing canonical
selectors; avoid !important, duplicate override layers and unrelated layouts.

See API.md. MIT licensed.

For paired market previews, capture the real app in both modes and declare
`previews: { "light": "preview-light.png", "dark": "preview-dark.png" }`.
The package command includes these raster images as binary resources. Keep
each thumbnail small and exclude personal data. See Typewriter and Ocean.
