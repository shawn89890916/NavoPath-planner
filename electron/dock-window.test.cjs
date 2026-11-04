const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { createDockWindowService, dockWindowBounds, dockHandleBounds, normalizeDockPreferences } = require("./dock-window.cjs");

class FakeWindow extends EventEmitter {
  constructor({ maximized = false, fullScreen = false } = {}) {
    super();
    this.bounds = { x: -1400, y: 60, width: 1200, height: 740 };
    this.normalBounds = { ...this.bounds };
    this.minimumSize = [1180, 720];
    this.maximized = maximized;
    this.fullScreen = fullScreen;
    this.resizable = this.movable = this.maximizable = this.fullScreenable = true;
    this.visible = true;
    this.alwaysOnTop = false;
  }
  isDestroyed() { return Boolean(this.destroyed); }
  getBounds() { return { ...this.bounds }; }
  getNormalBounds() { return { ...this.normalBounds }; }
  getMinimumSize() { return [...this.minimumSize]; }
  isMaximized() { return this.maximized; }
  isFullScreen() { return this.fullScreen; }
  isResizable() { return this.resizable; }
  isMovable() { return this.movable; }
  isMaximizable() { return this.maximizable; }
  isFullScreenable() { return this.fullScreenable; }
  isAlwaysOnTop() { return this.alwaysOnTop; }
  isVisible() { return this.visible; }
  setAlwaysOnTop(value) { this.alwaysOnTop = value; }
  setShape(rectangles) { this.shape = rectangles; }
  hide() { this.visible = false; }
  showInactive() { this.visible = true; }
  show() { this.visible = true; }
  focus() { this.focused = true; }
  destroy() { this.destroyed = true; this.emit("closed"); }
  setResizable(value) { this.resizable = value; }
  setMovable(value) { this.movable = value; }
  setMaximizable(value) { this.maximizable = value; }
  setFullScreenable(value) { this.fullScreenable = value; }
  setMinimumSize(...size) { this.minimumSize = size; }
  setFullScreen(value) { this.fullScreen = value; }
  maximize() { this.maximized = true; }
  unmaximize() { this.maximized = false; }
  setBounds(bounds) {
    this.bounds = { ...bounds,
      width: Math.max(bounds.width, this.minimumSize[0]),
      height: Math.max(bounds.height, this.minimumSize[1]),
    };
    this.normalBounds = { ...this.bounds };
  }
}

function setup(options, saved = {}) {
  const win = new FakeWindow(options);
  const handlers = new Map();
  const screen = new EventEmitter();
  screen.displays = [
    { id: 1, workArea: { x: 0, y: 0, width: 1920, height: 1040 } },
    { id: 2, workArea: { x: -1600, y: 40, width: 1600, height: 860 } },
  ];
  screen.getAllDisplays = () => screen.displays;
  screen.point = { x: 800, y: 400 };
  screen.getCursorScreenPoint = () => screen.point;
  let poll = null;
  let clock = 0;
  const handles = [];
  const handleHandlers = new Map();
  screen.getDisplayMatching = (bounds) => screen.displays.find((display) => (
    bounds.x >= display.workArea.x && bounds.x < display.workArea.x + display.workArea.width
  )) || screen.displays[0];
  const service = createDockWindowService({
    ipcMain: { handle: (channel, handler) => handlers.set(channel, handler) },
    screen,
    canControl: (event) => event.role === "app",
    getWindow: (event) => event.win,
    now: () => clock,
    readPreferences: () => saved,
    writePreferences: (value) => { saved = value; },
    handleIpcMain: { handle: (channel, handler) => handleHandlers.set(channel, handler) },
    createHandle: () => {
      const handle = new FakeWindow();
      handle.minimumSize = [0, 0];
      handle.webContents = { mainFrame: {}, sent: [], send(channel, value) { this.sent.push([channel, value]); } };
      handles.push(handle);
      return handle;
    },
    timers: {
      setInterval: (callback) => { poll = callback; return { unref() {} }; },
      clearInterval: () => { poll = null; },
    },
  });
  service.registerIpc();
  service.watchDisplays();
  const event = { role: "app", win };
  return {
    win, screen, event, handles,
    tick: (point, elapsed = 75) => { clock += elapsed; screen.point = point; poll?.(); },
    preferences: (patch, sender = event) => patch === undefined
      ? handlers.get("dock-window:get-preferences")(sender)
      : handlers.get("dock-window:set-preferences")(sender, patch),
    saved: () => saved,
    handleAction: (action, sender) => {
      const handle = handles.at(-1);
      return handleHandlers.get(`dock-handle:${action}`)(sender || { sender: handle.webContents, senderFrame: handle.webContents.mainFrame });
    },
    polling: () => Boolean(poll),
    set: (side, sender = event) => handlers.get("dock-window:set-side")(sender, side),
    get: (sender = event) => handlers.get("dock-window:get-side")(sender),
  };
}

