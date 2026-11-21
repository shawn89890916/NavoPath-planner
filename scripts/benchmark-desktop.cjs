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
const trayCycles = process.env.NAVOPATH_BENCH_TRAY_CYCLES === "1";
const diagnose = process.env.NAVOPATH_BENCH_DIAGNOSE === "1";
const shortIdleMs = Number(process.env.NAVOPATH_BENCH_SHORT_IDLE_MS || 0);
const quickCycles = Number(process.env.NAVOPATH_BENCH_QUICK_CYCLES || 20);
const parkedCycles = Number(process.env.NAVOPATH_BENCH_PARKED_CYCLES || 10);
const recoveryMs = shortIdleMs ? [500, 2_000] : [15_000, 60_000];
const surface = process.env.NAVOPATH_BENCH_SURFACE || "workspace";
const idleTreatment = process.env.NAVOPATH_BENCH_IDLE_TREATMENT || "default";
const tracePath = process.env.NAVOPATH_BENCH_TRACE;
const lowMemoryMode = process.env.NAVOPATH_BENCH_LOW_MEMORY === "1";

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
  if (trayCycles && (![shortIdleMs, quickCycles, parkedCycles].every((value) => Number.isInteger(value) && value >= 0)
    || !parkedCycles || (!shortIdleMs && traySettle < 70_000) || (shortIdleMs && (!diagnose || traySettle <= shortIdleMs))
    || !["workspace", "widget", "dock", "dock-widget"].includes(surface)
    || !["default", "keep-mounted", "hide-content"].includes(idleTreatment)
    || (!diagnose && idleTreatment !== "default") || (tracePath && (!diagnose || repeats !== 1)))) {
    throw new Error("Use a tray wait of at least 70 seconds and a valid surface. Shorter timers require diagnostic mode.");
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
      const sequenceMs = trayCycles ? parkedCycles * (traySettle + recoveryMs.at(-1) + 2_000) + quickCycles * 2_000 : traySettle;
      const timeout = setTimeout(() => child.kill(), 6 * settle + sequenceMs + 90_000);
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
  if (trayCycles) {
    const parked = results.flatMap((run) => run.parked);
    console.log(JSON.stringify({
      surface,
      diagnose,
      idleTreatment,
      samples: parked.length,
      trayMedianMiB: percentile(parked.map((cycle) => cycle.hidden.privateMiB), 0.5),
      recoveredMedianMiB: percentile(parked.map((cycle) => cycle.recovered.at(-1).privateMiB), 0.5),
      lateGrowthMedianMiB: parkedCycles > 1
        ? percentile(results.map(({ parked }) => parked.at(-1).recovered.at(-1).privateMiB - parked[0].recovered.at(-1).privateMiB), 0.5)
        : null,
      parkedWakeP95Ms: percentile(parked.map((cycle) => cycle.wakeMs), 0.95),
      quickWakeP95Ms: percentile(results.flatMap((run) => run.quick.map((cycle) => cycle.wakeMs)), 0.95),
    }));
    return;
  }
  const medians = Object.fromEntries(Object.keys(results[0]).map((name) => {
    const values = results.map((run) => run[name].privateMiB).sort((a, b) => a - b);
    const center = Math.floor(values.length / 2);
    return [name, values.length % 2 ? values[center] : (values[center - 1] + values[center]) / 2];
  }));
  console.log(JSON.stringify({ medianPrivateMiB: medians }));
}

function percentile(samples, fraction) {
  if (!samples.length) return null;
  const sorted = [...samples].sort((a, b) => a - b);
  const index = fraction === 0.5 ? (sorted.length - 1) / 2 : Math.ceil(sorted.length * fraction) - 1;
  return (sorted[Math.floor(index)] + sorted[Math.ceil(index)]) / 2;
}

