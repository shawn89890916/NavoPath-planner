import { useEffect, useState } from "react";
import PasswordResetRequest from "./components/PasswordResetRequest";
import { Button } from "./components/UiPrimitives";
import { t, type Language } from "./i18n";
import type { PlannerApi } from "./types";
import { ProductIcon } from "./WorkspacePresentation";

export default function PasswordRecoveryPage({ lang, getApi, onRequest }: {
  lang: Language;
  getApi: () => Promise<PlannerApi>;
  onRequest: (email: string) => Promise<void>;
}) {
  const [status, setStatus] = useState<"checking" | "ready" | "expired" | "updated">("checking");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const label = (key: string) => t(lang, "auth." + key);
  const valid = password.length >= 8 && /[a-z]/i.test(password) && /[0-9]/.test(password);
  const mismatch = confirmation.length > 0 && password !== confirmation;

  useEffect(() => {
    void getApi()
      .then((api) => api.completePasswordRecovery?.())
      .then((verified) => setStatus(verified ? "ready" : "expired"), () => setStatus("expired"));
  }, [getApi]);

  return (
    <main className="df-auth-shell" lang={lang}>
      <section className="df-auth-card">
        <div className="df-auth-brand"><ProductIcon /><strong>NavoPath</strong></div>
        {status === "checking" && <p role="status">{label("checkingResetLink")}</p>}
        {status === "expired" && <>
          <p role="alert" className="df-auth-error">{label("resetLinkExpired")}</p>
          <PasswordResetRequest lang={lang} email="" onRequest={onRequest} onBack={() => window.location.assign("/app")} />
        </>}
        {status === "updated" && <>
          <p role="status">{label("resetSuccess")}</p>
          <a href="/app">{label("backToLogin")}</a>
        </>}
        {status === "ready" && <>
          <h1>{label("setNewPassword")}</h1>
          <form aria-busy={busy} onSubmit={async (event) => {
            event.preventDefault();
            if (busy || !valid || password !== confirmation) return;
            setBusy(true);
            setFailed(false);
            try {
              const api = await getApi();
              const updated = await api.resetPassword?.(password);
              setPassword("");
              setConfirmation("");
              setStatus(updated ? "updated" : "expired");
            } catch {
              setFailed(true);
            } finally {
              setBusy(false);
            }
          }}>
            <p className="df-auth-note" id="reset-password-rules">{label("passwordStrength")}</p>
            <label>{label("newPassword")}
              <input type="password" autoComplete="new-password" aria-describedby="reset-password-rules" value={password} disabled={busy} onChange={(event) => setPassword(event.target.value)} minLength={8} required autoFocus />
            </label>
            <label>{label("confirmNewPassword")}
              <input type="password" autoComplete="new-password" value={confirmation} disabled={busy} onChange={(event) => setConfirmation(event.target.value)} minLength={8} required />
            </label>
            {mismatch && <p className="df-auth-error" role="alert">{label("passwordMismatch")}</p>}
            {failed && <p className="df-auth-error" role="alert">{label("resetPasswordError")}</p>}
            <Button type="submit" variant="primary" className="df-auth-submit" pending={busy} disabled={!valid || password !== confirmation}>{label(busy ? "processing" : "setNewPassword")}</Button>
          </form>
        </>}
      </section>
    </main>
  );
}
