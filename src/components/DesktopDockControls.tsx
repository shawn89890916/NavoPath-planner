import { useEffect, useState, type ReactNode } from "react";
import type { DesktopDockPreferences, Language } from "../types";
import { IconButton } from "./UiPrimitives";
import { UiDockLeftIcon, UiDockRightIcon } from "./UiIcons";
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
      <SettingRow title={lang === "zh" ? "小条长度" : "Tab height"} control={<SettingNumberInput value={preferences.handleHeight} min={32} max={160} step={8} suffix="px" disabled={busy} ariaLabel={lang === "zh" ? "小条长度" : "Tab height"} onChange={(handleHeight) => void save({ handleHeight })} />} />
      <SettingRow title={lang === "zh" ? "小条位置" : "Tab position"} description={lang === "zh" ? "0% 为顶部，100% 为底部。" : "0% is the top; 100% is the bottom."} control={<SettingNumberInput value={preferences.position} min={0} max={100} step={5} suffix="%" disabled={busy} ariaLabel={lang === "zh" ? "小条位置" : "Tab position"} onChange={(position) => void save({ position })} />} />
      <SettingRow title={lang === "zh" ? "展开窗口高度" : "Expanded panel height"} control={<SettingNumberInput value={preferences.panelHeight} min={50} max={100} step={5} suffix="%" disabled={busy} ariaLabel={lang === "zh" ? "展开窗口高度" : "Expanded panel height"} onChange={(panelHeight) => void save({ panelHeight })} />} />
    </>}
    {error && <SettingDescription>{error}</SettingDescription>}
  </>;
}

const FIRST_DOCK_PROMPT_KEY = "navopath-dock-first-use-seen";

export default function DesktopDockControls({ lang, side, onSideChange, onError, trigger, disabled = false }: {
  lang: Language; side: "left" | "right" | null; onSideChange: (side: "left" | "right" | null) => void; onError: (message: string) => void; trigger: ReactNode; disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [showFirstUsePrompt, setShowFirstUsePrompt] = useState(() => {
    try { return window.localStorage.getItem(FIRST_DOCK_PROMPT_KEY) !== "1"; }
    catch { return true; }
  });

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
    ? (lang === "zh" ? "点击 N 恢复普通窗口" : "Click N to restore the window")
    : (lang === "zh" ? "选择贴边方向" : "Choose a Dock side");

  return <div className={`df-brand-dock-control${side ? " is-docked" : ""}`} onMouseEnter={() => { if (!side) setChoosing(true); }} onMouseLeave={() => setChoosing(false)}>
    <button
      className={`df-brand-ai-button df-brand-dock-trigger${side ? " is-docked" : ""}`}
      type="button"
      aria-label={label}
      aria-pressed={Boolean(side)}
      aria-expanded={choosing}
      title={label}
      disabled={disabled || busy}
      onClick={(event) => {
        event.stopPropagation();
        if (side) void changeSide(null);
        else setChoosing((open) => !open);
      }}
    >{trigger}</button>
    {choosing && !side && <div className="df-brand-dock-menu" role="group" aria-label={lang === "zh" ? "选择 Dock 贴边方向" : "Choose Dock side"}>
      {showFirstUsePrompt && <p className="df-brand-dock-hint">
        {lang === "zh"
          ? "首次使用：选择贴边方向后，悬停或点击屏幕边缘即可展开；Dock 窗口左上角点 N 可恢复。"
          : "First use: choose an edge. Hover or click its tab to reopen; click N in the docked window to restore it."}
      </p>}
      <div className="df-brand-dock-choices">
        <IconButton className="df-brand-dock-option" icon={<UiDockLeftIcon size={21} />} label={lang === "zh" ? "贴到屏幕左侧" : "Dock to left edge"} disabled={busy} onClick={() => {
          setChoosing(false);
          setShowFirstUsePrompt(false);
          try { window.localStorage.setItem(FIRST_DOCK_PROMPT_KEY, "1"); } catch { /* First-use help is best effort. */ }
          void changeSide("left");
        }} />
        <IconButton className="df-brand-dock-option" icon={<UiDockRightIcon size={21} />} label={lang === "zh" ? "贴到屏幕右侧" : "Dock to right edge"} disabled={busy} onClick={() => {
          setChoosing(false);
          setShowFirstUsePrompt(false);
          try { window.localStorage.setItem(FIRST_DOCK_PROMPT_KEY, "1"); } catch { /* First-use help is best effort. */ }
          void changeSide("right");
        }} />
      </div>
    </div>}
  </div>;
}
