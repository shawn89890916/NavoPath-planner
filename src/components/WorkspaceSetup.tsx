import { useState } from "react";
import { t, viewLabel } from "../i18n";
import type { Language, Settings } from "../types";
import { ProductIcon, themeVars } from "../WorkspacePresentation";
import { SettingSelect, SettingTextInput } from "./SettingsControls";
import { Button } from "./UiPrimitives";
import "./WorkspaceSetup.css";

type WorkspacePreferences = Pick<Settings, "language" | "theme" | "baseMode" | "defaultTimelineView" | "dayStartTime">;
const timelineViews = ["daily", "3day", "weekly", "month"] as const;

export function WorkspaceSetup({ settings, lang, onContinue }: {
  settings: Settings;
  lang: Language;
  onContinue: (preferences?: WorkspacePreferences) => void;
}) {
  const [language, setLanguage] = useState(settings.language || lang);
  const [appearance, setAppearance] = useState(settings.baseMode || settings.theme);
  const [timelineView, setTimelineView] = useState(settings.defaultTimelineView || "daily");
  const [dayStartTime, setDayStartTime] = useState(settings.dayStartTime || "00:00");
  const zh = language === "zh";
  const theme = appearance === "system" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : appearance;
  const languageLabel = zh ? "语言" : "Language";
  const appearanceLabel = t(language, "settings.uiMode");
  const timelineLabel = zh ? "默认时间轴视图" : "Default timeline view";
  const dayStartLabel = zh ? "一天开始时间" : "Day start time";
  return (
    <main className={`df-app mode-execute df-workspace-setup theme-${theme} type-${settings.typographyStyle}`}
      style={themeVars({ ...settings, theme }, "execute")} lang={language}>
      <header className="df-workspace-setup-brand"><ProductIcon compact /><span>NavoPath</span></header>
      <div className="df-workspace-setup-layout">
        <div className="df-workspace-setup-intro">
          <h1>{zh ? "设置你的工作区" : "Set up your workspace"}</h1>
          <p>{zh ? "选好常用的外观和时间轴。之后随时可以在设置中调整。" : "Choose how your workspace looks and how your timeline starts. You can change these anytime in Settings."}</p>
        </div>
        <form className="df-workspace-setup-form" onSubmit={(event) => {
          event.preventDefault();
          onContinue({ language, theme, baseMode: appearance, defaultTimelineView: timelineView, dayStartTime: dayStartTime || settings.dayStartTime });
        }}>
          <label><span>{languageLabel}</span>
            <SettingSelect value={language} onChange={setLanguage} ariaLabel={languageLabel}
              options={[{ value: "zh", label: "中文" }, { value: "en", label: "English" }]} />
          </label>
          <label><span>{appearanceLabel}</span>
            <SettingSelect value={appearance} onChange={setAppearance} ariaLabel={appearanceLabel}
              options={[{ value: "light", label: t(language, "settings.light") }, { value: "dark", label: t(language, "settings.dark") }, { value: "system", label: zh ? "跟随系统" : "System" }]} />
          </label>
          <label><span>{timelineLabel}</span>
            <SettingSelect value={timelineView} onChange={setTimelineView} ariaLabel={timelineLabel}
              options={timelineViews.map((value) => ({ value, label: viewLabel(language, value) }))} />
          </label>
          <label><span>{dayStartLabel}</span>
            <SettingTextInput type="time" value={dayStartTime} ariaLabel={dayStartLabel} onChange={setDayStartTime} />
          </label>
          <div className="df-workspace-setup-actions">
            <Button variant="primary" type="submit">{zh ? "进入工作区" : "Open workspace"}</Button>
            <Button variant="text" onClick={() => onContinue()}>{zh ? "使用当前设置" : "Keep current settings"}</Button>
          </div>
        </form>
      </div>
    </main>
  );
}
