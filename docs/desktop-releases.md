# Desktop releases

The owner explicitly approved stable releases on 2026-11-04, starting with
`1.6.0`. Stable releases use `x.x.x` semver and the `latest` channel. Beta
releases use `x.x.x-beta.N` (for example `1.6.0-beta.1`), display `x.x.x Beta`
in the release title and use the opt-in `beta` channel. Never overwrite an
existing tag, release or asset; increment the Beta ordinal for another build of
the same base version.

`npm run dist` validates the version/channel policy, builds without publishing,
verifies the installer checksum and size, and prepares all five assets in
`D:/navopath-build`:

- `latest.yml`
- `beta.yml`
- `NavoPath-Setup.exe`
- `NavoPath-Setup.exe.blockmap`
- `NavoPath-Portable.exe`

The two YAML files describe the same build. `latest.yml` serves stable clients;
`beta.yml` serves opted-in clients. Beta releases are published as prereleases
with `--latest=false`; stable releases are published as the GitHub Latest
release. Beta updates remain off by default.

The Desktop Release workflow rejects a mismatched tag, refuses existing
releases, uploads the complete asset set to a draft, then publishes it on the
channel selected by the version. It runs `scripts/verify-release.mjs` against
the real version tag after publishing. If upload fails, the draft stays private;
inspect it and use a new version or deliberately repair the incomplete draft.

## Desktop update preference

Accept Beta updates defaults off, including for manually installed Beta builds.
The trusted Electron APIs `getAcceptBetaUpdates()` and
`setAcceptBetaUpdates(boolean)` read and update a per-device preference in
`userData/update-preferences.json`. The main process reads it before the first
automatic check, and writes atomically before acknowledging a setting change.
The renderer hydrates its settings display from that native preference; a cloud
profile cannot silently opt a new device into Beta updates.

When off, the updater explicitly selects `latest` and disables prereleases.
When on, it selects `beta` and permits Beta releases and newer stable releases.
Both paths explicitly disable downgrades, since electron-updater's channel
setter otherwise enables them. Turning Beta updates off while running a newer
Beta keeps that installed version until a newer stable release is available.
Changing channels waits for an active check, confirmation or download to finish,
then clears a deferred offer from the previous channel. It does not revoke an
installation the user already confirmed.

Installed-library integration tests exercise the GitHub Atom release selection,
the real channel manifest URL and semver comparisons. These are offline fixtures;
the post-publication verification checks real release metadata and assets.

Stable publishing requires explicit user approval followed by a deliberate
update of this policy, the build guard, release workflow and tests.
