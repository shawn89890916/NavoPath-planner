const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { createDockWindowService, dockWindowBounds } = require("./dock-window.cjs");

class FakeWindow extends EventEmitter {
  constructor({ maximized = false, fullScreen = false } = {}) {
    super();
    this.bounds = { x: -1400, y: 60, width: 1200, height: 740 };
    this.normalBounds = { ...this.bounds };
    this.minimumSize = [1180, 720];
    this.maximized = maximized;
    this.fullScreen = fullScreen;
    this.resizable = this.movable = this.maximizable = this.fullScreenable = true;
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

function setup(options) {
  const win = new FakeWindow(options);
  const handlers = new Map();
  const screen = new EventEmitter();
  screen.displays = [
    { id: 1, workArea: { x: 0, y: 0, width: 1920, height: 1040 } },
    { id: 2, workArea: { x: -1600, y: 40, width: 1600, height: 860 } },
  ];
  screen.getAllDisplays = () => screen.displays;
  screen.getDisplayMatching = (bounds) => screen.displays.find((display) => (
    bounds.x >= display.workArea.x && bounds.x < display.workArea.x + display.workArea.width
  )) || screen.displays[0];
  const service = createDockWindowService({
    ipcMain: { handle: (channel, handler) => handlers.set(channel, handler) },
    screen,
    canControl: (event) => event.role === "app",
    getWindow: (event) => event.win,
  });
  service.registerIpc();
  service.watchDisplays();
  const event = { role: "app", win };
  return {
    win, screen, event,
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
