import { useState } from "react";
import { ProductIcon } from "./WorkspacePresentation";
import { PrivacyConsent } from "./components/PrivacyConsent";
export default function AuthGate(props: {
  busy: boolean;
  error: string;
  notice: { type: "confirm-email"; email: string } | null;
  onSubmit: (email: string, password: string, displayName: string, intent: "signin" | "signup", privacyAccepted: boolean) => Promise<void>;
  onResend: (email: string) => Promise<void>;
  onContinueAfterConfirm: (email: string) => Promise<void>;
}) {
  const [intent, setIntent] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const mismatch = intent === "signup" && password && confirmPassword && password !== confirmPassword;
  return (
    <main className="df-auth-shell">
      <section className="df-auth-card">
        <div className="df-auth-brand">
          <ProductIcon />
          <div>
            <strong>NavoPath</strong>
            <span>从项目规划中选出今天要推进的事。</span>
          </div>
        </div>
        <div className="df-auth-tabs">
          <button className={intent === "signin" ? "active" : ""} onClick={() => { if (intent !== "signin") setPrivacyAccepted(false); setIntent("signin"); }}>登录</button>
          <button className={intent === "signup" ? "active" : ""} onClick={() => { if (intent !== "signup") setPrivacyAccepted(false); setIntent("signup"); }}>注册</button>
        </div>
        <form onSubmit={(event) => {
          event.preventDefault();
          if (props.busy || !privacyAccepted || mismatch) return;
          void props.onSubmit(email.trim(), password, displayName.trim(), intent, privacyAccepted);
        }}>
          {intent === "signup" && <label>用户名<input type="text" value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="nickname" maxLength={64} /></label>}
          <label>电子邮箱<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>
          <label>密码<input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={intent === "signin" ? "current-password" : "new-password"} minLength={6} required /></label>
          {intent === "signup" && <label>确认密码<input type={showPassword ? "text" : "password"} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" minLength={6} required /></label>}
          <label className="df-auth-check"><input type="checkbox" checked={showPassword} onChange={(event) => setShowPassword(event.target.checked)} />显示密码</label>
          <PrivacyConsent lang="zh" checked={privacyAccepted} onChange={setPrivacyAccepted} disabled={props.busy} />
          {mismatch && <p className="df-auth-error">两次输入的密码不一致。</p>}
          {props.error && <p className="df-auth-error">{props.error}</p>}
          {props.notice?.type === "confirm-email" && <div className="df-auth-notice"><strong>请先验证邮箱</strong><span>确认邮件已发送到 {props.notice.email}。完成确认后再登录。</span><div className="df-auth-notice-actions"><button type="button" onClick={() => void props.onResend(props.notice!.email)}>重新发送确认邮件</button><button type="button" disabled={props.busy || !privacyAccepted} onClick={() => { if (privacyAccepted) void props.onContinueAfterConfirm(props.notice!.email); }}>我已验证，前往登录</button></div></div>}
          <button className="df-auth-submit" type="submit" disabled={props.busy || !privacyAccepted || !email.trim() || password.length < 6 || Boolean(mismatch)}>
            {props.busy ? "处理中..." : intent === "signin" ? "进入 NavoPath" : "创建账号"}
          </button>
        </form>
        <p className="df-auth-note">各账号数据独立存储。已注册用户请直接登录；频繁注册将触发邮件发送限流。公开网页版不存储个人 AI API Key。</p>
      </section>
    </main>
  );
}

