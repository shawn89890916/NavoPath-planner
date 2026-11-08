const { DEFAULT_COMPACT_WIDTH } = require("./compact-window.cjs");

const DEFAULT_DOCK_PREFERENCES = { activation: "hover", handleWidth: 3, handleHeight: 64, position: 65, panelHeight: 100 };
const DOCK_HANDLE_HIT_WIDTH = 24;

function normalizeDockPreferences(value = {}) {
  if (!value || typeof value !== "object") value = {};
  const number = (key, min, max) => typeof value[key] === "number" && Number.isFinite(value[key])
    ? Math.round(Math.max(min, Math.min(max, value[key]))) : DEFAULT_DOCK_PREFERENCES[key];
  return {
    activation: value.activation === "click" ? "click" : "hover",
    handleWidth: number("handleWidth", 2, 24),
    handleHeight: number("handleHeight", 32, 8192),
    position: number("position", 0, 100),
    panelHeight: number("panelHeight", 50, 100),
  };
}

function dockWindowBounds(workArea, side, preferences = DEFAULT_DOCK_PREFERENCES) {
  const height = Math.round(workArea.height * preferences.panelHeight / 100);
  const width = Math.min(DEFAULT_COMPACT_WIDTH, workArea.width, Math.floor(height * 0.8));
  return {
    x: side === "left" ? workArea.x : workArea.x + workArea.width - width,
    y: workArea.y + Math.round((workArea.height - height) * preferences.position / 100),
    width,
    height,
  };
}

function dockHandleBounds(workArea, side, preferences) {
  const height = Math.min(preferences.handleHeight, workArea.height);
  const width = Math.min(DOCK_HANDLE_HIT_WIDTH, workArea.width);
  return {
    x: side === "left" ? workArea.x : workArea.x + workArea.width - width,
    y: workArea.y + Math.round((workArea.height - height) * preferences.position / 100),
    width,
    height,
  };
}

function readWindowMode(value) {
  if (!value || (value.side !== "left" && value.side !== "right")) return null;
  const { bounds } = value;
  if (!bounds || ![bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isSafeInteger) || bounds.width <= 0 || bounds.height <= 0) return null;
  return {
    side: value.side,
    bounds: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
    displayId: Number.isSafeInteger(value.displayId) ? value.displayId : null,
    restoreDisplayId: Number.isSafeInteger(value.restoreDisplayId) ? value.restoreDisplayId : null,
    maximized: value.maximized === true,
    fullScreen: value.fullScreen === true,
    alwaysOnTop: value.alwaysOnTop === true,
  };
}

