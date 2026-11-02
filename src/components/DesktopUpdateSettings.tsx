import { readAutoLaunchState, toggleAutoLaunchState } from "../desktopAutoLaunch";
import { useEffect, useState } from "react";
import type { DesktopUpdateState, Language, Settings } from "../types";
import { DESKTOP_DOWNLOAD_URL, DESKTOP_RELEASES_URL } from "../downloads";
import { formatVersionLabel } from "../versionLabel";
import { SettingRow, SettingToggle } from "./SettingsControls";

export function DesktopUpdateControl({ lang }: { lang: Language }) {
  const api = window.desktopApi;
  const [state, setState] = useState<DesktopUpdateState | null>(null);
  const updaterAvailable = Boolean(api);

  useEffect(() => {
    if (!updaterAvailable || !api) return;
    void api.getUpdateState().then(setState);
    return api.onUpdateState(setState);
  }, [api, updaterAvailable]);

  if (!updaterAvailable) {
    return <a className="df-download-link" href={DESKTOP_DOWNLOAD_URL} target="_blank" rel="noreferrer">{lang === "zh" ? "一键下载最新版 Windows 应用" : "Download the latest Windows app"}<span aria-hidden="true">↓</span></a>;
  }

  const statusText = (() => {
    if (!state) return lang === "zh" ? "正在读取版本…" : "Reading version…";
    if (state.status === "checking") return lang === "zh" ? "正在检查更新…" : "Checking for updates…";
    if (state.status === "available") return lang === "zh" ? `发现 ${formatVersionLabel(state.availableVersion || "")}，确认后自动更新并重启` : `${formatVersionLabel(state.availableVersion || "")} available. Confirm to update and restart.`;
    if (state.status === "downloading") return lang === "zh" ? `正在下载 ${state.progress}%` : `Downloading ${state.progress}%`;
    if (state.status === "downloaded") return lang === "zh" ? `${formatVersionLabel(state.availableVersion || "")} 已准备好安装` : `${formatVersionLabel(state.availableVersion || "")} is ready to install`;
    if (state.status === "current") return lang === "zh" ? "当前已是最新版" : "You're up to date";
    if (state.status === "error") return lang === "zh" ? `更新失败：${state.message}` : `Update failed: ${state.message}`;
    return lang === "zh" ? "启动后及每天自动检查，确认即可更新" : "Checked at startup and daily. Confirm to update.";
  })();
  const busy = !state || state.status === "checking" || state.status === "downloading";
  const actionLabel = state?.status === "downloaded"
    ? (lang === "zh" ? "重启并安装" : "Restart and install")
    : state?.status === "available"
      ? (lang === "zh" ? "立即更新" : "Update now")
      : (lang === "zh" ? "立即检查更新" : "Check for updates");

  return <section className="df-update-card">
    <div><strong>{lang === "zh" ? "桌面应用更新" : "Desktop app updates"}</strong><small>{statusText}</small>{state?.currentVersion && <small>{lang === "zh" ? "当前版本" : "Current version"} {formatVersionLabel(state.currentVersion)}</small>}</div>
    {state?.status === "downloading" && <progress max="100" value={state.progress} />}
    <button type="button" disabled={busy} onClick={() => state?.status === "downloaded" ? void api?.installUpdate() : void api?.checkForUpdates().then(setState)}>{actionLabel}</button>
    <a href={DESKTOP_RELEASES_URL}>{lang === "zh" ? "查看发布说明" : "View release notes"}</a>
  </section>;
}

export function BetaUpdatePreference({ lang, onSave }: { lang: Language; onSave: (patch: Partial<Settings>) => void }) {
  const api = window.desktopApi;
  const [enabled, setEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { if (api?.getAcceptBetaUpdates) void api.getAcceptBetaUpdates().then(setEnabled).catch(() => setError(lang === "zh" ? "无法读取更新偏好，请重试。" : "Could not read update preferences. Try again.")); }, [api, lang]);
  if (!api?.setAcceptBetaUpdates) return null;
  return <SettingRow title={lang === "zh" ? "接受 Beta 更新" : "Accept Beta updates"} description={error || (lang === "zh" ? "当前设备可接收预发布版本。关闭后仅检查正式版本。" : "Receive prerelease builds on this device. When off, check stable releases only.")} control={<SettingToggle checked={enabled} disabled={saving} ariaLabel={lang === "zh" ? "接受 Beta 更新" : "Accept Beta updates"} onChange={(next) => { setSaving(true); setError(""); void api.setAcceptBetaUpdates!(next).then(value => { setEnabled(value); onSave({ acceptBetaUpdates: value }); }).catch(() => setError(lang === "zh" ? "更新偏好保存失败，请重试。" : "Could not save update preferences. Try again.")).finally(() => setSaving(false)); }} />} />;
}


export function AutoLaunchToggle({ lang }: { lang: Language }) {
  const api = window.desktopApi;
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!api) { setLoading(false); return; }
    let active = true;
    void readAutoLaunchState(api, false).then((next) => {
      if (!active) return;
      setEnabled(next);
      setLoading(false);
    });
    return () => { active = false; };
  }, [api]);

  if (!api) return null;

  const toggleAutoLaunch = async () => {
    setLoading(true);
    const next = await toggleAutoLaunchState(api, enabled);
    setEnabled(next);
    setLoading(false);
  };

  return <SettingRow
    title={lang === "zh" ? "开机自启动" : "Launch at startup"}
    description={lang === "zh" ? "登录系统时自动打开 NavoPath" : "Automatically open NavoPath when you sign in"}
    control={<>
      <span className="df-settings-toggle-status" aria-live="polite">
        {loading ? (lang === "zh" ? "更新中…" : "Updating…") : enabled ? (lang === "zh" ? "已开启" : "On") : (lang === "zh" ? "已关闭" : "Off")}
      </span>
      <SettingToggle checked={enabled} disabled={loading} ariaLabel={lang === "zh" ? "开机自启动" : "Launch at startup"} onChange={() => { void toggleAutoLaunch(); }} />
    </>}
  />;
}
