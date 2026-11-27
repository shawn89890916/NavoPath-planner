import { useEffect, useRef, useState } from "react";
import { extensionService } from "../extensions/service";
import { subscribePluginEvent } from "../extensions/runtime";
import type { ReadingLibrary } from "./model";

/** Only activate storage and load the reading model when the plugin is active. */
export function useReadingLibrary(enabled: boolean, account: string) {
  const [snapshot, setSnapshot] = useState<{ account: string; library: ReadingLibrary | null; error: string }>({ account: "", library: null, error: "" });
  const [busy, setBusy] = useState(false);
  const epoch = useRef(0);
  const lock = useRef(false);
  const scope = useRef({ enabled, account });
  scope.current = { enabled, account };
  useEffect(() => {
    scope.current = { enabled, account };
    const currentEpoch = ++epoch.current;
    let revision = 0;
    setSnapshot({ account, library: null, error: "" });
    setBusy(false);
    lock.current = false;
    if (!enabled) return;
    const read = async () => {
      const current = ++revision;
      try {
        const model = await import("./model");
        const library = model.decodeReadingLibrary(await extensionService.readReadingLibrary(account));
        if (epoch.current === currentEpoch && current === revision) setSnapshot({ account, library, error: "" });
      } catch {
        if (epoch.current === currentEpoch && current === revision) setSnapshot({ account, library: null, error: "unavailable" });
      }
    };
    const off = subscribePluginEvent("storage:official:reading", payload => {
      if ((payload as { key?: string } | null)?.key === "library-v1") void read();
    });
    // Refresh on focus for offline edits and cross-device updates.
    const onFocus = () => { void read(); };
    window.addEventListener("focus", onFocus);
    void read();
    return () => { scope.current = { enabled: false, account }; ++epoch.current; window.removeEventListener("focus", onFocus); void off(); };
  }, [enabled, account]);

  const mutate = async (update: (library: ReadingLibrary) => ReadingLibrary) => {
    if (!enabled || lock.current || snapshot.account !== account || !snapshot.library ||
      scope.current.account !== account || !scope.current.enabled) throw new Error("Reading unavailable");
    const currentEpoch = epoch.current;
    lock.current = true;
    setBusy(true);
    try {
      const model = await import("./model");
      const before = model.decodeReadingLibrary(await extensionService.readReadingLibrary(account));
      if (epoch.current !== currentEpoch || scope.current.account !== account || !scope.current.enabled) throw new Error("Reading account changed");
      const next = update(before);
      if (next !== before) await extensionService.writeReadingLibrary(account, next);
      if (epoch.current !== currentEpoch || scope.current.account !== account || !scope.current.enabled) throw new Error("Reading account changed");
      setSnapshot({ account, library: next, error: "" });
      return next;
    } finally {
      if (epoch.current === currentEpoch) { lock.current = false; setBusy(false); }
    }
  };
  return {
    library: enabled && snapshot.account === account ? snapshot.library : null,
    error: enabled && snapshot.account === account ? snapshot.error : "",
    busy, mutate,
  };
}
