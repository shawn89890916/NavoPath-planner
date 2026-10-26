import { useEffect, useState } from "react";
import type { Language } from "../types";
import { Button } from "./UiPrimitives";

export default function DesktopDockControls({ lang, onDock, onError }: {
  lang: Language; onDock: () => void; onError: (message: string) => void;
}) {
  const [side, setSide] = useState<"left" | "right" | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void window.desktopApi?.dockWindow?.getSide().then(setSide).catch(() => {});
  }, []);

  async function changeSide(next: "left" | "right" | null) {
    if (busy || !window.desktopApi?.dockWindow) return;
    setBusy(true);
    try {
      setSide(await window.desktopApi.dockWindow.setSide(next));
      onDock();
    } catch {
      onError(lang === "zh" ? "无法调整贴边窗口，请重试。" : "Could not adjust the docked window. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return <>
    <Button aria-pressed={side === "left"} disabled={busy} onClick={() => void changeSide("left")}>{lang === "zh" ? "贴靠左侧" : "Dock left"}</Button>
    <Button aria-pressed={side === "right"} disabled={busy} onClick={() => void changeSide("right")}>{lang === "zh" ? "贴靠右侧" : "Dock right"}</Button>
    {side && <Button disabled={busy} onClick={() => void changeSide(null)}>{lang === "zh" ? "退出贴边" : "Undock"}</Button>}
  </>;
}
