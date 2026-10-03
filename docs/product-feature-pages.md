# Product feature pages

The public routes are `/features/planning`, `/features/execute`, and `/features/ai`.
Their Chinese and English content loads separately from `src/features/`. The
homepage retains its existing layout and adds the Product navigation menu.

`siteEntry.tsx` dispatches public pages and `/product-demo/:feature` before importing
the application entry. Demo routes use an in-memory `PlannerData` fixture and never
initialize an account, planner API, AI client, synchronization, or persistence.

The workspace and examples share `PlanningView`, `TaskBlock`, `WorkspacePresentation`,
`AiPanel`, and `ExecutionSharedLayout`. The application retains its service callbacks.
Candidate transitions, pointer geometry, conflict detection, timeline record changes,
free-slot calculation, and AI import undo come from the same product utilities.
`AiPanel` loads on demand through its shared Suspense boundary.

The parent and iframe validate the sender window and same-origin address. Parent
commands contain only stage, language, reset, or visibility. Interaction pauses
stage changes; Follow the story restores the current stage and Reset restores its
initial fixture. The iframe reports readiness, interaction, and loading failure.

The fixed example date and clock live in `productDemoData.ts`. AI presets live in
`ProductDemo.tsx` and use the real message and action-preview structures. Each
accepted round records previous tasks, so undo retains other rounds and edits.
When product behavior changes, update these fixtures and the corresponding
`src/features/` content along with the shared components.

Verification covers candidate add/remove, fifteen-minute scheduling and conflicts,
rescheduling, AI application and undo, desktop scroll stages, manual pause/resume,
mobile layouts at 390×844 and 360×800, keyboard menus, reduced motion, loading
retry, deep-link refresh, language switching, and browser storage/network isolation.
Run the targeted product tests, build, CSS, terminology, changelog, and size gates.

Bundle checks include the deferred workspace, shared UI, AI panel, and individual
feature content chunks. Initial and total app budgets allow the compression cost of
splitting the former single module; deferred views retain their existing budget.
Feature scripts and styles have separate 16 KB and 4 KB Brotli budgets. The existing
GitHub Actions deployment workflow runs on `main`; a feature branch does not trigger
it. Adding a separate verification workflow requires GitHub workflow permission.

Web builds use root-relative assets for deep routes. `dist` and `ios:sync` retain
the `--base=./` build override for local-file Electron and Capacitor packaging.
Demo guide dismissal stays in component memory, and demo loading errors bypass
the workspace's session-storage recovery handler.
