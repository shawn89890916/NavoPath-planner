import { useEffect, useState, type ReactNode } from "react";
import type { DesktopDockPreferences, Language } from "../types";
import { IconButton } from "./UiPrimitives";
import { UiDockLeftIcon, UiDockRightIcon, UiInfoIcon } from "./UiIcons";
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
      description={lang === "zh" ? "从左上角 Dock 图标选择贴边方向；收起时可悬停或点击边缘小条展开，再次点击 Dock 图标即可恢复普通窗口。" : "Choose a screen edge from the top-left Dock icon. Hover or click the edge tab to reopen; click the Dock icon at the top left to restore the window."}
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

export default function DesktopDockControls({ lang, side, onSideChange, onError, trigger, disabled = false }: {
  lang: Language; side: "left" | "right" | null; onSideChange: (side: "left" | "right" | null) => void; onError: (message: string) => void; trigger: ReactNode; disabled?: boolean;
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
    ? (lang === "zh" ? "恢复普通窗口" : "Restore the window")
    : (lang === "zh" ? "选择贴边方向" : "Choose a Dock side");
  const help = lang === "zh"
    ? "选择贴边方向后，悬停或点击屏幕边缘即可展开；点击左上角的 Dock 图标可恢复普通窗口。"
    : "Choose an edge. Hover or click its screen tab to reopen; click the Dock icon at the top left to restore the window.";

  return <div className={`df-brand-dock-control${side ? " is-docked" : ""}`} onMouseEnter={() => { if (!side) setChoosing(true); }} onMouseLeave={() => setChoosing(false)}>
    <button
      className={`df-brand-ai-button df-brand-dock-trigger${side ? " is-docked" : ""}`}
      type="button"
      aria-label={label}
      aria-pressed={Boolean(side)}
      aria-expanded={choosing}
      disabled={disabled || busy}
      onClick={(event) => {
        event.stopPropagation();
        if (side) void changeSide(null);
        else setChoosing((open) => !open);
      }}
    >{trigger}</button>
    {choosing && !side && <div className="df-brand-dock-menu" role="group" aria-label={lang === "zh" ? "选择 Dock 贴边方向" : "Choose Dock side"}>
      <div className="df-brand-dock-choices">
        <IconButton className="df-brand-dock-option" icon={<><UiDockLeftIcon size={21} /><span>{lang === "zh" ? "左侧" : "Left"}</span></>} label={lang === "zh" ? "贴到屏幕左侧" : "Dock to left edge"} disabled={busy} onClick={() => {
          setChoosing(false);
          void changeSide("left");
        }} />
        <IconButton className="df-brand-dock-option" icon={<><UiDockRightIcon size={21} /><span>{lang === "zh" ? "右侧" : "Right"}</span></>} label={lang === "zh" ? "贴到屏幕右侧" : "Dock to right edge"} disabled={busy} onClick={() => {
          setChoosing(false);
          void changeSide("right");
        }} />
      </div>
      <div className="df-brand-dock-menu-foot">
        <strong>{lang === "zh" ? "贴边方向" : "Dock side"}</strong>
        <span className="df-brand-dock-help-wrap">
          <button className="df-brand-dock-help" type="button" aria-label={lang === "zh" ? "Dock 使用说明" : "Dock instructions"} aria-describedby="df-brand-dock-help-tooltip">
            <UiInfoIcon size={17} />
          </button>
          <span id="df-brand-dock-help-tooltip" className="df-brand-dock-help-tooltip" role="tooltip">{help}</span>
        </span>
      </div>
    </div>}
  </div>;
}
