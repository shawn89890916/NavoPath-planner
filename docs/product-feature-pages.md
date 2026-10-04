# Product feature pages

Public routes: `/features/planning`, `/features/execute`, `/features/ai`.
Planning and Execute fill the window with the running product workspace. Planning
uses compact, clearly indented native task nodes and a right-side introduction.
Execute uses native candidates on the left, introductions in the middle, and the
timeline on the right. Introductions scroll in the parent document, scaling and fading according to their
distance from the visual center without replacing the visitor's data. Landscape
workspaces at least 1000px wide keep an introduction column; Execute reserves
a flexible right-aligned timeline, readable candidates, and at least 280px for the notes, reclaiming the calendar
view rail and daily-canvas margins. Narrow landscape screens keep native compact
layouts and show introductions below the workspace. Portrait screens on all three
routes show only text, shared navigation, and expanded FAQ answers; no iframe or
interactive product workspace is mounted. Rotating the viewport switches between
these presentations and disposes of the old demo. Landscape AI retains its existing
preview layout.
Planning and Execute insert navigation into the real App header through an optional
runtime slot, reusing WorkspaceModeTabs and the existing site controls. It returns
home from the logo and links to all three features,
with Principles and personal-site placeholders. Support includes Afdian and GitHub.
Homepage content, navigation, and animation remain intact. Feature subtitles,
including Navo AI, use the same enlarged title-size token as the main introduction.
Introductions and native display type use Times New Roman; candidate project names
use regular sans-serif type. Today's Candidates uses the task font and a more generous
column width. The first scrolling paragraph includes a short scroll cue. FAQ
stays below each page. Full-window demo dates are read-only, and calendar view switching,
date arrows/dropdowns, Back to now, and floating Add/AI launchers are omitted from the native
Planning/Execute demo render path. Formal /app and the dedicated AI workspace keep
these controls so its panel can be closed and reopened. Mobile task/schedule switching,
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
one expanded website project and two initially collapsed projects that can be expanded,
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
