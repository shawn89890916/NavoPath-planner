const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { setTimeout: delay } = require("node:timers/promises");

const args = process.argv.slice(2);
const source = path.resolve(args[0] || ".");
const repeats = Number(args[1] || 5);
const settle = Number(args[2] || 15_000);
const traySettle = Number(args[3] || 70_000);

if (process.versions.electron) {
  runDesktop().catch((error) => {
    console.error(error);
    require("electron").app.exit(1);
  });
} else {
  runSamples().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

async function runSamples() {
  if (!Number.isInteger(repeats) || repeats < 1 || ![settle, traySettle].every((value) => Number.isFinite(value) && value >= 0)) {
    throw new Error("Usage: node scripts/benchmark-desktop.cjs [app directory or app.asar] [runs] [settle ms] [tray settle ms]");
  }
  const executable = require("electron");
  const results = [];
  for (let run = 0; run < repeats; run += 1) {
    const profile = await fs.promises.mkdtemp(path.join(os.tmpdir(), "navopath-bench-"));
    const result = await new Promise((resolve, reject) => {
      const child = spawn(executable, [__filename, source, "1", String(settle), String(traySettle)], {
        env: { ...process.env, NAVOPATH_BENCH_PROFILE: profile },
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
      const timeout = setTimeout(() => child.kill(), 6 * settle + traySettle + 90_000);
      let stdout = "";
      let stderr = "";
      child.stdout.setEncoding("utf8").on("data", (chunk) => { stdout += chunk; });
      child.stderr.setEncoding("utf8").on("data", (chunk) => { stderr += chunk; });
      child.once("error", reject);
      child.once("close", (code) => {
        clearTimeout(timeout);
        const line = stdout.split(/\r?\n/).find((text) => text.startsWith("NAVOPATH_BENCH "));
        if (code !== 0 || !line) reject(new Error(stderr || stdout || "Benchmark app exited with " + code));
        else {
          if (process.env.NAVOPATH_BENCH_SMOKE === "1" || process.env.NAVOPATH_BENCH_MONTH === "1") console.log(stdout.split(/\r?\n/).find((text) => text.startsWith("Verified ")));
          resolve(JSON.parse(line.slice("NAVOPATH_BENCH ".length)));
        }
      });
    }).finally(() => fs.promises.rm(profile, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 }));
    results.push(result);
    console.log(JSON.stringify({ run: run + 1, ...result }));
  }
  const medians = Object.fromEntries(Object.keys(results[0]).map((name) => {
    const values = results.map((run) => run[name].privateMiB).sort((a, b) => a - b);
    const center = Math.floor(values.length / 2);
    return [name, values.length % 2 ? values[center] : (values[center - 1] + values[center]) / 2];
  }));
  console.log(JSON.stringify({ medianPrivateMiB: medians }));
}

async function runDesktop() {
  const { app, BrowserWindow, session } = require("electron");
  const profile = process.env.NAVOPATH_BENCH_PROFILE;
  if (!profile || !path.basename(profile).startsWith("navopath-bench-")) throw new Error("Benchmark requires its isolated profile");
  app.setPath("userData", profile);
  app.setPath("sessionData", profile);
  app.setAsDefaultProtocolClient = () => false;
  app.commandLine.appendSwitch("disable-background-networking");
  delete process.env.VITE_DEV_SERVER_URL;

  app.whenReady().then(() => {
    session.defaultSession.webRequest.onBeforeRequest({ urls: ["http://*/*", "https://*/*"] }, (_request, callback) => callback({ cancel: true }));
  });
  const loadFile = BrowserWindow.prototype.loadFile;
  BrowserWindow.prototype.loadFile = function (file, options = {}) {
    return loadFile.call(this, file, {
      ...options,
      query: { ...options.query, preview: "local" },
    });
  };

  require(path.join(source, "electron", "main.cjs"));
  await app.whenReady();
  const main = await until(() => BrowserWindow.getAllWindows().find((win) => !win.getParentWindow()));
  await until(() => main.webContents.executeJavaScript("Boolean(document.querySelector('.df-execute'))").catch(() => false));
  if (process.env.NAVOPATH_BENCH_SMOKE === "1") await verifyWorkbench(main);
  const metrics = {};
  const sample = (name) => {
    const processes = app.getAppMetrics().map(({ pid, type, memory }) => {
      if (typeof memory.privateBytes !== "number") throw new Error("Windows process private bytes are unavailable");
      return { pid, type, privateMiB: Math.round(memory.privateBytes / 1024 * 100) / 100 };
    });
    metrics[name] = {
      privateMiB: Math.round(processes.reduce((total, process) => total + process.privateMiB, 0) * 100) / 100,
      processes,
    };
  };

  await delay(settle);
  sample("workspace");
  if (process.env.NAVOPATH_BENCH_MONTH === "1") {
    const navigate = (key) => main.webContents.executeJavaScript("document.dispatchEvent(new KeyboardEvent('keydown', { key: " + JSON.stringify(key) + ", bubbles: true }))");
    await navigate("m");
    await until(() => main.webContents.executeJavaScript("Boolean(document.querySelector('.df-month-week-row'))"));
    await delay(settle);
    const rows = await main.webContents.executeJavaScript("document.querySelectorAll('.df-month-week-row').length");
    console.log("Verified month renders " + rows + " week rows");
    sample("month");
    await navigate("d");
    await until(() => main.webContents.executeJavaScript("Boolean(document.querySelector('.df-timeline-daily'))"));
    await delay(settle);
    sample("afterMonth");
  }
  await main.webContents.executeJavaScript("desktopApi.widget.open()");
  const widget = await until(() => BrowserWindow.getAllWindows().find((win) => win !== main && win.webContents.getURL().includes("widget=1")));
  await until(() => widget.webContents.executeJavaScript("document.querySelector('#root')?.childElementCount > 0 && !document.querySelector('.boot-skeleton')").catch(() => false));
  await delay(settle);
  sample("widget");
  await widget.webContents.executeJavaScript("desktopApi.widget.togglePopover()");
  await until(() => BrowserWindow.getAllWindows().find((win) => win.getParentWindow() === widget && win.isVisible()));
  await delay(Math.min(settle, 1_000));
  sample("popover");
  await main.webContents.executeJavaScript("desktopApi.widget.close()");
  main.close();
  await delay(traySettle);
  if (process.env.NAVOPATH_BENCH_SMOKE === "1") {
    await until(() => main.webContents.executeJavaScript("!document.querySelector('.df-execute')"));
  }
  sample("tray");
  app.emit("activate");
  await until(() => main.isVisible() && main.webContents.executeJavaScript("Boolean(document.querySelector('.df-execute'))").catch(() => false));
  await delay(settle);
  sample("reopened");
  console.log("NAVOPATH_BENCH " + JSON.stringify(metrics));
  app.quit();
}


async function verifyWorkbench(main) {
  const { BrowserWindow } = require("electron");
  const execute = (expression) => main.webContents.executeJavaScript(expression);
  const key = (key) => execute("document.dispatchEvent(new KeyboardEvent('keydown', { key: " + JSON.stringify(key) + ", bubbles: true }))");
  const sees = (selector) => execute("Boolean(document.querySelector(" + JSON.stringify(selector) + "))");
  const click = (selector) => execute("document.querySelector(" + JSON.stringify(selector) + ").click()");
  const checks = [];
  const bytes = await execute("desktopApi.extensions.readOfficialPackage('kanban').then(bytes => JSON.parse(new TextDecoder().decode(bytes)).manifest.id)");
  if (bytes !== "kanban") throw new Error("Bundled Kanban package is unavailable");
  checks.push("bundled extension");

  await key("p");
  await until(() => sees(".df-planning"));
  await click(".df-project-filter-anchor .df-filter-trigger");
  await until(() => sees(".df-project-filter-anchor .df-filter-panel"));
  const completionFilter = ".df-project-filter-anchor .df-filter-panel input[type=checkbox]";
  await click(completionFilter);
  await key("e");
  await until(async () => !(await sees(".df-planning")));
  for (let count = 0; count < 5; count++) {
    await key("p");
    await until(() => sees(".df-planning"));
    await until(() => sees(".df-project-filter-anchor .df-filter-trigger.has-active"));
    await key("e");
    await until(async () => !(await sees(".df-planning")));
  }
  checks.push("planning mount and unmount");

  await key("m");
  await until(() => sees(".df-month-view"));
  await key("d");
  await until(() => sees(".df-timeline-daily"));
  checks.push("month and day view");

  await execute("desktopApi.dockWindow.setSide('right')");
  await until(() => BrowserWindow.getAllWindows().find((win) => win.webContents.getURL().includes("dock-handle.html")));
  await execute("desktopApi.dockWindow.undock()");
  await until(() => main.isVisible());
  checks.push("native dock and undock");
  console.log("Verified " + checks.join(", "));
}

async function until(callback) {
  const end = Date.now() + 25_000;
  while (Date.now() < end) {
    const value = await callback();
    if (value) return value;
    await delay(200);
  }
  throw new Error("Timed out waiting for a benchmark window or interface");
}
