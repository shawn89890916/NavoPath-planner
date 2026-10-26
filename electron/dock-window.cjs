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

function createDockWindowService({ ipcMain, screen, getWindow, canControl }) {
  const docked = new Map();

  function applyBounds(win, state) {
    const display = screen.getAllDisplays().find((item) => item.id === state.displayId)
      || screen.getDisplayMatching(win.getBounds());
    state.displayId = display.id;
    win.setBounds(dockWindowBounds(display.workArea, state.side));
  }

  function setSide(win, side) {
    if (side !== null && side !== "left" && side !== "right") throw new Error("Invalid dock side.");
    let state = docked.get(win);
    if (side === null) {
      if (!state) return null;
      docked.delete(win);
      win.removeListener("closed", state.onClosed);
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
        displayId: screen.getDisplayMatching(win.getBounds()).id,
        restoreDisplayId: screen.getDisplayMatching(win.getBounds()).id,
        side,
      };
      docked.set(win, state);
      state.onClosed = () => docked.delete(win);
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
