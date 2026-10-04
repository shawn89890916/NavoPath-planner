# Product feature pages

Public routes: `/features/planning`, `/features/execute`, `/features/ai`.
Each page contains a short bilingual introduction, the running product workspace,
brief notes, FAQ, and navigation to the next feature. Homepage content and animation
remain intact; the navigation adds Product, Support, a sliding language switch, and
Start now. Personal-site navigation stays disabled until its URL is supplied.

`siteEntry.tsx` installs `productDemoRuntime.ts` for `/product-demo/:feature` and
then imports the same `main.tsx` used by `/app`. There is no separately assembled
workspace renderer. Native App owns layout, cards, menus, drag/drop, timeline,
planning views, scheduling, AI previews, and undo. Product CSS determines their
geometry. Demo CSS contains only viewport containment, omitted account launchers,
preset buttons, and notes in the unused candidate space.

The demo installs a memory PlannerApi before browser fallback initialization.
`workspaceEnvironment.ts` supplies memory storage and a fixed example clock to App;
regular app routes retain their normal API, storage, and clock. Account services,
real AI requests, notification onboarding, and cloud synchronization are skipped.
Refreshing the iframe restores the fixture. Presets produce real AI messages and
schedule actions; native App applies or undoes them using timeline records. Open AI
input, providers, attachments, and account controls are outside demo scope.

Parent/iframe messages validate source windows and origin. The parent lazy mounts
near the viewport and offers retry after initialization failure. Visibility messages
pause offscreen animations. Scrolling does not replace user changes. Planning has
three expanded projects, no subtasks, and four enabled native views. Examples use a
fixed day, fifteen-minute scheduling, and the product's conflict utilities.

Verify native planning/execute mode switching, candidate add/remove, scheduling,
rescheduling, AI preview apply/undo, account storage/network isolation, deep links,
language, menus, reduced motion, and 390×844 / 360×800 layouts. Run build, targeted
or full tests as required by AGENTS.md, CSS, terminology, changelog, diff and size
checks. Feature scripts/styles have 16 KB / 4 KB Brotli budgets. Existing workflows
run on main and tags; a feature-branch push does not deploy production.
