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
      description={lang === "zh" ? "从左上角 N 图标选择贴边方向；收起时可悬停或点击边缘小条展开，点击 Dock 窗口中的 N 图标即可恢复。" : "Choose a screen edge from the top-left N icon. Hover or click the edge tab to reopen; click N in the docked window to restore it."}
      control={<SettingSelect value={preferences?.activation || "hover"} disabled={!preferences || busy}
        ariaLabel={lang === "zh" ? "贴边栏触发方式" : "Dock activation"}
        onChange={(activation) => void save({ activation })} options={[
          { value: "hover", label: lang === "zh" ? "悬停打开" : "Open on hover" },
          { value: "click", label: lang === "zh" ? "点击打开" : "Open on click" },
        ]} />} />
    {preferences && <>
      <SettingRow title={lang === "zh" ? "小条长度" : "Tab height"} description={lang === "zh" ? "最长可覆盖整条屏幕边缘，超出屏幕的长度会自动适配。" : "Can cover the full screen edge; lengths beyond the screen are fitted automatically."} control={<SettingNumberInput value={preferences.handleHeight} min={32} max={8192} step={8} suffix="px" disabled={busy} ariaLabel={lang === "zh" ? "小条长度" : "Tab height"} onChange={(handleHeight) => void save({ handleHeight })} />} />
      <SettingRow title={lang === "zh" ? "小条位置" : "Tab position"} description={lang === "zh" ? "0% 为顶部，100% 为底部。" : "0% is the top; 100% is the bottom."} control={<SettingNumberInput value={preferences.position} min={0} max={100} step={5} suffix="%" disabled={busy} ariaLabel={lang === "zh" ? "小条位置" : "Tab position"} onChange={(position) => void save({ position })} />} />
      <SettingRow title={lang === "zh" ? "展开窗口高度" : "Expanded panel height"} control={<SettingNumberInput value={preferences.panelHeight} min={50} max={100} step={5} suffix="%" disabled={busy} ariaLabel={lang === "zh" ? "展开窗口高度" : "Expanded panel height"} onChange={(panelHeight) => void save({ panelHeight })} />} />
    </>}
    {preferences && <details>
      <summary>{lang === "zh" ? "高级设置" : "Advanced settings"}</summary>
      <SettingRow title={lang === "zh" ? "小条伸出宽度" : "Visible tab width"} description={lang === "zh" ? "调整屏幕边缘小条露出的宽度；小条不易看见时可适当增大，悬停和点击区域保持至少 24px。" : "Adjust how far the edge tab is visible. Increase this if it is hard to find; the hover and click area remains at least 24px."} control={<SettingNumberInput value={preferences.handleWidth} min={2} max={24} step={1} suffix="px" disabled={busy} ariaLabel={lang === "zh" ? "小条伸出宽度" : "Visible tab width"} onChange={(handleWidth) => void save({ handleWidth })} />} />
    </details>}
    {error && <SettingDescription>{error}</SettingDescription>}
  </>;
}

export default function DesktopDockControls({ lang, side, onSideChange, onError, trigger, disabled = false }: {
  lang: Language; side: "left" | "right" | null; onSideChange: (side: "left" | "right" | null) => void; onError: (message: string) => void; trigger: ReactNode; disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [choosing, setChoosing] = useState(false);
  useEffect(() => { if (disabled) setChoosing(false); }, [disabled]);

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

  async function handleTriggerClick() {
    const api = window.desktopApi?.dockWindow;
    if (busy || !api) return;
    setBusy(true);
    try {
      const currentSide = await api.getSide();
      if (currentSide) {
        setChoosing(false);
        onSideChange(await api.setSide(null));
      } else {
        onSideChange(null);
        setChoosing((open) => !open);
      }
    } catch {
      onError(lang === "zh" ? "无法调整贴边窗口，请重试。" : "Could not adjust the docked window. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const label = side
    ? (lang === "zh" ? "点击 N 恢复普通窗口" : "Click N to restore the window")
    : (lang === "zh" ? "选择贴边方向" : "Choose a Dock side");
  const help = lang === "zh"
    ? "选择贴边方向后，悬停或点击屏幕边缘即可展开；点击 Dock 窗口左上角的 N 可恢复普通窗口。"
    : "Choose an edge. Hover or click its screen tab to reopen; click N in the docked window to restore it.";

  return <div className={`df-brand-dock-control${side ? " is-docked" : ""}`} onMouseEnter={() => { if (!side && !disabled) setChoosing(true); }} onMouseLeave={() => setChoosing(false)}>
    <button
      className={`df-brand-ai-button df-brand-dock-trigger${side ? " is-docked" : ""}`}
      type="button"
      aria-label={label}
      title={side ? (lang === "zh" ? "取消 Dock" : "Undock") : (lang === "zh" ? "选择贴边方向" : "Choose a Dock side")}
      aria-pressed={Boolean(side)}
      aria-expanded={choosing}
      disabled={disabled || busy}
      onClick={(event) => { event.stopPropagation(); void handleTriggerClick(); }}
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
