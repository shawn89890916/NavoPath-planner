import { useEffect, useState } from "react";
import type { Language } from "../types";
import { SettingActionButton } from "./SettingsControls";


export default function CalDavManager({ lang, errorMessage }: { lang: Language; errorMessage: (error: unknown, lang: Language) => string }) {
  const api = window.plannerApi;
  const [account, setAccount] = useState<{ username: string; timezone: string } | null>(null);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(true);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const zh = lang === "zh";

  useEffect(() => {
    let active = true;
    if (!api.getCalDavCredential) { setBusy(false); return; }
    void api.getCalDavCredential()
      .then(value => { if (active) setAccount(value); })
      .catch(caught => { if (active) setError(errorMessage(caught, lang)); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [api, lang, errorMessage]);

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setNotice(zh ? "已复制" : "Copied");
    } catch {
      setError(zh ? "复制失败，请手动选择。" : "Copy failed. Select the value manually.");
    }
  };

  const changeAccount = async (revoke: boolean) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (revoke && api.revokeCalDavCredential) {
        await api.revokeCalDavCredential();
        setAccount(null);
        setPassword("");
      } else if (api.createCalDavCredential) {
        const created = await api.createCalDavCredential();
        setAccount({ username: created.username, timezone: created.timezone });
        setPassword(created.password);
      }
      setConfirmRevoke(false);
    } catch (caught) {
      setError(errorMessage(caught, lang));
    } finally {
      setBusy(false);
    }
  };

  return <section className="df-mcp-settings df-calendar-settings">
    <strong>{zh ? "苹果日历双向同步（CalDAV）" : "Two-way Apple Calendar sync (CalDAV)"}</strong>
    <p>{zh
      ? "在 iPhone 的「设置 → App → 日历 → 日历账户 → 添加账户 → 添加其他账户 → CalDAV 账户」中填写以下信息。选择 NavoPath 日历后，可以在两端新增、编辑和删除日程。"
      : "On iPhone, open Settings → Apps → Calendar → Calendar Accounts → Add Account → Add Other Account → CalDAV Account. Select the NavoPath calendar to create, edit and delete events from either app."}</p>
    {api.createCalDavCredential && !account && <SettingActionButton disabled={busy} onClick={() => void changeAccount(false)}>
      {zh ? "生成日历专用密码" : "Generate calendar password"}
    </SettingActionButton>}
    {!api.createCalDavCredential && <p>{zh ? "登录云端账户后可设置。" : "Sign in to set up your calendar account."}</p>}
    {account && <div className="df-mcp-token">
      <small>{zh ? "服务器" : "Server"}</small><code>navopath.com</code>
      <small>{zh ? "用户名" : "Username"}</small><code>{account.username}</code>
      <small>{zh ? "时区" : "Time zone"}</small><code>{account.timezone}</code>
      {password && <><small>{zh ? "密码仅显示这一次" : "Password is shown once"}</small><code>{password}</code></>}
      <div className="df-calendar-actions">
        <button type="button" onClick={() => void copy(account.username)}>{zh ? "复制用户名" : "Copy username"}</button>
        {password && <button type="button" onClick={() => void copy(password)}>{zh ? "复制密码" : "Copy password"}</button>}
        {!confirmRevoke && <button type="button" disabled={busy} onClick={() => setConfirmRevoke(true)}>{zh ? "撤销密码" : "Revoke password"}</button>}
        {confirmRevoke && <>
          <button type="button" disabled={busy} onClick={() => void changeAccount(true)}>{zh ? "确认断开所有设备" : "Confirm disconnect all devices"}</button>
          <button type="button" disabled={busy} onClick={() => setConfirmRevoke(false)}>{zh ? "取消" : "Cancel"}</button>
        </>}
      </div>
    </div>}
    {error && <p className="df-mcp-status error" role="alert">{error}</p>}
    {notice && <p className="df-mcp-status" role="status">{notice}</p>}
  </section>;
}
