# Repository agent instructions

## Product changelog

Every agent turn that changes user-visible behavior must update `CHANGELOG.md` before delivery.

- Add or refine the entry for the current local date.
- Keep Chinese and English sections semantically mirrored.
- Record only important user-visible additions, improvements, and fixes.
- Merge overlapping bullets from the same day instead of appending implementation details.
- Do not mention exploration, commands, filenames, internal refactors, or intermediate failures.
- Run `node scripts/changelog-maintain.mjs` after editing and `node scripts/changelog-maintain.mjs --check` before delivery.

Visual and interaction work must follow `NavoPathStyle.md`.

## Feature removal

- When a feature is removed or replaced, remove its implementation in the same
  change. Audit entry points, UI, styles, assets, state, feature flags, tests,
  generated files, and active documentation. Delete code and resources that
  only served the retired feature.
- Move callers onto the current implementation. Remove obsolete routes,
  shortcuts, fallback controls, and onboarding steps with the old UI. Handle
  any existing user data cleanup at the data boundary.
- Check the former entry points across supported layouts, including space
  reserved for removed controls, and inspect the build for retired code and assets.

## CSS architecture

- Every component owns one canonical style surface; shared UI and behavior must
  reuse the existing primitives and `TaskBlock` variants.
- Do not add historical override layers or duplicate compatibility DOM. Prefer
  tokens, shared components, and the canonical application stylesheet.
- Do not add `!important` without a documented, testable reason. Keep the
  normalized application allowlist at 24 declarations or fewer.
- Before deleting CSS, JSX, or event code, confirm there are no static or
  dynamic callsites and record any intentional selector allowlist in the CSS
  architecture check.
- Run `npm run css:check` when changing CSS, components, or style imports.

## Reuse-first UI implementation

- Before adding or replacing a component, hook, utility, event handler, CSS
  selector, or icon, find the existing owner and check how its callers use it.
  Prefer reusing it as-is, then composing it, then making a focused change
  at the shared owner.
- Fix or extend existing components in place. A new implementation or a rewrite
  requires a distinct requirement that the existing owner cannot reasonably
  support. Explain that requirement in the change summary. When replacing an
  implementation, migrate its callers before retiring the old path.
- Reuse `TaskBlock`, `ExecutionSharedLayout`, `Button`, `IconButton`, `Modal`,
  and the canonical [`UiIcons`](src/components/UiIcons.tsx) registry. Do not
  add a second inline SVG for an icon already present in the registry.
- Keep one source of truth for shared state, formatting, validation, and
  interaction behavior. Execute, Planning, widgets, and responsive layouts
  compose the same implementation wherever they share a contract. Keep
  layout-specific differences at the caller or express them through a supported
  variant on the shared component.
- Shared icons must keep their accessible label on the owning button; the icon
  itself remains decorative unless it is the labeled control.
- Delete a duplicate implementation in the same change after checking static
  and dynamic callsites. Do not preserve parallel aliases or compatibility DOM
  without a documented migration reason.
- Keep shared behavior and visual rules in their owning component. Page-level
  code may compose shared primitives, but it must not redefine their base
  geometry, icon drawing, or interaction states.
- Check the available shared code before adding a dependency or moving code into
  a shared module. Preserve lazy loading for optional features and keep shared
  modules focused so widget and workspace startup load only what they use.
- When changing a shared component, verify the affected callers for appearance,
  keyboard interaction, state transitions, and accessibility. Apply the bundle
  size verification policy when the change can materially affect shipped size.

## Verification policy

Use proportional verification so small changes stay fast without weakening the
release gate.

- During implementation, run only the tests and checks related to the changed
  area. Prefer targeted unit tests, TypeScript checks, and a focused browser flow
  over the complete test suite.
- For small visual or interaction fixes, verify the affected viewport and user
  flow in a real browser. Do not run `npm test` locally by default.
- Run `npm test` locally only when the change affects persistence, migrations,
  synchronization, authentication, security, Electron IPC or updates,
  cross-cutting core logic, dependencies or build tooling, or when the user asks
  for a full local test run.
- GitHub Actions remains the authoritative full-suite gate after every push.
  Follow the workflow to completion and report any failure.
- Run `npm run size:check` locally only when JavaScript or CSS bundle output could
  materially change. The deployment workflow still enforces the size limits.
- Product-code changes must pass `npm run build` before publishing. Documentation-
  only and agent-instruction-only changes may skip the product build.

## Protected product contracts

- `NavoPathStyle.md` is the visual source of truth. Do not replace its palette,
  theme-variable rules, or editorial interaction language with generic defaults.
- The application icon must keep a transparent outer canvas, a white front-facing
  `N`, and black extrusion/shadow. Never ship a white/colored background or a black
  front face. Keep `public/navopath-icon.png`, `build/icon.ico`, and the editable
  source in sync, and verify alpha transparency before publishing.
- Desktop releases must include `latest.yml`, `NavoPath-Setup.exe`, its `.blockmap`,
  and `NavoPath-Portable.exe` under a real semver tag. Do not publish updater assets
  to an `untagged-*` URL, overwrite an existing version, or change the GitHub
  provider in `package.json`.
- The in-app `View release notes` action must continue to open the product changelog
  route (`/changelog`) rather than a transient GitHub asset or draft-release URL.
- Any user-visible change requires mirrored Chinese and English `CHANGELOG.md`
  entries and a version bump before a desktop release.
- Until the user explicitly approves stable releases, all new releases must use
  `x.x.x-beta.N` semver tags, display `x.x.x Beta`, and be published as GitHub
  prereleases without becoming Latest. Include both `beta.yml` and `latest.yml`
  with the complete desktop assets. Beta updates require an explicit, default-off
  device opt-in. Disabling Beta updates must never downgrade the installed app.
  Follow [`docs/desktop-releases.md`](docs/desktop-releases.md).

## End-of-turn GitHub publish

After every conversation that changes files in this repository, finish the turn by publishing the completed work to GitHub:

1. Apply the verification policy above. For product-code changes, run
   `npm run build` and stop the publish flow if it fails.
2. Run `git status` and inspect the diff so the commit scope is understood.
3. Stage the completed work with `git add .` only after confirming all current changes belong to the conversation.
4. Commit with a concise, descriptive message derived from the completed work; never use a placeholder such as `xxx`.
5. Push the current branch with `git push` (or `git push -u origin <branch>` when it has no upstream).

Do not create empty commits when the worktree is clean. Never hide build, commit, or push failures; report them before delivery. Do not stage unrelated user changes silently.

## Desktop Beta handoff (owner decision, 2026-11-26)

For every NavoPath change, prepare the next desktop Beta so the owner only needs to open the Desktop Release workflow, select `desktop-beta`, and click Run workflow. Do not stop at an isolated PR. Check the latest published Beta and current desktop-beta SHA before integrating; preserve existing functionality when main and desktop-beta diverge. Integrate authorized changes, resolve conflicts, bump the unused Beta version in package.json and package-lock.json, update mirrored changelog, and push the tested candidate to desktop-beta. If local verification is unavailable, disclose this and require the release workflow to pass the relevant gates before publishing. Never bypass a failed check or claim an unverified release is published. Coordinate compatible backend deployments when required; stable releases remain separately approved.
