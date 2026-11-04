import type { ExtensionManifest, ExtensionPackage, ExtensionPlatform, ExtensionPreferences, ExtensionSource, InstalledExtension } from "./types";
import type { Settings } from "../types";

export const APP_VERSION = "1.6.3-beta.5";
export const OFFICIAL_SOURCE: ExtensionSource = { id: "official", name: "NavoPath Community", url: "https://raw.githubusercontent.com/shawn89890916/NavoPath-planner/main/public/extensions/catalog.json" };
export const MAX_PACKAGE_BYTES = 20 * 1024 * 1024;
export const MAX_EXPANDED_BYTES = 32 * 1024 * 1024;
export const isRecord = (value: unknown): value is Record<string, any> => !!value && typeof value === "object" && !Array.isArray(value);
const safeId = (value: unknown) => typeof value === "string" && /^[a-z0-9][a-z0-9._-]{0,79}$/.test(value) && !["constructor", "prototype", "__proto__"].includes(value);
export function safePath(path: string): boolean { return !!path && path.length < 240 && !path.startsWith("/") && !path.includes("\\") && !path.includes(":") && path.split("/").every(part => part && part !== "." && part !== ".." && !["__proto__", "constructor", "prototype"].includes(part)); }
export function validateManifest(input: unknown): ExtensionManifest {
  if (!isRecord(input) || !safeId(input.id) || !["plugin", "theme"].includes(input.kind) || input.apiVersion !== 1) throw new Error("Invalid extension manifest / 插件声明无效");
  for (const key of ["name", "description", "author", "version", "minAppVersion"]) if (typeof input[key] !== "string" || !input[key].trim() || input[key].length > 2000) throw new Error(`Invalid manifest ${key}`);
  if (![input.version, input.minAppVersion].every(v => /^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(v))) throw new Error("Invalid extension version");
  if (!Array.isArray(input.platforms) || !input.platforms.length || !input.platforms.every((p: unknown) => ["desktop", "web", "mobile"].includes(p as string))) throw new Error("Invalid extension platforms");
  for (const key of ["main", "desktop", "styles", "icon"]) if (input[key] !== undefined && (typeof input[key] !== "string" || !safePath(input[key]))) throw new Error(`Invalid entry ${key}`);
  if (input.icon !== undefined && !/\.svg$/i.test(input.icon)) throw new Error("Plugin icon must be an SVG file");
  if (input.previews !== undefined && (!isRecord(input.previews) || typeof input.previews.light !== "string" || typeof input.previews.dark !== "string")) throw new Error("Previews require light and dark images");
  for (const preview of [input.preview, input.previews?.light, input.previews?.dark]) if (preview !== undefined && (typeof preview !== "string" || !safePath(preview) || !/\.(?:png|jpe?g|webp|avif)$/i.test(preview))) throw new Error("Preview must be a package-relative raster image");
  if (input.kind === "plugin" && !input.main) throw new Error("Plugin main.js is required");
  if (input.kind === "theme" && (input.main || input.desktop)) throw new Error("Themes contain CSS and resources only");
  if (input.options !== undefined && (!Array.isArray(input.options) || input.options.length > 100 || input.options.some((o: any) => !isRecord(o) || !safeId(o.key) || typeof o.label !== "string" || !/^--[a-z][a-z0-9-]*$/.test(o.variable) || !["color", "number", "string", "boolean"].includes(o.type) || !["string", "number", "boolean"].includes(typeof o.default)))) throw new Error("Invalid theme options");
  return structuredClone(input) as ExtensionManifest;
}
export function compareVersions(a: string, b: string): number {
  const av = a.split("-")[0].split(".").map(Number), bv = b.split("-")[0].split(".").map(Number);
  for (let i = 0; i < 3; i++) if (av[i] !== bv[i]) return av[i] > bv[i] ? 1 : -1;
  const ap = a.split("-").slice(1).join("-"), bp = b.split("-").slice(1).join("-");
  if (!ap || !bp) return Number(!ap) - Number(!bp);
  const ai = ap.split("."), bi = bp.split(".");
  for (let i = 0; i < Math.max(ai.length, bi.length); i++) {
    if (ai[i] === bi[i]) continue;
    if (ai[i] === undefined || bi[i] === undefined) return ai[i] === undefined ? -1 : 1;
    const an = /^\d+$/.test(ai[i]), bn = /^\d+$/.test(bi[i]);
    if (an !== bn) return an ? -1 : 1;
    return an ? Number(ai[i]) - Number(bi[i]) : ai[i] < bi[i] ? -1 : 1;
  }
  return 0;
}
export function compatibility(manifest: ExtensionManifest, platform: ExtensionPlatform): string | null {
  if (!manifest.platforms.includes(platform)) return `Unsupported on ${platform} / 当前平台不兼容`;
  if (manifest.apiVersion !== 1 || compareVersions(APP_VERSION, manifest.minAppVersion) < 0) return `Requires NavoPath ${manifest.minAppVersion}`;
  return null;
}
export function publicHttps(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.hash || (url.port && url.port !== "443")) throw new Error("Use a public HTTPS URL / 请使用公开 HTTPS 地址");
  if (/^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|\[)/i.test(url.hostname) || /\.(local|internal)$/.test(url.hostname)) throw new Error("Local addresses are not supported");
  return url.href;
}
export async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes.slice().buffer);
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
}
export async function readPackage(bytes: Uint8Array): Promise<ExtensionPackage> {
  if (bytes.length > MAX_PACKAGE_BYTES) throw new Error("Package exceeds 20 MiB");
  let pkg: ExtensionPackage;
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    const { unzipSync, strFromU8 } = await import("fflate");
    let expanded = 0, count = 0;
    const entries = unzipSync(bytes, { filter(file) {
      if (file.name.endsWith("/")) return false;
      if (!safePath(file.name) || ++count > 512 || (expanded += file.originalSize) > MAX_EXPANDED_BYTES) throw new Error("Unsafe or oversized archive");
      return true;
    } });
    const manifestPaths = Object.keys(entries).filter(p => p === "manifest.json" || /^[^/]+\/manifest\.json$/.test(p));
    if (manifestPaths.length !== 1) throw new Error("Package needs one root manifest.json");
    const manifestPath = manifestPaths[0], prefix = manifestPath.slice(0, -"manifest.json".length);
    const files: ExtensionPackage["files"] = Object.create(null);
    for (const [path, content] of Object.entries(entries)) {
      if (!path.startsWith(prefix) || path === manifestPath) continue;
      const name = path.slice(prefix.length);
      if (/\.(?:[cm]?js|css|json|md|txt|svg)$/i.test(name)) files[name] = { encoding: "utf8", data: strFromU8(content) };
      else files[name] = { encoding: "base64", data: bytesToBase64(content) };
    }
    pkg = { manifest: JSON.parse(strFromU8(entries[manifestPath])), files };
    return validatePackage(pkg);
  }
  return parsePackage(bytes);
}
export function parsePackage(bytes: Uint8Array): ExtensionPackage {
  if (bytes.length > MAX_PACKAGE_BYTES) throw new Error("Package exceeds 20 MiB");
  return validatePackage(JSON.parse(new TextDecoder().decode(bytes)));
}
function validatePackage(pkg: ExtensionPackage): ExtensionPackage {
  if (!isRecord(pkg) || !isRecord(pkg.files) || Object.keys(pkg.files).length > 512) throw new Error("Invalid package files");
  pkg.manifest = validateManifest(pkg.manifest);
  let total = 0;
  for (const [path, file] of Object.entries(pkg.files)) {
    if (!safePath(path) || !isRecord(file) || !["utf8", "base64"].includes(file.encoding) || typeof file.data !== "string" || (total += file.data.length) > MAX_EXPANDED_BYTES) throw new Error("Invalid package resource");
    if (file.encoding === "base64" && !/^[A-Za-z0-9+/]*={0,2}$/.test(file.data)) throw new Error("Invalid base64 resource");
  }
  if (pkg.manifest.kind === "theme" && !pkg.manifest.styles) pkg.manifest.styles = "theme.css";
  for (const entry of [pkg.manifest.main, pkg.manifest.desktop, pkg.manifest.styles]) {
    if (entry && (!pkg.files[entry] || pkg.files[entry].encoding !== "utf8")) throw new Error(`Missing text entry: ${entry}`);
  }
  if (pkg.manifest.icon) {
    const icon = pkg.files[pkg.manifest.icon];
    const source = icon?.data ?? "";
    const viewBox = source.match(/\bviewBox\s*=\s*["']([^"']+)["']/i)?.[1].trim().split(/[\s,]+/).map(Number);
    const squareViewBox = viewBox?.length === 4 && viewBox[0] === 0 && viewBox[1] === 0 && viewBox[2] === 24 && viewBox[3] === 24;
    if (!icon || icon.encoding !== "utf8" || source.length > 64 * 1024 || !/^\s*<svg\b[\s\S]*<\/svg>\s*$/i.test(source) || !squareViewBox || /<(?:script|foreignObject|image)\b|\bon[a-z]+\s*=|\b(?:href|url)\s*=?/i.test(source) || /(?:fill|stroke)\s*=\s*["'](?!none|currentColor)[^"']+/i.test(source)) throw new Error("Plugin icon must be a bundled, square monochrome SVG using currentColor");
  }
  for (const preview of [pkg.manifest.preview, pkg.manifest.previews?.light, pkg.manifest.previews?.dark]) if (preview && pkg.files[preview]?.encoding !== "base64") throw new Error("Missing binary preview resource");
  return pkg;
}
export function bytesToBase64(bytes: Uint8Array): string { let text = ""; for (let i = 0; i < bytes.length; i += 8192) text += String.fromCharCode(...bytes.subarray(i, i + 8192)); return btoa(text); }
export function base64ToBytes(value: string): Uint8Array { return Uint8Array.from(atob(value), c => c.charCodeAt(0)); }
export function defaultExtensionPreferences(): ExtensionPreferences { return { version: 1, sources: [OFFICIAL_SOURCE], installed: {}, removed: {}, activeTheme: null, autoCheckUpdates: true, autoUpdate: false }; }
export function normalizeExtensionPreferences(input: unknown): ExtensionPreferences {
  const defaults = defaultExtensionPreferences();
  if (!isRecord(input)) return defaults;
  const result: ExtensionPreferences = { ...defaults, autoCheckUpdates: input.autoCheckUpdates !== false, autoUpdate: input.autoUpdate === true, migratedLegacy: input.migratedLegacy === true, migratedPlanningViews: input.migratedPlanningViews === true, headerOrder: Array.isArray(input.headerOrder) ? [...new Set(input.headerOrder.filter((key): key is string => typeof key === "string" && /^[a-z0-9][a-z0-9._-]{0,79}:[a-z0-9][a-z0-9._-]{0,79}$/.test(key)))].slice(0, 100) : [], updatedAt: typeof input.updatedAt === "string" ? input.updatedAt : undefined };
  if (Array.isArray(input.sources)) result.sources = input.sources.slice(0, 30).flatMap((s: any) => { try { return isRecord(s) && safeId(s.id) && typeof s.name === "string" ? [{ id: s.id, name: s.name.slice(0, 200), url: publicHttps(s.url) }] : []; } catch { return []; } });
  if (!result.sources.some(s => s.id === "official")) result.sources.unshift(OFFICIAL_SOURCE);
  if (isRecord(input.removed)) for (const [key, value] of Object.entries(input.removed).slice(0, 1000)) if (/^[a-z0-9][a-z0-9._-]{0,79}:[a-z0-9][a-z0-9._-]{0,79}$/.test(key) && typeof value === "string" && Number.isFinite(Date.parse(value))) result.removed[key] = value;
  if (isRecord(input.installed)) for (const [key, value] of Object.entries(input.installed).slice(0, 100)) { try {
    if (!isRecord(value) || !safeId(value.sourceId) || !/^[a-f0-9]{64}$/.test(value.sha256)) continue;
    const manifest = validateManifest(value.manifest);
    if (key !== `${value.sourceId}:${manifest.id}`) continue;
    const item: InstalledExtension = { ...value, key, manifest, enabled: value.enabled === true } as InstalledExtension;
    if (value.downloadUrl) item.downloadUrl = publicHttps(value.downloadUrl);
    if (Date.parse(result.removed[key] || "") >= Date.parse(value.updatedAt || value.installedAt)) continue;
    result.installed[key] = item;
  } catch { /* Keep other valid installed extensions. */ } }
  if (typeof input.activeTheme === "string" && result.installed[input.activeTheme]?.manifest.kind === "theme") result.activeTheme = input.activeTheme;
  return result;
}
export function mergeExtensionPreferences(remote: unknown, local: unknown): ExtensionPreferences {
  const a = normalizeExtensionPreferences(remote), b = normalizeExtensionPreferences(local);
  const newer = Date.parse(a.updatedAt || "1970-01-01") > Date.parse(b.updatedAt || "1970-01-01") ? a : b;
  const merged = { ...newer, installed: { ...a.installed }, removed: { ...a.removed } };
  for (const [key, date] of Object.entries(b.removed)) if (!merged.removed[key] || date > merged.removed[key]) merged.removed[key] = date;
  for (const [key, item] of Object.entries(b.installed)) if (!merged.installed[key] || (item.updatedAt || item.installedAt) >= (merged.installed[key].updatedAt || merged.installed[key].installedAt)) merged.installed[key] = item;
  return normalizeExtensionPreferences(merged);
}
export function mergeExtensionSettings(remote: Settings, patch: Partial<Settings>): Settings {
  const merged = { ...remote, ...patch };
  if (patch.extensions) merged.extensions = mergeExtensionPreferences(remote.extensions, patch.extensions);
  if (patch.extensionConfigs) {
    const configs = { ...remote.extensionConfigs }, dates = { ...remote.extensionConfigUpdatedAt };
    for (const [key, config] of Object.entries(patch.extensionConfigs)) {
      const incoming = patch.extensionConfigUpdatedAt?.[key] || "1970-01-01";
      if (!configs[key] || incoming >= (dates[key] || "1970-01-01")) { configs[key] = config; dates[key] = incoming; }
    }
    merged.extensionConfigs = configs; merged.extensionConfigUpdatedAt = dates;
  }
  return merged;
}
