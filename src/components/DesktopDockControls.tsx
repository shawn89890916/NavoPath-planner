import { useEffect, useState } from "react";
import type { DesktopDockPreferences, Language } from "../types";
import { Button, IconButton } from "./UiPrimitives";
import { UiDockSidebarIcon } from "./UiIcons";
import { SettingDescription, SettingNumberInput, SettingRow, SettingSelect } from "./SettingsControls";

export function DesktopDockSettings({ lang }: { lang: Language }) {
  const api = window.desktopApi?.dockWindow;
  const [preferences, setPreferences] = useState<DesktopDockPreferences | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void api?.getPreferences().then((value) => { if (active) setPreferences(value); })
      .catch(() => { if (active) setError(lang === "zh" ? "无法读取贴边栏设置。" : "Could not read Dock settings."); });
    return () => { active = false; };
  }, [api, lang]);
  async function save(patch: Partial<DesktopDockPreferences>) {
    if (!api || busy) return;
    setBusy(true);
    setError("");
    try { setPreferences(await api.setPreferences(patch)); }
    catch { setError(lang === "zh" ? "无法保存贴边栏设置，请重试。" : "Could not save Dock settings. Please try again."); }
    finally { setBusy(false); }
  }
  if (!api) return null;
  return <>
    <SettingRow title={lang === "zh" ? "贴边栏触发方式" : "Dock activation"}
      description={lang === "zh" ? "从今日候选工具栏的 Dock 图标启用。收起时仅露出 3 像素小条；点击模式下可上下拖动小条。" : "Enable from the Dock icon in Today’s Candidates. A 3 px tab remains visible when hidden; drag it vertically in click mode."}
      control={<SettingSelect value={preferences?.activation || "hover"} disabled={!preferences || busy}
        ariaLabel={lang === "zh" ? "贴边栏触发方式" : "Dock activation"}
        onChange={(activation) => void save({ activation })} options={[
          { value: "hover", label: lang === "zh" ? "悬停打开" : "Open on hover" },
          { value: "click", label: lang === "zh" ? "点击打开" : "Open on click" },
        ]} />} />
    {preferences && <>
      <SettingRow title={lang === "zh" ? "小条长度" : "Tab height"} control={<SettingNumberInput value={preferences.handleHeight} min={32} max={160} step={8} suffix="px" disabled={busy} ariaLabel={lang === "zh" ? "小条长度" : "Tab height"} onChange={(handleHeight) => void save({ handleHeight })} />} />
      <SettingRow title={lang === "zh" ? "小条位置" : "Tab position"} description={lang === "zh" ? "0% 为顶部，100% 为底部。" : "0% is the top; 100% is the bottom."} control={<SettingNumberInput value={preferences.position} min={0} max={100} step={5} suffix="%" disabled={busy} ariaLabel={lang === "zh" ? "小条位置" : "Tab position"} onChange={(position) => void save({ position })} />} />
      <SettingRow title={lang === "zh" ? "展开窗口高度" : "Expanded panel height"} control={<SettingNumberInput value={preferences.panelHeight} min={50} max={100} step={5} suffix="%" disabled={busy} ariaLabel={lang === "zh" ? "展开窗口高度" : "Expanded panel height"} onChange={(panelHeight) => void save({ panelHeight })} />} />
    </>}
    {error && <SettingDescription>{error}</SettingDescription>}
  </>;
}

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

  const label = side
    ? (lang === "zh" ? `取消${side === "left" ? "左" : "右"}侧贴边` : `Undock from ${side} edge`)
    : (lang === "zh" ? "桌面贴边 Dock" : "Desktop edge Dock");

  return <div className="df-desktop-dock-control">
    <IconButton
      className={`df-icon-action df-candidate-header-icon df-desktop-dock-trigger${side ? " active" : ""}`}
      icon={<UiDockSidebarIcon size={17} />}
      label={label}
      aria-pressed={Boolean(side)}
      aria-expanded={choosing}
      disabled={busy}
      onClick={(event) => {
        event.stopPropagation();
        if (side) void changeSide(null);
        else setChoosing((open) => !open);
      }}
    />
    {choosing && !side && <div className="ui-choice-list ui-choice-list--inline df-desktop-dock-choices" role="group" aria-label={lang === "zh" ? "贴边方向" : "Dock side"}>
      <Button className="ui-choice-item" disabled={busy} onClick={() => { setChoosing(false); void changeSide("left"); }}>{lang === "zh" ? "左侧" : "Left"}</Button>
      <Button className="ui-choice-item" disabled={busy} onClick={() => { setChoosing(false); void changeSide("right"); }}>{lang === "zh" ? "右侧" : "Right"}</Button>
    </div>}
  </div>;
}