async function runDesktop() {
  const { app, BrowserWindow, contentTracing, screen, session } = require("electron");
  const profile = process.env.NAVOPATH_BENCH_PROFILE;
  if (!profile || !path.basename(profile).startsWith("navopath-bench-")) throw new Error("Benchmark requires its isolated profile");
  app.setPath("userData", profile);
  app.setPath("sessionData", profile);
  if (lowMemoryMode) {
    const { writeLowMemoryMode } = require(path.join(source, "electron", "device-preferences.cjs"));
    writeLowMemoryMode(path.join(profile, "rendering-preferences.json"), true);
  }
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

  const lifecycle = require(path.join(source, "electron", "window-lifecycle.cjs"));
  const originalTrackTrayIdle = lifecycle.trackTrayIdle;
  if (trayCycles && originalTrackTrayIdle && shortIdleMs) {
    lifecycle.trackTrayIdle = (win) => originalTrackTrayIdle(win, {
      setTimeout: (callback) => setTimeout(callback, shortIdleMs),
      clearTimeout,
    });
  }
  require(path.join(source, "electron", "main.cjs"));
  await app.whenReady();
  const main = await until(() => BrowserWindow.getAllWindows().find((win) => !win.getParentWindow()));
  await until(() => main.webContents.executeJavaScript("Boolean(document.querySelector('.df-execute'))").catch(() => false));
  if (process.env.NAVOPATH_BENCH_SMOKE === "1") await verifyWorkbench(main);
  const metrics = {};
  const sample = (name) => { metrics[name] = sampleMemory(app); };

  if (trayCycles) {
    const parksWorkspace = Boolean(originalTrackTrayIdle) && idleTreatment === "default";
    if (idleTreatment !== "default") {
      const contents = main.webContents;
      const send = contents.send.bind(contents);
      contents.send = (channel, ...args) => {
        if (channel !== "workspace:idle") return send(channel, ...args);
        if (idleTreatment === "hide-content") {
          void contents.executeJavaScript(`document.getElementById("root").style.display = ${args[0] ? '"none"' : '""'}`).catch(console.error);
        }
      };
    }
    if (tracePath) {
      await contentTracing.startRecording({
        included_categories: ["gpu", "viz", "cc", "v8", "disabled-by-default-memory-infra"],
        memory_dump_config: { triggers: [{ type: "periodic_interval", mode: "light", min_time_between_dumps_ms: 2_000 }] },
        trace_buffer_size_in_kb: 16_384,
        recording_mode: "record-continuously",
      });
    }
    const cycles = await measureTrayCycles(app, BrowserWindow, main, parksWorkspace);
    if (tracePath) await contentTracing.stopRecording(path.resolve(tracePath));
    const { size, scaleFactor } = screen.getDisplayMatching(main.getBounds());
    console.log("NAVOPATH_BENCH " + JSON.stringify({
      electron: process.versions.electron, chrome: process.versions.chrome, size, scaleFactor,
      lowMemoryMode, gpu: app.getGPUFeatureStatus(), ...cycles,
    }));
    app.quit();
    return;
  }

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

function sampleMemory(app) {
  const processes = app.getAppMetrics().map(({ pid, type, memory }) => {
    if (typeof memory.privateBytes !== "number") throw new Error("Windows process private bytes are unavailable");
    return { pid, type, privateMiB: Math.round(memory.privateBytes / 1024 * 100) / 100 };
  });
  return {
    privateMiB: Math.round(processes.reduce((total, process) => total + process.privateMiB, 0) * 100) / 100,
    processes,
  };
}

async function measureTrayCycles(app, BrowserWindow, main, supportsParking) {
  const execute = (expression) => main.webContents.executeJavaScript(expression);
  const workspace = () => execute("Boolean(document.querySelector('.df-execute'))");
  if (surface.includes("widget")) {
    await execute("desktopApi.widget.open()");
    const widget = await until(() => BrowserWindow.getAllWindows().find((win) => win !== main && win.webContents.getURL().includes("widget=1")));
    await until(() => widget.webContents.executeJavaScript("Boolean(document.querySelector('#root')?.childElementCount && !document.querySelector('.boot-skeleton'))").catch(() => false));
  }
  if (surface.includes("dock")) {
    await execute("desktopApi.dockWindow.setSide('right')");
    await until(() => BrowserWindow.getAllWindows().find((win) => win.webContents.getURL().includes("dock-handle.html")));
  }

  const debuggerClient = main.webContents.debugger;
  if (diagnose) debuggerClient.attach("1.3");
  const sample = async () => {
    const memory = sampleMemory(app);
    if (diagnose) {
      memory.dom = await debuggerClient.sendCommand("Memory.getDOMCounters");
      memory.heap = await debuggerClient.sendCommand("Runtime.getHeapUsage");
    }
    return memory;
  };
  await delay(settle);
  const hide = async () => {
    main.close();
    await until(() => !main.isVisible(), 20);
  };
  const wake = async () => {
    const start = performance.now();
    app.emit("activate");
    await until(() => main.isVisible() && workspace(), 15);
    await execute("new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true))))");
    return performance.now() - start;
  };
  const quick = [];
  const baseline = await sample();
  for (let index = 0; index < quickCycles; index++) {
    await hide();
    await delay(300);
    quick.push({ wakeMs: await wake() });
    await delay(200);
  }
  const parked = [];
  for (let index = 0; index < parkedCycles; index++) {
    await hide();
    await delay(traySettle);
    const workspaceMounted = await workspace();
    if (supportsParking && workspaceMounted && !surface.includes("dock")) {
      throw new Error("Expected the idle workspace to be parked before restoring");
    }
    const hidden = await sample();
    let peak = hidden;
    const trackPeak = () => {
      const current = sampleMemory(app);
      if (current.privateMiB > peak.privateMiB) peak = current;
    };
    const interval = setInterval(trackPeak, 250);
    try {
      const start = performance.now();
      const wakeMs = await wake();
      trackPeak();
      const recovered = [];
      for (const target of recoveryMs) {
        await delay(Math.max(0, target - (performance.now() - start)));
        recovered.push({ elapsedMs: target, ...await sample() });
      }
      parked.push({ hidden, workspaceMounted, wakeMs, peak, recovered });
    } finally {
      clearInterval(interval);
    }
  }
  return { baseline, quick, parked };
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

async function until(callback, pollMs = 200) {
  const end = Date.now() + 25_000;
  while (Date.now() < end) {
    const value = await callback();
    if (value) return value;
    await delay(pollMs);
  }
  throw new Error("Timed out waiting for a benchmark window or interface");
}
