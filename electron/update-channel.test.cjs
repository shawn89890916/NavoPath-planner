const test = require("node:test");
const assert = require("node:assert/strict");
const { AppUpdater } = require("electron-updater/out/AppUpdater");
const { GitHubProvider } = require("electron-updater/out/providers/GitHubProvider");
const { createDesktopUpdater } = require("./desktop-updater.cjs");

function githubHarness(currentVersion, stableVersion = "1.5.1", feedTags) {
  // Use the installed updater and GitHub provider with a local HTTP fixture.
  // This covers their real prerelease defaults, Atom selection and YAML paths.
  const updater = new AppUpdater(null, { version: currentVersion });
  updater.logger = null;
  updater.isUpdateSupported = () => true;
  updater.isUserWithinRollout = () => true;
  const requests = [];
  const tags = feedTags || ["v1.5.3-alpha.1", "v1.5.2-beta.2", `v${stableVersion}`];
  const provider = new GitHubProvider({ provider: "github", owner: "owner", repo: "repo" }, updater, {
    platform: "win32",
    executor: { request: async ({ path }) => {
      requests.push(path);
      if (path.endsWith(".atom")) return `<feed>${tags.map((tag) => `<entry><title>${tag}</title><link href="https://github.com/owner/repo/releases/tag/${tag}"/><content>Notes</content></entry>`).join("")}</feed>`;
      if (path.endsWith("/latest")) return JSON.stringify({ tag_name: `v${stableVersion}` });
      const tag = path.match(/\/download\/v([^/]+)\//)?.[1];
      assert.ok(tag, `Unexpected request ${path}`);
      if (path.endsWith("/beta.yml") && !tag.includes("-beta.")) throw new Error("404: legacy stable releases have no beta.yml");
      return `version: ${tag}\nfiles:\n  - url: NavoPath-Setup.exe\n    sha512: fixture\n    size: 100\npath: NavoPath-Setup.exe\nsha512: fixture\n`;
    } },
  });
  updater.checkForUpdates = async () => {
    const info = await provider.getLatestVersion();
    if (await updater.isUpdateAvailable(info)) updater.emit("update-available", info);
    else updater.emit("update-not-available", info);
  };
  const service = createDesktopUpdater({
    isPackaged: true, currentVersion, getUpdater: () => updater,
    confirmUpdate: async () => false, onState: () => {},
  });
  return { service, updater, requests };
}

test("real GitHub channel selection excludes prereleases by default and opts into beta.yml", async () => {
  const h = githubHarness("1.5.0");
  await h.service.check();
  assert.equal(h.service.getState().availableVersion, "1.5.1");
  assert.ok(h.requests.includes("/owner/repo/releases/download/v1.5.1/latest.yml"));
  await h.service.setAcceptBetaUpdates(true);
  await h.service.check();
  assert.equal(h.service.getState().availableVersion, "1.5.2-beta.2");
  assert.ok(h.requests.includes("/owner/repo/releases/download/v1.5.2-beta.2/beta.yml"));
  assert.equal(h.requests.some((request) => request.includes("alpha.yml")), false);
});

test("a Beta installation with opt-in off stays installed until a newer stable version exists", async () => {
  const h = githubHarness("1.5.2-beta.1");
  assert.equal(h.updater.allowPrerelease, true, "library infers prerelease from the installed version");
  await h.service.check();
  assert.equal(h.service.getState().status, "current");
  assert.equal(h.updater.allowDowngrade, false);
  assert.equal(h.updater.allowPrerelease, false);
  await h.service.setAcceptBetaUpdates(true);
  await h.service.check();
  assert.equal(h.service.getState().availableVersion, "1.5.2-beta.2");
  await h.service.setAcceptBetaUpdates(false);
  await h.service.check();
  assert.equal(h.service.getState().status, "current");
  const stable = githubHarness("1.5.2-beta.1", "1.5.2");
  await stable.service.check();
  assert.equal(stable.service.getState().availableVersion, "1.5.2");
});

test("Beta opt-in also accepts a newer stable release through its latest.yml manifest", async () => {
  const h = githubHarness("1.5.2-beta.1", "1.5.2", ["v1.5.2", "v1.5.2-beta.2"]);
  await h.service.setAcceptBetaUpdates(true);
  await h.service.check();
  assert.equal(h.service.getState().availableVersion, "1.5.2");
  // The provider first asks the Beta channel then falls back to latest.yml on
  // older stable releases that predate Beta channel assets.
  assert.ok(h.requests.includes("/owner/repo/releases/download/v1.5.2/beta.yml"));
  assert.ok(h.requests.includes("/owner/repo/releases/download/v1.5.2/latest.yml"));
});
