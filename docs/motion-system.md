# Motion system implementation (Beta 104)

## First increment
This increment extends the existing view-transition/presence/selection system rather than replacing it. It adds device-local motion intensity, task presentation matching, committed task relocation/reflow and checkbox state feedback and save-queue acknowledgement/retry status in the wide workspace header. No new animation dependency or persistence schema. The task motion coordinator uses noninteractive snapshots with real task hit areas unchanged. Drag preview remains the existing unified drag implementation; live reflow during active drag is deliberately suppressed to protect hit testing.

## Verification
Unit tests cover identity matching, duplicate/ambiguous occurrences, small changes, batch limits and preference normalization. Required manual desktop checks: candidate-to-timeline and return, repeated scheduling, Tree reorder/reparent, completion/undo, adjacent timeline hover, scroll during motion, rapid operations, dark/light, Dock, portrait and reduced motion. Existing Desktop Release workflow runs product tests and CSS checks before build and publication. No tag is created by preparing this branch.

## Subsequent increments
Extend feedback to compact layouts, plugin-host status and finer-grained remote sync states; anchor detail and popover transitions; refine real-time drag displacement and panel coordination; validate runtime performance on desktop and mobile. These remain separate work pending visual verification of this increment.
