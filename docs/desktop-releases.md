# Desktop releases

The owner explicitly approved stable release `1.6.3` on 2026-11-05. Stable
releases use `x.x.x` semver and the `latest` channel. The build guard and
workflow allow only the explicitly approved stable versions `1.6.0` and
`1.6.3`. Every new stable version requires explicit owner approval and an update
to the policy, build guard, workflow and tests. Beta
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

The installer and portable executable include the same complete x64 payload.
Each file has its own compressed stream so unchanged runtime files can be copied
during updates. The runtime uses a 64 MiB dictionary and `app.asar` uses 1 MiB.
On Windows builds, the main executable uses BCJ2 and the native NSIS decoder
must reproduce the SHA-512 of every payload file before either artifact is built.
When changing compression settings or the 7-Zip version, also check SHA-512
reconstruction with the updater blockmaps. An encoding change can make the
first update substantially larger.

The Desktop Release workflow rejects a mismatched tag, refuses existing
releases, uploads the complete asset set to a draft, then publishes it on the
channel selected by the version. It runs `scripts/verify-release.mjs` against
the real version tag after publishing. For an explicitly dispatched run on
`desktop-beta` with a new Beta version, the workflow creates its immutable
semver tag at the built commit only after a successful build. Existing tags
and releases are never overwritten. If upload fails, the draft stays private;
inspect it and use a new version or deliberately repair the incomplete draft.

## Size and Windows memory checks

The desktop release checks the download sizes, installed tree, expected Chromium locales, and production dependencies inside app.asar. The renderer check follows Vite's built import graph for the workspace and widget.

Use the same Electron version and machine when comparing desktop builds. Run the following against each app.asar after closing other benchmark applications.

    node scripts/benchmark-desktop.cjs <path-to-app.asar>

The benchmark launches five isolated local-preview workspaces by default. It reports Windows private bytes for all Electron processes in the workspace, widget, popover, tray, and reopened states. The tray sample is taken after 70 seconds. A unique temporary profile and blocked external renderer requests keep the benchmark isolated from the user's workspace.

Set `NAVOPATH_BENCH_TRAY_CYCLES=1` to measure 20 quick restores and 10 idle
restores per run. Use `NAVOPATH_BENCH_SURFACE` to select `workspace`, `widget`,
`dock`, or `dock-widget`. The idle samples include private bytes while hidden,
peak private bytes during recovery, and samples at 15 and 60 seconds after
activation. The wake time ends after the workspace is visible and two animation
frames have run. Measure versions serially on the same display and scale factor.

For separate diagnostic runs set `NAVOPATH_BENCH_DIAGNOSE=1` to capture DOM and
V8 counters. Set `NAVOPATH_BENCH_TRACE` to a local output path in a single run to
record a Chromium trace. Keep diagnosis and any shortened idle timeout out of
the acceptance measurements.

Run the same benchmark with `NAVOPATH_BENCH_LOW_MEMORY=1` to enable the Windows
tray preference in the isolated benchmark profile. The benchmark records the
active GPU features alongside the samples in tray-cycle mode.

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

Stable release `1.6.3` is approved for publication as the next release.
