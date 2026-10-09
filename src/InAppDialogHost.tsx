import React, { useEffect, useRef, useState } from "react";
import type { Language } from "./i18n";
import type { DialogRequest } from "./InAppDialog";
import { Button, Input, Modal } from "./components/UiPrimitives";
function labels(lang: Language) {
  return lang === "zh"
    ? { cancel: "取消", confirm: "确定", ok: "知道了" }
    : { cancel: "Cancel", confirm: "Confirm", ok: "OK" };
}

export default function InAppDialogHost({
  lang,
  request,
  onClose,
}: {
  lang: Language;
  request: DialogRequest;
  onClose: (value: string | boolean | null) => void;
}) {
  const text = labels(lang);
  const [value, setValue] = useState(request.initialValue || "");
  const [themeStyle] = useState(() => {
    const app = document.querySelector(".df-app");
    if (!app) return undefined;
    const theme = getComputedStyle(app);
    return Object.fromEntries([
      "--accent-active", "--surface-main", "--text-main", "--text-muted",
      "--paper-rule-strong", "--paper-note", "--radius-control", "--corner-shape",
      "--color-ink", "--color-muted", "--border-focus",
    ].map((token) => [token, theme.getPropertyValue(token)])) as React.CSSProperties;
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const isPrompt = request.kind === "prompt";
  const isAlert = request.kind === "alert";

  useEffect(() => {
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose(isAlert ? true : null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isAlert, onClose]);

  const submit = (event?: React.FormEvent) => {
    event?.preventDefault();
    if (isPrompt) onClose(value);
    else onClose(true);
  };

  return (
    <Modal
      role={isAlert ? "alertdialog" : "dialog"}
      labelledBy="df-dialog-title"
      onClose={() => onClose(isAlert ? true : null)}
      className="df-dialog"
      style={themeStyle}
    >
        <form onSubmit={submit}>
          <h2 id="df-dialog-title">{request.title}</h2>
          {request.message && <p>{request.message}</p>}
          {isPrompt && (
            <Input
              ref={inputRef}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder={request.placeholder}
            />
          )}
          <div className="df-dialog-actions">
            {!isAlert && (
              <Button type="button" variant="secondary" className="df-dialog-secondary" onClick={() => onClose(isPrompt ? null : false)}>
                {request.cancelLabel || text.cancel}
              </Button>
            )}
            <Button type="submit" variant="primary" className="df-dialog-primary">
              {request.confirmLabel || (isAlert ? text.ok : text.confirm)}
            </Button>
          </div>
        </form>
    </Modal>
  );
}
