import { useEffect, useRef, useState } from "react";
import type { ExtensionContribution } from "./types";
import type { Language } from "../types";

export function ExtensionMount({ contribution, lang = "en" }: { contribution: ExtensionContribution; lang?: Language }) {
  const container = useRef<HTMLDivElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<"pending" | "ready" | "error">("pending");
  const [error, setError] = useState("");
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    // A generation owns its own detached root; stale cleanup cannot clear a new page.
    const root = document.createElement("div");
    element.replaceChildren(root);
    let closed = false;
    let dispose: (() => void | Promise<void>) | undefined;
    setError(""); setStatus("pending");
    void Promise.resolve().then(() => closed ? undefined : contribution.mount(root)).then((cleanup) => {
      if (typeof cleanup === "function") {
        if (closed) void Promise.resolve().then(cleanup).catch(console.error);
        else dispose = cleanup;
      }
      if (!closed) setStatus("ready");
    }).catch((caught) => { if (!closed) { setError(String(caught)); setStatus("error"); } });
    return () => { closed = true; root.remove(); if (dispose) void Promise.resolve().then(dispose).catch(console.error); };
  }, [contribution, attempt]);
  const zh = lang === "zh";
  return <div className="df-extension-mount" data-mount-state={status} aria-busy={status === "pending"}>
    <div ref={container} />
    {status === "pending" && <span role="status">{zh ? "正在打开插件…" : "Opening plugin…"}</span>}
    {error && <div role="alert"><p>{error}</p><button className="ui-button ui-button--secondary" onClick={() => setAttempt(value => value + 1)}>{zh ? "重试" : "Retry"}</button></div>}
  </div>;
}
