function createDesktopUpdater({ isPackaged, currentVersion, getUpdater, confirmUpdate, onState, defer = setImmediate }) {
  let state = {
    status: isPackaged ? "idle" : "unsupported",
    currentVersion,
    availableVersion: "",
    progress: 0,
    message: isPackaged ? "" : "Update checks are available in the installed desktop app.",
  };
  let configured = false;
  let checkPromise = null;
  let confirmationPromise = null;
  let lastPromptedVersion = "";
  let installScheduled = false;

  function publish(patch) {
    state = { ...state, ...patch };
    onState(state);
    return state;
  }

  function fail(error) {
    installScheduled = false;
    return publish({ status: "error", message: error instanceof Error ? error.message : String(error) });
  }

  function configure() {
    if (!isPackaged || configured) return;
    const updater = getUpdater();
    configured = true;
    updater.autoDownload = false;
    updater.autoInstallOnAppQuit = false;
    updater.on("update-available", (info) => {
      publish({ status: "available", availableVersion: info.version, progress: 0 });
    });
    updater.on("update-not-available", () => {
      publish({ status: "current", availableVersion: "", progress: 0 });
    });
    updater.on("download-progress", (progress) => {
      publish({ status: "downloading", progress: Math.round(progress.percent || 0) });
    });
    updater.on("update-downloaded", (info) => {
      publish({ status: "downloaded", availableVersion: info.version, progress: 100 });
    });
    updater.on("error", fail);
  }

  function install() {
    if (state.status !== "downloaded" || installScheduled) return false;
    installScheduled = true;
    defer(() => {
      try {
        // The confirmation already covers installation and restarting the app.
        getUpdater().quitAndInstall(true, true);
      } catch (error) {
        fail(error);
      }
    });
    return true;
  }

  function confirmAndUpdate(manual) {
    if (confirmationPromise) return confirmationPromise;
    if (!["available", "downloaded"].includes(state.status) || installScheduled) return Promise.resolve(state);
    if (!manual && lastPromptedVersion === state.availableVersion) return Promise.resolve(state);
    lastPromptedVersion = state.availableVersion;
    confirmationPromise = (async () => {
      try {
        if (!await confirmUpdate(state.availableVersion)) return state;
        if (state.status === "available") {
          publish({ status: "downloading", progress: 0, message: "" });
          await getUpdater().downloadUpdate();
        }
        // Only a verified update-downloaded event permits installation.
        if (state.status === "downloaded") install();
        return state;
      } catch (error) {
        return fail(error);
      }
    })().finally(() => { confirmationPromise = null; });
    return confirmationPromise;
  }

  function check(manual = false) {
    if (!isPackaged) return Promise.resolve(state);
    if (checkPromise) return checkPromise;
    if (confirmationPromise) return confirmationPromise;
    if (state.status === "downloading") return Promise.resolve(state);
    if (state.status === "downloaded" || (manual && state.status === "available")) return confirmAndUpdate(manual);
    checkPromise = (async () => {
      try {
        configure();
        publish({ status: "checking", progress: 0, message: "" });
        await getUpdater().checkForUpdates();
        return await confirmAndUpdate(manual);
      } catch (error) {
        return fail(error);
      }
    })().finally(() => { checkPromise = null; });
    return checkPromise;
  }

  return { getState: () => state, check, configure, install };
}

module.exports = { createDesktopUpdater };
