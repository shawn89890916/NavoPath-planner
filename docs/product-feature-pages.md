# Product feature pages

Public routes: `/features/planning`, `/features/execute`, `/features/ai`.
Planning and Execute fill the window with the running product workspace. Planning
uses compact, clearly indented native task nodes and a right-side introduction.
Execute uses native candidates on the left, introductions in the middle, and the
timeline on the right. Desktop scrolling continuously fades three paragraphs
without replacing the visitor's data. Smaller screens keep native compact layouts
and show introductions below the workspace. AI retains its existing preview layout.
Planning and Execute insert navigation into the real App header through an optional
runtime slot, reusing WorkspaceModeTabs and the existing site controls. It returns
home from the logo and links to all three features,
with Principles and personal-site placeholders. Support includes Afdian and GitHub.
Homepage content, navigation, and animation remain intact. FAQ stays below each page.

`siteEntry.tsx` installs `productDemoRuntime.ts` for `/product-demo/:feature` and
then imports the same `main.tsx` used by `/app`. There is no separately assembled
workspace renderer. Native App owns layout, cards, menus, drag/drop, timeline,
planning views, scheduling, AI previews, and undo. Product CSS determines their
geometry. The full-window presentation is a scoped variant in canonical product CSS;
regular /app retains its geometry. ProductStory fills an optional native layout slot.
Demo CSS owns introduction opacity, preset buttons, and viewport containment.

The demo installs a memory PlannerApi before browser fallback initialization.
`workspaceEnvironment.ts` supplies memory storage and a fixed example clock to App;
regular app routes retain their normal API, storage, and clock. Account services,
real AI requests, notification onboarding, and cloud synchronization are skipped.
Refreshing the iframe restores the fixture. Presets produce real AI messages and
schedule actions; native App applies or undoes them using timeline records. Open AI
input, providers, attachments, and account controls are outside demo scope.

Parent/iframe messages validate source windows and origin. The parent lazy mounts
near the viewport and offers retry after initialization failure. Visibility messages
pause offscreen animations. A validated story message selects the highlighted
paragraph; it does not replace user changes. Planning has
three expanded projects, no subtasks, and four enabled native views. Examples use a
fixed day, fifteen-minute scheduling, and the product's conflict utilities.

Verify native planning/execute mode switching, candidate add/remove, scheduling,
rescheduling, AI preview apply/undo, account storage/network isolation, deep links,
language, menus, reduced motion, and 390×844 / 360×800 layouts. Run build, targeted
or full tests as required by AGENTS.md, CSS, terminology, changelog, diff and size
checks. Feature scripts/styles have 16 KB / 4 KB Brotli budgets. Existing workflows
run on main and tags; a feature-branch push does not deploy production.
