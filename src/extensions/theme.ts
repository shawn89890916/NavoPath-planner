import type { ExtensionPackage, PackageFile, ThemeOption } from "./types";

const MIME: Record<string, string> = { svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", avif: "image/avif", woff: "font/woff", woff2: "font/woff2", ttf: "font/ttf", otf: "font/otf" };

function fileBlob(path: string, file: PackageFile) {
  const type = MIME[path.split(".").pop()?.toLowerCase() ?? ""] ?? "application/octet-stream";
  if (file.encoding === "utf8") return new Blob([file.data], { type });
  return new Blob([Uint8Array.from(atob(file.data), (character) => character.charCodeAt(0))], { type });
}

function optionValue(option: ThemeOption, value: unknown): string {
  if (option.type === "number") {
    const number = Number(value);
    if (!Number.isFinite(number)) return String(option.default);
    return String(Math.max(option.min ?? -Infinity, Math.min(option.max ?? Infinity, number)));
  }
  if (option.type === "boolean") return value === true ? "1" : "0";
  const text = String(value);
  // Values remain a single declaration; theme options cannot inject selectors.
  return /[;{}<>]/.test(text) ? String(option.default) : text;
}

/** Community CSS follows the base stylesheet; explicit workspace choices stay inline. */
export function applyExtensionTheme(pkg: ExtensionPackage | null, options: Record<string, unknown>): () => void {
  if (!pkg || pkg.manifest.kind !== "theme" || !pkg.manifest.styles) return () => {};
  const stylesheet = pkg.files[pkg.manifest.styles];
  if (!stylesheet || stylesheet.encoding !== "utf8") return () => {};
  const urls = new Map<string, string>();
  const base = new URL(pkg.manifest.styles, "https://navopath-package.invalid/");
  const css = stylesheet.data.replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/gi, (original, _quote: string, raw: string) => {
    const path = raw.trim().replace(/^navopath-resource:\/\//, "");
    if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(path)) return original;
    const resolved = new URL(path, base);
    let key: string;
    try { key = decodeURIComponent(resolved.pathname.replace(/^\//, "")); } catch { return original; }
    const file = pkg.files[key];
    if (!file) return original;
    if (!urls.has(key)) urls.set(key, URL.createObjectURL(fileBlob(key, file)));
    return `url("${urls.get(key)}${resolved.hash}")`;
  });
  const style = document.createElement("style");
  style.dataset.navopathExtensionTheme = pkg.manifest.id;
  style.textContent = css;
  const custom = document.createElement("style");
  custom.dataset.navopathExtensionOptions = pkg.manifest.id;
  custom.textContent = `body, .df-app, .df-mobile-dock, .df-mobile-floating-actions, .df-widget-root, .df-widget-popover-root {${(pkg.manifest.options ?? [])
    .filter((option) => /^--[a-zA-Z][\w-]*$/.test(option.variable))
    .map((option) => `${option.variable}:${optionValue(option, options[option.key] ?? option.default)}`)
    .join(";")}}`;
  document.head.append(style, custom);
  return () => { style.remove(); custom.remove(); for (const url of urls.values()) URL.revokeObjectURL(url); };
}
