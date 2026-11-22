# Product feature pages

Public routes are `/features/workspace`, `/features/plugins`, `/features/ai`, and
`/principles`. The former Execute and Planning feature URLs lead to Workspace
with their query and fragment preserved.
The bilingual Principles directory uses six short summaries in a generously spaced
two-column desktop layout, switching to one column on phones. Separate articles
live at `/principles/jev`, `/principles/feedback`, `/principles/time`,
`/principles/control`, `/principles/views`, and `/principles/records`. A shared
article layout shows a headline, static process illustration and three brief
sections, with source links, a next-topic link and return to directory. Only the
selected article copy is loaded; directory visits do not load article bodies.
All routes are lazy-loaded before workspace initialization and share product
navigation/footer without mounting an iframe, loading account data or requesting
AI. Topics reflect existing implementation: JEV predictions, confidence/manual
overrides and personal records, time-grid/free-slot scheduling, previews/undo,
shared Planning views, and separation of tasks from timeline/time entries.
Illustrations describe the process rather than live model results. Official
TypeSafe documentation and relevant source files are linked. Update copy alongside
the corresponding implementation (`jevPrediction.ts`, `aiPersonalization.ts`,
`autoSchedule.ts`, `PlanningView.tsx`, task/time record types and AI handlers).

The homepage presents Workspace, Plugin Market, Navo AI, and Principles. Its
workspace story follows one task from the project tree through Today’s Candidates
to the timeline. The desktop Dock guidance explains edge selection, reopening,
and restoring the window. The Plugin Market page shows the application’s real
market and explains where to install and manage plugins.

Workspace and Navo AI load a native workspace iframe automatically in landscape.
A screenshot covers it while it initializes and remains available with a retry
when loading fails. In portrait the page uses a screenshot and reading content.
The Plugin Market uses screenshots in both orientations. Keep descriptions and
FAQs below the visual. The shared product navigation and language controls live
in the parent page.

For a screenshot refresh, capture the current workspace at 1440×900 and 390×844
in each language, using sample data only. Use the native demo routes for Workspace
and Navo AI. For the market, open the app’s Settings, Plugins, and Browse market
in a clean local-preview session. The images are loaded through a single picture
component that chooses portrait assets by orientation. Keep the product landing
page free of live workspace frames.

`siteEntry.tsx` installs `productDemoRuntime.ts` before loading the shared app
on `/product-demo/:feature`. The workspace example begins on the project tree.
Native Planning and Execute controls share the in-memory PlannerApi and carry
the same task to the timeline. The AI example uses the same candidate and timeline
panels, starting on Candidates in compact landscape. Its presets exercise native
scheduling, rescheduling and undo against the fixed example date. It does not
make remote model requests. Visibility messages pause offscreen animation and
validate the source, origin, channel and payload.

Verify both languages, the legacy redirects, a wide and a narrow landscape
viewport, mobile portrait, and orientation changes. Confirm that the same task
can be added to Today’s Candidates and scheduled, and that the AI presets can
arrange, reschedule and undo. Exercise loading retry, login and download links.
Run the build, relevant tests, CSS, terminology, changelog and size checks.
