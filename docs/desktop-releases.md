# Desktop Beta releases

Until the user explicitly approves stable releases, every new release uses
`x.x.x-beta.N` (for example `1.5.2-beta.1`) and the tag `vx.x.x-beta.N`.
Display the version as `x.x.x Beta` in the app and release title. Increment the
Beta ordinal for further builds of the same base version; never overwrite an
existing tag, release or asset. Existing stable releases remain intact.

`npm run dist` validates the Beta policy, builds without publishing, verifies the
installer checksum and size, and prepares all five assets in `D:/navopath-build`:

- `latest.yml`
- `beta.yml`
- `NavoPath-Setup.exe`
- `NavoPath-Setup.exe.blockmap`
- `NavoPath-Portable.exe`

The two YAML files describe the same Beta installer. `beta.yml` serves opted-in
clients; `latest.yml` preserves the desktop asset contract. GitHub marks these
releases as prereleases, so stable clients continue to resolve GitHub's stable
Latest release. The presence of `latest.yml` on a prerelease does not promote it
to the stable channel.

The Desktop Release workflow rejects a mismatched tag, refuses existing
releases, uploads the complete asset set to a draft, then publishes it as a
prerelease with `--latest=false`. It runs `scripts/verify-release.mjs` against
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
