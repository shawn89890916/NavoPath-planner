import { describe, expect, it } from "vitest";
import { zipSync, strToU8 } from "fflate";
import { compatibility, mergeExtensionPreferences, normalizeExtensionPreferences, parsePackage, readPackage, sha256 } from "./packages";
import { officialCatalog, officialPackageTexts } from "./officialPackages";

describe("community extension packages", () => {
  it("verifies every shipped offline package against the exact catalog bytes", async () => {
    for (const entry of officialCatalog.packages) {
      if (!officialPackageTexts[entry.manifest.id]) continue;
      const bytes = new TextEncoder().encode(officialPackageTexts[entry.manifest.id]);
      expect(await sha256(bytes)).toBe(entry.sha256);
      expect(parsePackage(bytes).manifest).toEqual(entry.manifest);
    }
  });
  it("loads zipped plugin packages and rejects traversal before extraction", async () => {
    const pkg = parsePackage(new TextEncoder().encode(officialPackageTexts.weather));
    const zip = zipSync({ "weather/manifest.json": strToU8(JSON.stringify(pkg.manifest)), ...Object.fromEntries(Object.entries(pkg.files).map(([name, value]) => [`weather/${name}`, strToU8(value.data)])) });
    expect((await readPackage(zip)).manifest.id).toBe("weather");
    await expect(readPackage(zipSync({ "../outside.js": strToU8("bad") }))).rejects.toThrow("Unsafe");
  });
  it("rejects executable theme manifests and missing entry points", () => {
    const pkg = JSON.parse(officialPackageTexts.linen); pkg.manifest.main = "main.js";
    expect(() => parsePackage(strToU8(JSON.stringify(pkg)))).toThrow("CSS and resources only");
    const plugin = JSON.parse(officialPackageTexts.weather); delete plugin.files[plugin.manifest.main];
    expect(() => parsePackage(strToU8(JSON.stringify(plugin)))).toThrow("Missing text entry");
  });
  it("retains incompatible installations without pretending they can run", () => {
    const manifest = JSON.parse(officialPackageTexts.weather).manifest;
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
