type Json = Record<string, any>;

const isRecord = (value: unknown): value is Json => !!value && typeof value === "object" && !Array.isArray(value);
const safeId = (value: unknown) => typeof value === "string" && /^[a-z0-9][a-z0-9._-]{0,79}$/.test(value) && !["constructor", "prototype", "__proto__"].includes(value);
const safePath = (value: unknown) => typeof value === "string" && value.length < 240 && !value.startsWith("/") && !value.includes("\\") && !value.includes(":")
  && value.split("/").every(part => part && part !== "." && part !== ".." && !["__proto__", "constructor", "prototype"].includes(part));

function publicHttps(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.hash && (!url.port || url.port === "443")
      && !/^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|\[)/i.test(url.hostname)
      && !/\.(local|internal)$/.test(url.hostname);
  } catch { return false; }
}

function validManifest(value: unknown): value is Json {
  if (!isRecord(value) || !safeId(value.id) || !["plugin", "theme"].includes(value.kind) || value.apiVersion !== 1) return false;
  for (const key of ["name", "description", "author", "version", "minAppVersion"]) {
    if (typeof value[key] !== "string" || !value[key].trim() || value[key].length > 2000) return false;
  }
  if (![value.version, value.minAppVersion].every(version => /^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(version))) return false;
  if (!Array.isArray(value.platforms) || !value.platforms.length || !value.platforms.every((platform: unknown) => ["desktop", "web", "mobile"].includes(platform as string))) return false;
  if (value.kind === "plugin") return safePath(value.main);
  return safePath(value.styles) && !value.main && !value.desktop;
}

export function validatePluginPreferences(value: unknown) {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.sources) || !isRecord(value.installed) || !isRecord(value.removed)) {
    throw new Error("extensions must be a complete version 1 plugin preference object");
  }
  if (new TextEncoder().encode(JSON.stringify(value)).byteLength > 512 * 1024) {
    throw new Error("Plugin preferences exceed 512 KiB");
  }
  if (value.sources.length > 30 || Object.keys(value.installed).length > 100 || Object.keys(value.removed).length > 1000) throw new Error("Plugin preferences exceed item limits");
  const sources = value.sources.map((source: unknown) => {
    if (!isRecord(source) || !safeId(source.id) || typeof source.name !== "string" || !source.name.trim() || source.name.length > 200 || !publicHttps(source.url)) {
      throw new Error("Plugin preferences contain an invalid source");
    }
    return { id: source.id, name: source.name.slice(0, 200), url: new URL(source.url).href };
  });
  if (!sources.some(source => source.id === "official")) {
    sources.unshift({ id: "official", name: "NavoPath Community", url: "https://raw.githubusercontent.com/shawn89890916/NavoPath-planner/main/public/extensions/catalog.json" });
  }
  const installed: Json = {};
  for (const [key, entry] of Object.entries(value.installed)) {
    if (!isRecord(entry) || !safeId(entry.sourceId) || !validManifest(entry.manifest) || key !== `${entry.sourceId}:${entry.manifest.id}`
      || !/^[a-f0-9]{64}$/.test(entry.sha256) || typeof entry.enabled !== "boolean" || !Number.isFinite(Date.parse(entry.installedAt))
      || (entry.downloadUrl !== undefined && !publicHttps(entry.downloadUrl)) || !sources.some(source => source.id === entry.sourceId)) {
      throw new Error("Plugin preferences contain an invalid installed entry");
    }
    installed[key] = { ...entry, key, manifest: entry.manifest, downloadUrl: entry.downloadUrl ? new URL(entry.downloadUrl).href : undefined };
  }
  const removed: Record<string, string> = {};
  for (const [key, removedAt] of Object.entries(value.removed)) {
    if (!/^[a-z0-9][a-z0-9._-]{0,79}:[a-z0-9][a-z0-9._-]{0,79}$/.test(key) || typeof removedAt !== "string" || !Number.isFinite(Date.parse(removedAt))) {
      throw new Error("Plugin preferences contain an invalid removal marker");
    }
    removed[key] = removedAt;
  }
  if (value.activeTheme !== null && typeof value.activeTheme !== "string") throw new Error("Plugin preferences contain an invalid active theme");
  if (typeof value.autoCheckUpdates !== "boolean" || typeof value.autoUpdate !== "boolean") throw new Error("Plugin preferences contain invalid update settings");
  if (value.updatedAt !== undefined && (typeof value.updatedAt !== "string" || !Number.isFinite(Date.parse(value.updatedAt)))) throw new Error("Plugin preferences contain an invalid update time");
  return { ...value, sources, installed, removed };
}