test("dock geometry fits both edges, taskbars, negative monitor coordinates, and short screens", () => {
  const area = { x: -1600, y: 40, width: 1600, height: 860 };
  assert.deepEqual(dockWindowBounds(area, "left"), { x: -1600, y: 40, width: 420, height: 860 });
  assert.deepEqual(dockWindowBounds(area, "right"), { x: -420, y: 40, width: 420, height: 860 });
  const small = dockWindowBounds({ x: 0, y: 0, width: 300, height: 360 }, "right");
  assert.equal(small.x + small.width, 300);
  assert.ok(small.width < small.height);
});

test("docks the sender window, switches sides, and restores its original geometry and constraints", () => {
  const { win, get, set } = setup();
  const original = win.getBounds();
  assert.equal(get(), null);
  assert.equal(set(null), null);
  assert.equal(set("left"), "left");
  assert.equal(win.bounds.width, 420);
  assert.equal(win.bounds.x, -1600);
  assert.deepEqual(win.minimumSize, [0, 0]);
  assert.equal(win.resizable, false);
  assert.equal(win.movable, false);
  assert.equal(win.maximizable, false);
  assert.equal(win.fullScreenable, false);
  assert.equal(win.visible, false);
  set("right");
  set("right");
  assert.equal(get(), "right");
  assert.equal(win.bounds.x, -420);
  set(null);
  assert.deepEqual(win.bounds, original);
  assert.deepEqual(win.minimumSize, [1180, 720]);
  assert.equal(win.resizable, true);
  assert.equal(win.movable, true);
  assert.equal(win.maximizable, true);
  assert.equal(win.fullScreenable, true);
  assert.equal(win.listenerCount("closed"), 0);
  assert.equal(win.visible, true);
  assert.equal(win.focused, true);
});

test("only dwelling on the visible tab opens the panel, with a grace period on leaving", () => {
  const { win, set, tick, polling } = setup();
  set("left");
  assert.equal(polling(), true);
  tick({ x: -1500, y: 100 });
  assert.equal(win.visible, false);
  tick({ x: -1600, y: 20 });
  assert.equal(win.visible, false);
  tick({ x: -1600, y: 100 }, 500);
  assert.equal(win.visible, false);
  tick({ x: -1576, y: 580 }, 500);
  assert.equal(win.visible, false);
  tick({ x: -1600, y: 580 });
  tick({ x: -1600, y: 580 }, 199);
  assert.equal(win.visible, false);
  tick({ x: -1600, y: 580 }, 1);
  assert.equal(win.visible, true);
  assert.equal(win.focused, undefined);
  assert.equal(win.alwaysOnTop, true);
  tick({ x: -1300, y: 200 });
  assert.equal(win.visible, true);
  tick({ x: -1100, y: 200 });
  assert.equal(win.visible, true);
  tick({ x: -1100, y: 200 }, 300);
  assert.equal(win.visible, false);
  assert.equal(win.alwaysOnTop, false);
  set(null);
  assert.equal(polling(), false);
});

test("right edge activation stays on its monitor and preserves an original always-on-top window", () => {
  const { win, set, tick } = setup();
  win.alwaysOnTop = true;
  set("right");
  tick({ x: 0, y: 580 }, 500);
  assert.equal(win.visible, false);
  tick({ x: -1, y: 580 });
  tick({ x: -1, y: 580 }, 300);
  assert.equal(win.visible, true);
  tick({ x: -600, y: 100 });
  tick({ x: -600, y: 100 }, 300);
  assert.equal(win.visible, false);
  assert.equal(win.alwaysOnTop, true);
  set(null);
  assert.equal(win.visible, true);
  assert.equal(win.alwaysOnTop, true);
});

test("the tab uses the work area edge beside a vertical taskbar", () => {
  const { win, screen, set, tick } = setup();
  screen.displays[1].bounds = { x: -1600, y: 0, width: 1600, height: 900 };
  screen.displays[1].workArea.x = -1550;
  screen.displays[1].workArea.width = 1550;
  set("left");
  tick({ x: -1600, y: 100 });
  tick({ x: -1600, y: 100 }, 300);
  assert.equal(win.visible, false);
  tick({ x: -1550, y: 580 });
  tick({ x: -1550, y: 580 }, 300);
  assert.equal(win.visible, true);
  tick({ x: -1570, y: 100 });
  assert.equal(win.visible, true);
  tick({ x: -1400, y: 100 });
  assert.equal(win.visible, true);
});

test("restores a maximized or fullscreen window after docking", () => {
  for (const options of [{ maximized: true }, { fullScreen: true }]) {
    const { win, set } = setup(options);
    set("right");
    assert.equal(win.maximized, false);
    assert.equal(win.fullScreen, false);
    set(null);
    assert.equal(win.maximized, Boolean(options.maximized));
    assert.equal(win.fullScreen, Boolean(options.fullScreen));
  }
});

test("adapts to work area changes and monitor removal, keeping restore reachable", () => {
  const { win, screen, set } = setup();
  set("right");
  screen.displays[1].workArea.width = 1440;
  screen.displays[1].workArea.height = 800;
  screen.emit("display-metrics-changed");
  assert.deepEqual(win.bounds, { x: -580, y: 40, width: 420, height: 800 });
  screen.displays.pop();
  screen.emit("display-removed");
  assert.deepEqual(win.bounds, { x: 1500, y: 0, width: 420, height: 1040 });
  set(null);
  assert.equal(win.bounds.x, 0);
});

