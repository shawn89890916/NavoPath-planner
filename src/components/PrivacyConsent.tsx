import { useId } from "react";
import type { Language } from "../types";
import "./privacy-consent.css";

export function PrivacyConsent({ lang, checked, onChange, disabled }: {
  lang: Language;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const zh = lang === "zh";
  return <div className="np-privacy-consent">
    <input id={id} name="privacy-consent" type="checkbox" required checked={checked} disabled={disabled} onChange={event => onChange(event.target.checked)} />
    <div>
      <label className="np-privacy-label" htmlFor={id}>{zh ? "我已阅读并同意" : "I have read and agree to the"}</label>{" "}
      <a href={`${location.protocol === "file:" ? "https://navopath.com" : ""}/privacy?lang=${lang}`} target="_blank" rel="noopener noreferrer">{zh ? "《隐私政策》" : "Privacy Policy"}</a>
    </div>
  </div>;
}
