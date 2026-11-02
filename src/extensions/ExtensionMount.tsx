import { useEffect, useRef, useState } from "react";
import type { ExtensionContribution } from "./types";

export function ExtensionMount({ contribution }: { contribution: ExtensionContribution }) {
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    let closed = false;
    let dispose: (() => void | Promise<void>) | undefined;
    setError("");
    void Promise.resolve().then(() => closed ? undefined : contribution.mount(element)).then((cleanup) => {
      if (typeof cleanup !== "function") return;
      if (closed) void Promise.resolve(cleanup()).catch(console.error);
      else dispose = cleanup;
    }).catch((caught) => { if (!closed) setError(String(caught)); });
    return () => { closed = true; if (dispose) void Promise.resolve(dispose()).catch(console.error); element.replaceChildren(); };
  }, [contribution]);
  return <><div ref={container} />{error && <p role="alert">{error}</p>}</>;
}
