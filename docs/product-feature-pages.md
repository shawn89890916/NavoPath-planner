# Product feature pages

Public routes: `/features/planning`, `/features/execute`, `/features/ai`, `/principles`.
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
Planning, Execute, and Navo AI fill the window with the running product workspace. Planning
uses compact, clearly indented native task nodes and a right-side introduction.
Execute uses native candidates on the left, introductions in the middle, and the
timeline on the right. Introductions scroll in the parent document, scaling and fading according to their
distance from the visual center without replacing the visitor's data. Landscape
workspaces at least 1000px wide keep an introduction column; Execute reserves
a flexible right-aligned timeline, readable candidates, and at least 280px for the notes, reclaiming the calendar
view rail and daily-canvas margins. Narrow landscape screens keep native compact
layouts and show introductions below the workspace. Portrait screens on all three
routes show only text, shared navigation, and expandable FAQ answers; no iframe or
interactive product workspace is mounted. Rotating the viewport switches between
these presentations and disposes of the old demo. Landscape Navo AI reuses the Execute introduction’s three-column geometry: native
Today’s Candidates on the left, a ProductStorySlot with live explanations in the
middle, and the unchanged native timeline on the right. The initial scheduling icon
has a persistent 4px pale outline. There is no large arrow or timeline overlay.
Candidate cards use the same interactive TaskCard path as regular Execute. During
the three-second wait, the middle explains estimates, lunch/rest and reversible
changes. Native schedule actions then move candidates to the timeline. Each new
block fades and settles into its slot over 620ms, staggered by 100ms in time order;
CSS animations use opacity and individual translate without changing timeline
geometry or drag transforms. Reduced motion skips the arrival effect. Offscreen
animations pause and resume when the example returns. After arranging, the middle
explains the result and the candidate panel offers three task/date reschedule
choices and native Undo. Undoing all rounds restores the six candidates and opening
cue. Desktop columns exactly match Execute. Short landscape layouts keep three
columns with smaller text and reachable candidate cards. Portrait remains text-only.
The six sessions start at 09:00, 11:00, 12:00, 14:00, 15:30 and 16:30, including
lunch/rest and afternoon course notes. Requests use native handlers, the fifteen-minute
grid, conflict checks and undo records without real AI or account requests. All
feature and Principles pages share three grouped menus: Product (Execute, Planning,
Navo AI), Principles (all six topics), and Support. Both new groups use the existing
Support-style quick menu, with hover, tap, ArrowDown, Escape and outside dismissal.
Quick menus clamp within the viewport, including narrow screens. The homepage's
existing Product mega-menu presentation is preserved. Language and Start now remain on the right;
the language switch track and thumb both use round pill corners. Each page has six
bilingual FAQ questions using native details/summary controls with a thin shared plus
icon. Execute paragraphs are centered within equal horizontal insets.
All three introductions insert navigation into the real App header through an optional
runtime slot, reusing ProductMenu and the existing site controls. It returns
home from the logo and links to all three features,
with a Principles link and a personal-site placeholder. Support includes Afdian and GitHub.
Homepage content, navigation, and animation remain intact. Feature subtitles,
including Navo AI, use the same enlarged title-size token as the main introduction.
Introductions and native display type use Times New Roman; candidate project names
use regular sans-serif type. Today's Candidates uses the task font and a more generous
column width. The first scrolling paragraph includes a short scroll cue. FAQ
stays below each page. Full-window demo dates are read-only, and calendar view switching,
date arrows/dropdowns, Back to now, and floating Add/AI launchers are omitted from the native
full-window demo render path. Formal /app keeps its original controls. Mobile task/schedule switching,
candidate scheduling, task duration, completion, and rescheduling remain native.

`siteEntry.tsx` installs `productDemoRuntime.ts` for `/product-demo/:feature` and
then imports the same `main.tsx` used by `/app`. There is no separately assembled
workspace renderer. Native App owns layout, cards, menus, drag/drop, timeline,
planning views, scheduling, AI previews, and undo. Product CSS determines their
geometry. The full-window presentation is a scoped variant in canonical product CSS;
regular /app retains its geometry. ProductStorySlot reserves an optional native column and reports its geometry;
ProductStory renders one semantic introduction in the parent document, aligned with
that column. The workspace stays sticky while the paragraphs scroll normally. After
the opening paragraph, native CSS sticky positioning holds each paragraph at the
visual center over a short stretch of document scrolling; no wheel or touch events
are intercepted. Each
paragraph stays enlarged and opaque within 22% of viewport height from the column
center, easing down with at most 1.8px of blur only toward the top and bottom edges. Enlargement is capped by
the available column width so notes cannot spill onto native panels. The
reduced-motion setting keeps text at full size and opacity, removes blur, and skips
the extra sticky dwell space. Narrow landscape screens keep normal paragraph flow;
portrait text does not use the scrolling-story effects. The outer page clips
notes below the native header so navigation stays unobstructed. Demo CSS owns the
slot, preset buttons, and viewport containment; feature CSS owns the scrolling notes.
Full-window Planning and Execute have a single outer document scroll: native tree,
candidate, board, matrix, and timeline containers are clipped rather than independently
scrollable. Wheel input over these panels naturally scrolls the parent document. The
sticky workspace remains in place until the notes finish, then FAQ and footer enter.
The native timeline geometry fits the 08:00–18:00 example day to the available height;
task dragging and resizing use those same coordinates. Regular /app retains scrolling.

The demo installs a memory PlannerApi before browser fallback initialization.
`workspaceEnvironment.ts` supplies memory storage and a fixed example clock to App;
regular app routes retain their normal API, storage, and clock. Account services,
real AI requests, notification onboarding, and cloud synchronization are skipped.
Refreshing the iframe restores the fixture. Presets produce real AI messages and
schedule actions; native App applies or undoes them using timeline records. Open AI
input, providers, attachments, and account controls are outside demo scope.

Parent/iframe messages validate source windows and origin. The parent lazy mounts
near the viewport and offers retry after initialization failure. Visibility messages
pause offscreen animations. A validated story-layout message reports the native
column rectangle; it never replaces user changes. Planning has
expanded website and learning projects and an initially collapsed exercise project,
no subtasks, and four enabled native views. Its matrix has examples in all four quadrants
and equal quadrant heights. Examples use a
fixed day, fifteen-minute scheduling, and the product's conflict utilities. Execute
starts with six ordinary task records, including a noon lunch/rest block and longer
work sessions with adjacent starts and occasional short breaks,
three unscheduled candidates, and free slots for exploration; no legacy event is seeded.

Verify native planning/execute mode switching, candidate add/remove, scheduling,
rescheduling, AI preview apply/undo, account storage/network isolation, deep links,
language, menus, reduced motion, text-only 390×844 / 360×800 and portrait tablet
layouts, and orientation changes without stale or hidden demos. Run build, targeted
or full tests as required by AGENTS.md, CSS, terminology, changelog, diff and size
checks. Feature scripts/styles have 16 KB / 4 KB Brotli budgets. Existing workflows
run on main and tags; a feature-branch push does not deploy production.