function createDockWindowService({ ipcMain, handleIpcMain, createHandle, screen, getWindow, canControl,
  readPreferences = () => ({}), writePreferences = () => {}, isQuitting = () => false, now = Date.now, timers = { setInterval, clearInterval } }) {
  const docked = new Map();
  const windowRoles = new WeakMap();
  const stored = readPreferences();
  let preferences = normalizeDockPreferences(stored);
  let windowModes = Object.fromEntries(["main", "compact"].flatMap((role) => {
    const mode = readWindowMode(stored?.windowModes?.[role]);
    return mode ? [[role, mode]] : [];
  }));
  let hoverTimer = null;

  function persist(nextPreferences, nextModes) {
    writePreferences(Object.keys(nextModes).length ? { ...nextPreferences, windowModes: nextModes } : nextPreferences);
    preferences = nextPreferences;
    windowModes = nextModes;
  }

  function saveMode(win, mode) {
    const role = windowRoles.get(win);
    if (!role) return;
    const next = { ...windowModes };
    if (mode) next[role] = readWindowMode(mode);
    else delete next[role];
    persist(preferences, next);
  }

  function savePreferences(patch) {
    const next = normalizeDockPreferences({ ...preferences, ...patch });
    persist(next, windowModes);
    for (const [win, state] of docked) {
      applyBounds(win, state);
      state.hoverSince = null;
    }
    return { ...preferences };
  }

  function reveal(win, state, focus = false) {
    state.hoverSince = state.leaveSince = null;
    state.handle?.hide();
    if (win.isMinimized()) win.restore();
    applyBounds(win, state);
    if (focus) { win.show(); win.focus(); } else win.showInactive();
    // Windows 的非激活显示可能保留旧层级；显示后再置顶，不抢走当前输入焦点。
    win.setAlwaysOnTop(true);
    win.moveTop();
  }

  function collapse(win, state) {
    win.hide();
    win.setAlwaysOnTop(state.alwaysOnTop);
    state.hoverSince = state.leaveSince = null;
    state.handle?.showInactive();
  }

  function stopHoverTimer() {
    if (docked.size || hoverTimer === null) return;
    timers.clearInterval(hoverTimer);
    hoverTimer = null;
  }

  function checkPointer() {
    const point = screen.getCursorScreenPoint();
    for (const [win, state] of docked) {
      if (win.isDestroyed()) continue;
      const bounds = win.getBounds();
      const monitor = state.displayBounds;
      const handle = state.handleBounds;
      if (state.drag) {
        updateDrag(state, point);
        continue;
      }
      const nearEdge = point.x >= handle.x && point.x < handle.x + handle.width
        && point.y >= handle.y && point.y < handle.y + handle.height;
      // Include a vertical taskbar between the physical screen edge and the panel.
      const left = state.side === "left" ? monitor.x : bounds.x;
      const right = state.side === "right" ? monitor.x + monitor.width : bounds.x + bounds.width;
      const inside = point.x >= left && point.x < right
        && point.y >= bounds.y && point.y < bounds.y + bounds.height;
      if (!win.isVisible()) {
        if (nearEdge && preferences.activation === "hover") {
          state.hoverSince ??= now();
          if (now() - state.hoverSince >= 200) reveal(win, state);
        } else state.hoverSince = null;
      } else if (win.isVisible() && !inside) {
        state.leaveSince ??= now();
        if (now() - state.leaveSince >= 300) collapse(win, state);
      } else state.leaveSince = null;
    }
  }

  function sendHandleGeometry(state) {
    if (!state.handle || state.handle.isDestroyed()) return;
    state.handle.webContents.send("dock-handle:set-geometry", { width: state.handleBounds.width, height: state.handleBounds.height, visibleWidth: preferences.handleWidth });
  }

  function applyBounds(win, state) {
    const display = screen.getAllDisplays().find((item) => item.id === state.displayId)
      || screen.getDisplayMatching(win.getBounds());
    state.displayId = display.id;
    state.displayBounds = display.bounds || display.workArea;
    state.workArea = display.workArea;
    win.setBounds(dockWindowBounds(display.workArea, state.side, preferences));
    state.handleBounds = dockHandleBounds(display.workArea, state.side, preferences);
    state.handle?.setBounds(state.handleBounds);
    // Windows enforces a native minimum width; clip painting and hit-testing to the tab.
    state.handle?.setShape?.([{ x: 0, y: 0, width: state.handleBounds.width, height: state.handleBounds.height }]);
    sendHandleGeometry(state);
  }

  function updateDrag(state, point) {
    const delta = point.y - state.drag.start.y;
    if (Math.hypot(point.x - state.drag.start.x, delta) > 4) state.drag.moved = true;
    if (!state.drag.moved) return;
    const travel = state.workArea.height - state.handleBounds.height;
    state.drag.position = travel > 0 ? Math.max(0, Math.min(100,
      (state.drag.top + delta - state.workArea.y) / travel * 100)) : 0;
    state.handleBounds = dockHandleBounds(state.workArea, state.side, { ...preferences, position: state.drag.position });
    state.handle?.setBounds(state.handleBounds);
  }

  function setSide(win, side, savedMode = null) {
    if (side !== null && side !== "left" && side !== "right") throw new Error("Invalid dock side.");
    let state = docked.get(win);
    if (side === null) {
      if (!state) return null;
      saveMode(win, null);
      docked.delete(win);
      stopHoverTimer();
      win.removeListener("closed", state.onClosed);
      state.handle?.destroy();
      win.setAlwaysOnTop(state.alwaysOnTop);
      win.setResizable(state.resizable);
      win.setMovable(state.movable);
      win.setMaximizable(state.maximizable);
      win.setFullScreenable(state.fullScreenable);
      // Keep the normal window reachable if its previous monitor was removed.
      const area = screen.getDisplayMatching(state.bounds).workArea;
      const originalDisplayExists = screen.getAllDisplays().some((display) => display.id === state.restoreDisplayId);
      win.setBounds(originalDisplayExists ? state.bounds : {
        ...state.bounds,
        x: Math.max(area.x, Math.min(state.bounds.x, area.x + area.width - state.bounds.width)),
        y: Math.max(area.y, Math.min(state.bounds.y, area.y + area.height - state.bounds.height)),
      });
      win.setMinimumSize(...state.minimumSize);
      if (state.maximized) win.maximize();
      if (state.fullScreen) win.setFullScreen(true);
      win.show();
      win.focus();
      return null;
    }

    if (!state) {
      state = {
        bounds: savedMode?.bounds ?? win.getNormalBounds(),
        minimumSize: win.getMinimumSize(),
        maximized: savedMode?.maximized ?? win.isMaximized(),
        fullScreen: savedMode?.fullScreen ?? win.isFullScreen(),
        resizable: win.isResizable(),
        movable: win.isMovable(),
        maximizable: win.isMaximizable(),
        fullScreenable: win.isFullScreenable(),
        alwaysOnTop: savedMode?.alwaysOnTop ?? win.isAlwaysOnTop(),
        displayId: savedMode?.displayId ?? screen.getDisplayMatching(win.getBounds()).id,
        restoreDisplayId: savedMode?.restoreDisplayId ?? screen.getDisplayMatching(win.getBounds()).id,
        side,
      };
      if (!savedMode) saveMode(win, state);
      docked.set(win, state);
      state.onClosed = () => {
        state.handle?.destroy();
        docked.delete(win);
        stopHoverTimer();
        if (!isQuitting()) {
          try { saveMode(win, null); }
          catch (error) { console.warn("Could not clear saved Dock mode:", error); }
        }
      };
      win.once("closed", state.onClosed);
      state.handle = createHandle?.(side);
      state.handle?.webContents?.once?.("did-finish-load", () => { if (state.handleBounds) sendHandleGeometry(state); });
      if (win.isFullScreen()) win.setFullScreen(false);
      if (win.isMaximized()) win.unmaximize();
      win.setMinimumSize(0, 0);
      win.setResizable(false);
      win.setMovable(false);
      win.setMaximizable(false);
      win.setFullScreenable(false);
    } else if (state.side !== side) saveMode(win, { ...state, side });
    state.side = side;
    state.drag = null;
    state.handle?.webContents?.send("dock-handle:set-side", side);
    applyBounds(win, state);
    collapse(win, state);
    if (hoverTimer === null) {
      hoverTimer = timers.setInterval(checkPointer, 75);
      hoverTimer.unref?.();
    }
    return side;
  }

  function registerIpc() {
    function senderWindow(event) {
      if (!canControl(event)) throw new Error("Dock controls require an application window.");
      const win = getWindow(event);
      if (!win || win.isDestroyed()) throw new Error("Application window is unavailable.");
      return win;
    }
    ipcMain.handle("dock-window:get-side", (event) => docked.get(senderWindow(event))?.side ?? null);
    ipcMain.handle("dock-window:set-side", (event, side) => setSide(senderWindow(event), side));
    ipcMain.handle("dock-window:undock", (event) => undock(senderWindow(event)));
    ipcMain.handle("dock-window:get-preferences", (event) => { senderWindow(event); return { ...preferences }; });
    ipcMain.handle("dock-window:set-preferences", (event, patch) => {
      senderWindow(event);
      if (!patch || typeof patch !== "object" || Array.isArray(patch)) throw new Error("Invalid dock preferences.");
      return savePreferences(patch);
    });
    // This renderer has no application APIs. Its only authority is its own handle.
    for (const action of ["press", "release", "cancel", "open"]) handleIpcMain?.handle(`dock-handle:${action}`, (event) => {
      const entry = [...docked].find(([, state]) => state.handle?.webContents === event.sender
        && event.senderFrame === event.sender.mainFrame);
      if (!entry) throw new Error("Dock handle is unavailable.");
      const [win, state] = entry;
      if (action === "press") {
        state.hoverSince = null;
        state.drag = { start: screen.getCursorScreenPoint(), top: state.handleBounds.y, moved: false };
      } else if (action === "release" && state.drag) {
        updateDrag(state, screen.getCursorScreenPoint());
        const drag = state.drag;
        state.drag = null;
        if (drag.moved) savePreferences({ position: drag.position });
        else reveal(win, state, true);
      } else if (action === "cancel") {
        state.drag = null;
        applyBounds(win, state);
      } else if (action === "open") reveal(win, state, true);
    });
  }

  function undock(win) {
    if (!docked.has(win)) return false;
    setSide(win, null);
    return true;
  }

  function watchDisplays() {
    const refresh = () => {
      for (const [win, state] of docked) {
        if (!win.isDestroyed()) applyBounds(win, state);
      }
    };
    screen.on("display-metrics-changed", refresh);
    screen.on("display-removed", refresh);
  }

  return {
    registerIpc, watchDisplays,
    undock,
    hasSavedMode: (role) => Boolean(windowModes[role]),
    restore(win, role) {
      windowRoles.set(win, role);
      const mode = windowModes[role];
      if (mode) setSide(win, mode.side, mode);
      return Boolean(mode);
    },
    isDocked: (win) => docked.has(win),
    show(win) {
      const state = docked.get(win);
      if (!state) return false;
      reveal(win, state, true);
      return true;
    },
  };
}

module.exports = { dockWindowBounds, dockHandleBounds, normalizeDockPreferences, createDockWindowService };
