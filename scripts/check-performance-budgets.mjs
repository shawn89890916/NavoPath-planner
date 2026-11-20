import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const root = path.resolve(import.meta.dirname, "..");
const dist = path.join(root, "dist");
const require = createRequire(import.meta.url);

function check(label, bytes, maxBytes) {
  console.log(label + ": " + (bytes / 1e6).toFixed(3) + " MB / " + maxBytes / 1e6 + " MB");
  if (bytes > maxBytes) throw new Error(label + " exceeds its size budget");
}

async function treeSize(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const bytes = await Promise.all(entries.map(async (entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return treeSize(target);
    return (await stat(target)).size;
  }));
  return bytes.reduce((total, size) => total + size, 0);
}

async function checkFrontend() {
  const manifest = JSON.parse(await readFile(path.join(dist, ".vite", "manifest.json"), "utf8"));
  const main = Object.keys(manifest).find((key) => manifest[key].name === "main" && manifest[key].file.endsWith(".js"));
  function staticFiles(entries) {
    const visited = new Set();
    const files = new Set();
    function visit(key) {
      if (visited.has(key)) return;
      visited.add(key);
      const record = manifest[key];
      if (!record) throw new Error("Missing Vite manifest record: " + key);
      for (const file of [record.file, ...(record.css ?? []), ...(record.assets ?? [])]) files.add(file);
      for (const parent of record.imports ?? []) visit(parent);
    }
    for (const key of entries) visit(key);
    return [...files];
  }

  async function checkRoute(label, assets, limit) {
    const sizes = await Promise.all(assets.map(async (asset) => (await stat(path.join(dist, asset))).size));
    check(label, sizes.reduce((sum, size) => sum + size, 0), limit);
  }

  const widget = staticFiles(["index.html", "src/widget/WidgetApp.tsx"]);
  if (widget.some((file) => /\/(?:main-|supabase-|workspaceEnvironment-|PlanningView-|SettingsPanel-)/.test(file))) {
    throw new Error("The widget's startup graph contains workspace resources");
  }
  await checkRoute("Widget startup resources", widget, 260_000);
  await checkRoute("Cloud workspace startup resources", staticFiles(["index.html", main, "src/supabasePlannerApi.ts"]), 1_680_000);
  await check("Complete Vite output", await treeSize(dist), 10_100_000);
}

async function checkDesktop() {
  const manifest = require("../package.json");
  const output = path.resolve(manifest.build.directories.output);
  const installed = path.join(output, "win-unpacked");
  const archive = path.join(installed, "resources", "app.asar");
  const { getRawHeader, listPackage } = require("@electron/asar");
  const { header } = getRawHeader(archive);
  const modules = header.files.node_modules?.files ?? {};
  if (!modules["electron-updater"] || ["lucide-react", "three", "@capacitor", "react-markdown", "remark-gfm", "fflate"].some((name) => name in modules)) {
    throw new Error("Unexpected Electron runtime dependencies in app.asar");
  }
  if (Object.keys(header.files.electron.files).some((file) => file.endsWith(".test.cjs"))) {
    throw new Error("Desktop checks must stay outside the shipping archive");
  }
  if (listPackage(archive).some((file) => /\.m?js\.map$/.test(file))) {
    throw new Error("JavaScript source maps must stay outside the shipping archive");
  }
  const locales = (await readdir(path.join(installed, "locales"))).filter((file) => file.endsWith(".pak")).sort();
  const expected = manifest.build.win.electronLanguages.map((locale) => locale + ".pak").sort();
  if (locales.join(",") !== expected.join(",")) throw new Error("Unexpected Chromium locales: " + locales.join(", "));

  await check("Electron app.asar", (await stat(archive)).size, 15_000_000);
  await check("Windows installed directory", await treeSize(installed), 355_000_000);
  for (const file of ["NavoPath-Setup.exe", "NavoPath-Portable.exe"]) {
    check(file, (await stat(path.join(output, file))).size, 112_000_000);
  }
}

if (process.argv.includes("--desktop")) await checkDesktop();
else await checkFrontend();
