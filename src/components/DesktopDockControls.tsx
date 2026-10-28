import { useState } from "react";
import type { Language } from "../types";
import { Button } from "./UiPrimitives";

export default function DesktopDockControls({ lang, side, onSideChange, onError }: {
  lang: Language; side: "left" | "right" | null; onSideChange: (side: "left" | "right" | null) => void; onError: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [choosing, setChoosing] = useState(false);

  async function changeSide(next: "left" | "right" | null) {
    if (busy || !window.desktopApi?.dockWindow) return;
    setBusy(true);
    try {
      onSideChange(await window.desktopApi.dockWindow.setSide(next));
    } catch {
      onError(lang === "zh" ? "无法调整贴边窗口，请重试。" : "Could not adjust the docked window. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (side) return <Button disabled={busy} onClick={() => void changeSide(null)}>Undock</Button>;
  return <div onMouseEnter={() => setChoosing(true)} onMouseLeave={() => setChoosing(false)}>
    <Button disabled={busy} aria-expanded={choosing} onFocus={() => setChoosing(true)} onClick={(event) => { event.stopPropagation(); setChoosing(true); }}>Dock <span aria-hidden="true">›</span></Button>
    {choosing && <div className="ui-choice-list ui-choice-list--inline" role="group" aria-label={lang === "zh" ? "贴边方向" : "Dock side"}>
      <Button className="ui-choice-item" disabled={busy} onClick={() => void changeSide("left")}>{lang === "zh" ? "左侧" : "Left"}</Button>
      <Button className="ui-choice-item" disabled={busy} onClick={() => void changeSide("right")}>{lang === "zh" ? "右侧" : "Right"}</Button>
    </div>}
  </div>;
}
