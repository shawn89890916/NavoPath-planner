import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { zipSync, strToU8 } from "fflate";
import { compareVersions, compatibility, mergeExtensionPreferences, normalizeExtensionPreferences, parsePackage, readPackage, sha256 } from "./packages";
import bundledIds from "../../electron/official-extension-ids.json";
import { officialCatalog } from "./officialCatalog";

const bundledDirectory = new URL("../../public/extensions/packages/", import.meta.url);
const bundledBytes = (id: string) => readFileSync(new URL(`${id}.navopackage.json`, bundledDirectory));
const linenPackageText = bundledBytes("linen").toString("utf8");
const weatherPackageText = bundledBytes("weather").toString("utf8");

describe("community extension packages", () => {
  it("orders numbered prereleases for compatibility and updates", () => {
    expect(compareVersions("1.5.2-beta.2", "1.5.2-beta.1")).toBeGreaterThan(0);
    expect(compareVersions("1.5.2-beta.10", "1.5.2-beta.2")).toBeGreaterThan(0);
    expect(compareVersions("1.5.2-beta.2", "1.5.2")).toBeLessThan(0);
    expect(compareVersions("1.5.2-beta", "1.5.2-beta.1")).toBeLessThan(0);
    expect(compareVersions("1.5.2-beta.2", "1.5.2-beta.2")).toBe(0);
  });
  it("validates both packaged light and dark previews", () => {
    const pkg = JSON.parse(linenPackageText);
    pkg.manifest.previews = { light: pkg.manifest.preview, dark: "missing.png" };
    expect(() => parsePackage(strToU8(JSON.stringify(pkg)))).toThrow("preview resource");
    pkg.manifest.previews.dark = "../dark.png";
    expect(() => parsePackage(strToU8(JSON.stringify(pkg)))).toThrow("raster image");
    delete pkg.manifest.previews.dark;
    expect(() => parsePackage(strToU8(JSON.stringify(pkg)))).toThrow("light and dark");
  });
  it("verifies every shipped offline package against the exact catalog bytes", async () => {
    expect(readdirSync(bundledDirectory).sort()).toEqual(bundledIds.map(id => `${id}.navopackage.json`).sort());
    for (const id of bundledIds) {
      const entry = officialCatalog.packages.find(({ manifest }) => manifest.id === id)!;
      const bytes = new Uint8Array(bundledBytes(id));
      expect(await sha256(bytes)).toBe(entry.sha256);
      expect(parsePackage(bytes).manifest).toEqual(entry.manifest);
    }
  });
  it("loads zipped plugin packages and rejects traversal before extraction", async () => {
    const pkg = parsePackage(new TextEncoder().encode(weatherPackageText));
    const zip = zipSync({ "weather/manifest.json": strToU8(JSON.stringify(pkg.manifest)), ...Object.fromEntries(Object.entries(pkg.files).map(([name, value]) => [`weather/${name}`, strToU8(value.data)])) });
    expect((await readPackage(zip)).manifest.id).toBe("weather");
    await expect(readPackage(zipSync({ "../outside.js": strToU8("bad") }))).rejects.toThrow("Unsafe");
  });
  it("rejects executable theme manifests and missing entry points", () => {
    const pkg = JSON.parse(linenPackageText); pkg.manifest.main = "main.js";
    expect(() => parsePackage(strToU8(JSON.stringify(pkg)))).toThrow("CSS and resources only");
    const plugin = JSON.parse(weatherPackageText); delete plugin.files[plugin.manifest.main];
    expect(() => parsePackage(strToU8(JSON.stringify(plugin)))).toThrow("Missing text entry");
  });
  it("requires packaged raster previews and rejects remote or executable preview paths", () => {
    const pkg = JSON.parse(linenPackageText);
    pkg.manifest.preview = "preview.svg";
    expect(() => parsePackage(strToU8(JSON.stringify(pkg)))).toThrow("raster image");
    pkg.manifest.preview = "https://example.com/preview.png";
    expect(() => parsePackage(strToU8(JSON.stringify(pkg)))).toThrow("package-relative");
    pkg.manifest.preview = "missing.png";
    expect(() => parsePackage(strToU8(JSON.stringify(pkg)))).toThrow("preview resource");
  });
  it("accepts a square currentColor plugin icon and rejects colored or unsafe SVGs", () => {
    const pkg = JSON.parse(weatherPackageText);
    pkg.manifest.icon = "icon.svg";
    pkg.files["icon.svg"] = { encoding: "utf8", data: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" d="M4 4h16v16H4z"/></svg>' };
    expect(parsePackage(strToU8(JSON.stringify(pkg))).manifest.icon).toBe("icon.svg");
    pkg.files["icon.svg"].data = '<svg viewBox="0 0 24 24"><path fill="#ff0000" d="M0 0h24v24z"/></svg>';
    expect(() => parsePackage(strToU8(JSON.stringify(pkg)))).toThrow("monochrome SVG");
    pkg.files["icon.svg"].data = '<svg viewBox="0 0 24 24"><script>alert(1)</script></svg>';
    expect(() => parsePackage(strToU8(JSON.stringify(pkg)))).toThrow("monochrome SVG");
  });
  it("validates host-rendered plugin options and rejects unsafe or ambiguous declarations", () => {
    const pkg = JSON.parse(weatherPackageText);
    pkg.manifest.settingsOptions = [{ key: "refreshMinutes", label: "Refresh", type: "number", default: 15, min: 1, max: 60 }, { key: "units", label: "Units", type: "select", default: "c", choices: [{ value: "c", label: "Celsius" }] }];
    expect(parsePackage(strToU8(JSON.stringify(pkg))).manifest.settingsOptions).toEqual(pkg.manifest.settingsOptions);
    for (const invalid of [{ key: "__proto__", label: "Bad", type: "boolean", default: false }, { key: "refreshMinutes", label: "Duplicate", type: "boolean", default: false }, { key: "bad", label: "Bad", type: "number", default: 100, max: 10 }]) {
      const candidate = { ...pkg, manifest: { ...pkg.manifest, settingsOptions: [...pkg.manifest.settingsOptions, invalid] } };
      expect(() => parsePackage(strToU8(JSON.stringify(candidate)))).toThrow("Invalid plugin settings options");
    }
  });
  it("accepts only the wired protocol 2 preview capabilities and rejects native entries", () => {
    const pkg = JSON.parse(weatherPackageText);
    delete pkg.manifest.styles;
    delete pkg.manifest.settingsOptions;
    delete pkg.manifest.mcp;
    pkg.manifest.apiVersion = 2;
    pkg.manifest.permissions = ["tasks.read", "activity.read", "metrics.provider", "ui.workspace", "ui.planning", "ui.settings", "ui.toast"];
    expect(parsePackage(strToU8(JSON.stringify(pkg))).manifest.apiVersion).toBe(2);
    for (const patch of [
      { permissions: ["storage.write"] }, { permissions: ["storage.read"] },
      { permissions: ["tasks.read", "tasks.read"] }, { permissions: undefined },
      { desktop: "native.js" }, { styles: "styles.css" }, { apiVersion: 3 },
      { kind: "theme" }, { settingsOptions: [] },
    ]) {
      expect(() => parsePackage(strToU8(JSON.stringify({ ...pkg, manifest: { ...pkg.manifest, ...patch } })))).toThrow();
    }
  });
  it("retains incompatible installations without pretending they can run", () => {
    const manifest = JSON.parse(weatherPackageText).manifest;
    expect(compatibility({ ...manifest, platforms: ["desktop"] }, "web")).toContain("Unsupported");
    expect(compatibility({ ...manifest, minAppVersion: "9.0.0" }, "desktop")).toContain("9.0.0");
  });
  it("merges per-plugin changes and tombstones without resurrecting an uninstall", () => {
    const entry = officialCatalog.packages.find(e => e.manifest.id === "weather")!;
    const item = { key: "official:weather", sourceId: "official", manifest: entry.manifest, sha256: entry.sha256, enabled: true, installedAt: "2026-11-01T00:00:00Z", updatedAt: "2026-11-01T00:00:00Z" };
    const remote = normalizeExtensionPreferences({ installed: { [item.key]: item } });
    const local = { ...remote, installed: {}, removed: { [item.key]: "2026-11-02T00:00:00Z" } };
    const merged = mergeExtensionPreferences(remote, local);
    expect(merged.installed[item.key]).toBeUndefined();
    expect(merged.removed[item.key]).toBe("2026-11-02T00:00:00Z");
    const reinstalled = { ...item, updatedAt: "2026-11-03T00:00:00Z" };
    expect(mergeExtensionPreferences(local, { installed: { [item.key]: reinstalled } }).installed[item.key]).toEqual(reinstalled);
  });
});
