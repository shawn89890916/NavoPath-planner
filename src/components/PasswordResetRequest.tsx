import { useState } from "react";
import { t, type Language } from "../i18n";
import { Button } from "./UiPrimitives";

export default function PasswordResetRequest({ lang, email, onRequest, onBack, landing = false, showEmailPrompt = landing }: {
  lang: Language;
  email: string;
  onRequest: (email: string) => Promise<void>;
  onBack: () => void;
  landing?: boolean;
  showEmailPrompt?: boolean;
}) {
  const [address, setAddress] = useState(email);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const label = (key: string) => t(lang, "auth." + key);
  const busy = status === "sending";

  return <>
    <h2>{label("resetPassword")}</h2>
    <form aria-busy={busy} onSubmit={async (event) => {
      event.preventDefault();
      if (busy || !address.trim()) return;
      setStatus("sending");
      try {
        await onRequest(address.trim());
        setStatus("sent");
      } catch {
        setStatus("error");
      }
    }}>
      {showEmailPrompt && <p>{label("resetEmailPrompt")}</p>}
      <input type="email" aria-label={label(showEmailPrompt ? "email" : "registrationEmail")} placeholder={label(showEmailPrompt ? "email" : "registrationEmail")} autoComplete="email" value={address} disabled={busy} onChange={(event) => {
        setAddress(event.target.value);
        setStatus("idle");
      }} required autoFocus />
      {status === "sent" && <p role="status" className={landing ? "landing-auth-notice" : "df-auth-note"}>{label("resetEmailDesc")}</p>}
      {status === "error" && <p role="alert" className={landing ? "landing-auth-error" : "df-auth-error"}>{label("resetEmailError")}</p>}
      <Button type="submit" variant="primary" className={landing ? "landing-button primary full" : "df-auth-submit"} pending={busy} disabled={!address.trim()}>
        {label(busy ? "processing" : status === "sent" ? "resendResetEmail" : "sendResetEmail")}
      </Button>
      <Button variant="ghost" className={landing ? "landing-button quiet full" : undefined} disabled={busy} onClick={onBack}>{label("backToLogin")}</Button>
    </form>
  </>;
}
