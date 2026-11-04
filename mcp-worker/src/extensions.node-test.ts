// @ts-nocheck -- Worker compilation omits Node typings, as do the other Node test files.
import assert from "node:assert/strict";
import test from "node:test";
import { validatePluginPreferences } from "./extensions.ts";

const manifest = {
  id: "class-timetable", name: "Class Timetable", description: "Import weekly classes.", author: "Community",
  version: "1.0.0", minAppVersion: "1.6.2-beta.1", kind: "plugin", apiVersion: 1,
  platforms: ["desktop", "web", "mobile"], main: "main.js",
};

test("validates and preserves a custom plugin source and enabled package", () => {
  const preferences = validatePluginPreferences({
    version: 1,
    sources: [{ id: "community", name: "Community", url: "https://example.com/catalog.json" }],
    installed: { "community:class-timetable": {
      key: "community:class-timetable", sourceId: "community", manifest, sha256: "a".repeat(64),
      downloadUrl: "https://example.com/class-timetable.navopackage.json", enabled: true,
      installedAt: "2026-11-04T00:00:00.000Z", updatedAt: "2026-11-04T00:00:00.000Z",
    } },
    removed: {}, activeTheme: null, autoCheckUpdates: true, autoUpdate: false,
  });
  assert.equal(preferences.installed["community:class-timetable"].enabled, true);
  assert.ok(preferences.sources.some(source => source.id === "official"));
});

test("rejects malformed or unsafe plugin preferences", () => {
  assert.throws(() => validatePluginPreferences({ version: 1 }), /complete version 1/);
  const unsafeSource = { version: 1, sources: [{ id: "community", name: "Community", url: "http://127.0.0.1/catalog.json" }], installed: {}, removed: {} };
  assert.throws(() => validatePluginPreferences(unsafeSource), /invalid source/);
  const invalidManifest = { ...manifest, id: "../escape" };
  const invalidPackage = {
    version: 1, sources: [], removed: {}, installed: { "official:../escape": {
      key: "official:../escape", sourceId: "official", manifest: invalidManifest, sha256: "b".repeat(64), enabled: true,
      installedAt: "2026-11-04T00:00:00.000Z",
    } },
  };
  assert.throws(() => validatePluginPreferences(invalidPackage), /invalid installed entry/);
});