test("rejects other renderer roles, missing windows, and malformed sides without changing the window", () => {
  const { win, set, get } = setup();
  const original = win.getBounds();
  assert.throws(() => set("left", { role: "widget", win }), /application window/);
  assert.throws(() => get({ role: "widget", win }), /application window/);
  assert.throws(() => set("left", { role: "app" }), /unavailable/);
  for (const value of ["top", "", undefined, {}, false]) {
    assert.throws(() => set(value), /Invalid dock side/);
  }
  assert.deepEqual(win.bounds, original);
  assert.equal(get(), null);
});

test("keeps independent application windows separate and cleans up closed windows", () => {
  const { win, screen, get, set } = setup();
  const second = new FakeWindow();
  const sender = { role: "app", win: second };
  second.resizable = false;
  set("left");
  set("right", sender);
  set(null);
  assert.equal(get(sender), "right");
  set(null, sender);
  assert.equal(second.resizable, false);
  set("left");
  win.destroyed = true;
  win.emit("closed");
  assert.doesNotThrow(() => screen.emit("display-metrics-changed"));
  assert.throws(() => get(), /unavailable/);
});

test("click mode ignores hovering, clicks focus the panel, and dragging saves position without opening", () => {
  const { win, set, tick, handles, handleAction, preferences, saved } = setup(undefined, { activation: "click" });
  set("left");
  const handle = handles[0];
  assert.equal(handle.visible, true);
  assert.deepEqual(handle.bounds, { x: -1600, y: 557, width: 24, height: 64 });
  assert.deepEqual(handle.shape, [{ x: 0, y: 0, width: 24, height: 64 }]);
  assert.deepEqual(handle.webContents.sent.at(-1), ["dock-handle:set-side", "left"]);
  tick({ x: -1598, y: 580 });
  tick({ x: -1598, y: 580 }, 1000);
  assert.equal(win.visible, false);
  handleAction("press");
  tick({ x: -1598, y: 200 });
  handleAction("release");
  assert.equal(win.visible, false);
  assert.equal(handle.visible, true);
  assert.ok(preferences().position < 30);
  assert.deepEqual(saved(), preferences());
  handleAction("press");
  handleAction("release");
  assert.equal(win.visible, true);
  assert.equal(win.focused, true);
  assert.equal(handle.visible, false);
  tick({ x: -900, y: 200 });
  tick({ x: -900, y: 200 }, 300);
  assert.equal(handle.visible, true);
  set(null);
  assert.equal(handle.destroyed, true);
});

test("a brief pass over the tab and a cancelled drag do not open the panel", () => {
  const { win, set, tick, handleAction, handles } = setup();
  set("left");
  tick({ x: -1600, y: 580 });
  tick({ x: -1400, y: 580 });
  tick({ x: -1600, y: 580 }, 600);
  assert.equal(win.visible, false);
  handleAction("press");
  tick({ x: -1600, y: -2000 }, 1000);
  assert.equal(handles[0].bounds.y, 40);
  handleAction("cancel");
  assert.equal(handles[0].bounds.y, 557);
  assert.equal(win.visible, false);
});

test("preferences clamp geometry, survive a new service, and retain unrelated fields", () => {
  const { win, set, preferences, saved, event } = setup();
  set("left");
  preferences({ activation: "click", handleHeight: 999, position: -20, panelHeight: 60 });
  assert.deepEqual(preferences(), { activation: "click", handleHeight: 160, position: 0, panelHeight: 60 });
  assert.equal(win.bounds.height, 516);
  assert.equal(win.bounds.y, 40);
  preferences({ position: 100 });
  assert.equal(win.bounds.y + win.bounds.height, 900);
  assert.deepEqual(setup(undefined, saved()).preferences(), saved());
  assert.deepEqual(normalizeDockPreferences(null), normalizeDockPreferences({}));
  assert.equal(normalizeDockPreferences({ panelHeight: NaN }).panelHeight, 100);
  assert.equal(normalizeDockPreferences({ handleHeight: Infinity }).handleHeight, 64);
  assert.throws(() => preferences({}, { role: "widget", win }), /application window/);
  assert.throws(() => preferences(null, event), /Invalid dock preferences/);
  const area = { x: -300, y: -200, width: 300, height: 40 };
  assert.deepEqual(dockHandleBounds(area, "right", preferences()), { x: -24, y: -200, width: 24, height: 40 });
});

test("handle IPC rejects app renderers and subframes, and closed owners destroy their handles", () => {
  const { win, set, handles, handleAction } = setup();
  set("left");
  assert.throws(() => handleAction("open", { sender: {}, senderFrame: {} }), /unavailable/);
  assert.throws(() => handleAction("press", { sender: handles[0].webContents, senderFrame: {} }), /unavailable/);
  win.destroy();
  assert.equal(handles[0].destroyed, true);
});
