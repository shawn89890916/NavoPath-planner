import { useState } from "react";
import { t, type Language } from "./i18n";
import { ProductIcon } from "./WorkspacePresentation";
import { PrivacyConsent } from "./components/PrivacyConsent";
export default function AuthGate(props: {
  lang: Language;
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
  const label = (key: string) => t(props.lang, "auth." + key);
  const mismatch = intent === "signup" && password && confirmPassword && password !== confirmPassword;
  return (
    <main className="df-auth-shell">
      <section className="df-auth-card">
        <div className="df-auth-brand">
          <ProductIcon />
          <div>
            <strong>NavoPath</strong>
            <span>{label("tagline")}</span>
          </div>
        </div>
        <div className="df-auth-tabs">
          <button className={intent === "signin" ? "active" : ""} onClick={() => { if (intent !== "signin") setPrivacyAccepted(false); setIntent("signin"); }}>{label("login")}</button>
          <button className={intent === "signup" ? "active" : ""} onClick={() => { if (intent !== "signup") setPrivacyAccepted(false); setIntent("signup"); }}>{label("register")}</button>
        </div>
        <form onSubmit={(event) => {
          event.preventDefault();
          if (props.busy || !privacyAccepted || mismatch) return;
          void props.onSubmit(email.trim(), password, displayName.trim(), intent, privacyAccepted);
        }}>
          {intent === "signup" && <label>{label("username")}<input type="text" value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="nickname" maxLength={64} /></label>}
          <label>{label("email")}<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>
          <label>{label("password")}<input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={intent === "signin" ? "current-password" : "new-password"} minLength={6} required /></label>
          {intent === "signup" && <label>{label("confirmPassword")}<input type={showPassword ? "text" : "password"} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" minLength={6} required /></label>}
          <label className="df-auth-check"><input type="checkbox" checked={showPassword} onChange={(event) => setShowPassword(event.target.checked)} />{label("showPassword")}</label>
          <PrivacyConsent lang={props.lang} checked={privacyAccepted} onChange={setPrivacyAccepted} disabled={props.busy} />
          {mismatch && <p className="df-auth-error">{label("passwordMismatch")}</p>}
          {props.error && <p className="df-auth-error">{props.error}</p>}
          {props.notice?.type === "confirm-email" && <div className="df-auth-notice"><strong>{label("checkInbox")}</strong><span>{label("emailSent")} {props.notice.email}{label("confirmationSuffix")}</span><div className="df-auth-notice-actions"><button type="button" onClick={() => void props.onResend(props.notice!.email)}>{label("resend")}</button><button type="button" disabled={props.busy || !privacyAccepted} onClick={() => { if (privacyAccepted) void props.onContinueAfterConfirm(props.notice!.email); }}>{label("confirmedGoLogin")}</button></div></div>}
          <button className="df-auth-submit" type="submit" disabled={props.busy || !privacyAccepted || !email.trim() || password.length < 6 || Boolean(mismatch)}>
            {props.busy ? label("processing") : intent === "signin" ? label("enterApp") : label("createAccount")}
          </button>
        </form>
        <p className="df-auth-note">{label("note")}</p>
      </section>
    </main>
  );
}

