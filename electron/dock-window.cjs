const { DEFAULT_COMPACT_WIDTH } = require("./compact-window.cjs");

function dockWindowBounds(workArea, side) {
  const width = Math.min(DEFAULT_COMPACT_WIDTH, workArea.width, Math.floor(workArea.height * 0.8));
  return {
    x: side === "left" ? workArea.x : workArea.x + workArea.width - width,
    y: workArea.y,
    width,
    height: workArea.height,
  };
}

function createDockWindowService({ ipcMain, screen, getWindow, canControl, timers = { setInterval, clearInterval } }) {
  const docked = new Map();
  let hoverTimer = null;

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
      const edge = state.side === "left" ? monitor.x : monitor.x + monitor.width - 1;
      const nearEdge = Math.abs(point.x - edge) <= 4
        && point.x >= monitor.x && point.x < monitor.x + monitor.width
        && point.y >= bounds.y && point.y < bounds.y + bounds.height;
      // Include a vertical taskbar between the physical screen edge and the panel.
      const left = state.side === "left" ? monitor.x : bounds.x;
      const right = state.side === "right" ? monitor.x + monitor.width : bounds.x + bounds.width;
      const inside = point.x >= left && point.x < right
        && point.y >= bounds.y && point.y < bounds.y + bounds.height;
      if (!win.isVisible() && nearEdge) {
        win.setAlwaysOnTop(true);
        win.showInactive();
      } else if (win.isVisible() && !inside) {
        win.hide();
        win.setAlwaysOnTop(state.alwaysOnTop);
      }
    }
  }

  function applyBounds(win, state) {
    const display = screen.getAllDisplays().find((item) => item.id === state.displayId)
      || screen.getDisplayMatching(win.getBounds());
    state.displayId = display.id;
    state.displayBounds = display.bounds || display.workArea;
    win.setBounds(dockWindowBounds(display.workArea, state.side));
  }

  function setSide(win, side) {
    if (side !== null && side !== "left" && side !== "right") throw new Error("Invalid dock side.");
    let state = docked.get(win);
    if (side === null) {
      if (!state) return null;
      docked.delete(win);
      stopHoverTimer();
      win.removeListener("closed", state.onClosed);
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
        bounds: win.getNormalBounds(),
        minimumSize: win.getMinimumSize(),
        maximized: win.isMaximized(),
        fullScreen: win.isFullScreen(),
        resizable: win.isResizable(),
        movable: win.isMovable(),
        maximizable: win.isMaximizable(),
        fullScreenable: win.isFullScreenable(),
        alwaysOnTop: win.isAlwaysOnTop(),
        displayId: screen.getDisplayMatching(win.getBounds()).id,
        restoreDisplayId: screen.getDisplayMatching(win.getBounds()).id,
        side,
      };
      docked.set(win, state);
      state.onClosed = () => { docked.delete(win); stopHoverTimer(); };
      win.once("closed", state.onClosed);
      if (state.fullScreen) win.setFullScreen(false);
      if (state.maximized) win.unmaximize();
      win.setMinimumSize(0, 0);
      win.setResizable(false);
      win.setMovable(false);
      win.setMaximizable(false);
      win.setFullScreenable(false);
    }
    state.side = side;
    applyBounds(win, state);
    win.hide();
    win.setAlwaysOnTop(state.alwaysOnTop);
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

  return { registerIpc, watchDisplays };
}

module.exports = { dockWindowBounds, createDockWindowService };
