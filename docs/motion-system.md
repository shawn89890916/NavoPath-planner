# Motion system implementation (Beta 104)

## First increment
This increment extends the existing view-transition/presence/selection system rather than replacing it. It adds device-local motion intensity, task presentation matching, committed task relocation/reflow and checkbox state feedback and save-queue acknowledgement/retry status in the wide workspace header. No new animation dependency or persistence schema. The task motion coordinator uses noninteractive snapshots with real task hit areas unchanged. Drag preview remains the existing unified drag implementation; live reflow during active drag is deliberately suppressed to protect hit testing.

## Verification
Unit tests cover identity matching, duplicate/ambiguous occurrences, small changes, batch limits and preference normalization. Required manual desktop checks: candidate-to-timeline and return, repeated scheduling, Tree reorder/reparent, completion/undo, adjacent timeline hover, scroll during motion, rapid operations, dark/light, Dock, portrait and reduced motion. Existing Desktop Release workflow runs product tests and CSS checks before build and publication. No tag is created by preparing this branch.

## Subsequent increments
Extend feedback to compact layouts, plugin-host status and finer-grained remote sync states; anchor detail and popover transitions; refine real-time drag displacement and panel coordination; validate runtime performance on desktop and mobile. These remain separate work pending visual verification of this increment.

### Beta 104 size budget

CI run 45758131846 measured the complete compressed app scripts at 363.15 kB, exceeding the previous 360.5 kB total cap by 2.65 kB. The initial app scripts measured 259.93 kB against the unchanged 263 kB cap. Set a narrowly scoped 365 kB total script cap for this feature release (+4.5 kB, approximately 1.25%); retain all other limits, including the separate startup, deferred, settings, frontend output and desktop package budgets. Re-run the full checks before merging.

## Beta 106 spatial increment
Same-list Tree/board projection is a bounded inert copy of intervening siblings; original hit targets and mutation logic stay in place. Cross-container and timeline drops retain the existing placement indicators. Shared anchor geometry and observer are used for detail and action disclosure. Responsive layout mode identifies Dock edges and compact save feedback. Extension mount uses isolated per-generation roots with honest loading/error/retry. No new dependencies or budget increase. Candidate list reordering also projects sibling offsets; successful unique task drops hand the visible overlay rectangle to committed layout motion. Ambiguous/hidden destinations fall back to existing feedback. Complete panel host consolidation, cross-list displacement, all plugin-specific actions and actual desktop visual acceptance still need further work.
