import React, { lazy, Suspense, useCallback, useRef, useState } from "react";
import type { Language } from "./i18n";
import { useMotionPresence } from "./useMotionPresence";
const InAppDialogHost = lazy(() => import("./InAppDialogHost"));

type DialogKind = "prompt" | "confirm" | "alert";

export type DialogRequest = {
  kind: DialogKind;
  title: string;
  message?: string;
  initialValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  resolve: (value: string | boolean | null) => void;
};

export function useInAppDialog(lang: Language) {
  const [request, setRequest] = useState<DialogRequest | null>(null);
  const pendingRef = useRef<DialogRequest | null>(null);
  const retainedRequestRef = useRef(request);
  if (request) retainedRequestRef.current = request;
  const presence = useMotionPresence(Boolean(request));

  const close = useCallback((value: string | boolean | null) => {
    const current = pendingRef.current;
    if (!current) return;
    pendingRef.current = null;
    setRequest(null);
    current.resolve(value);
  }, []);

  const open = useCallback((next: Omit<DialogRequest, "resolve">) => {
    if (pendingRef.current) pendingRef.current.resolve(null);
    return new Promise<string | boolean | null>((resolve) => {
      const requestWithResolver = { ...next, resolve };
      pendingRef.current = requestWithResolver;
      setRequest(requestWithResolver);
    });
  }, []);

  const prompt = useCallback(
    (title: string, initialValue = "", options?: { message?: string; placeholder?: string; confirmLabel?: string; cancelLabel?: string }) =>
      open({ kind: "prompt", title, initialValue, ...options }) as Promise<string | null>,
    [open],
  );

  const confirm = useCallback(
    (title: string, options?: { message?: string; confirmLabel?: string; cancelLabel?: string }) =>
      open({ kind: "confirm", title, ...options }) as Promise<boolean | null>,
    [open],
  );

  const alert = useCallback(
    (title: string, options?: { message?: string; confirmLabel?: string }) =>
      open({ kind: "alert", title, ...options }).then(() => undefined),
    [open],
  );

  const host = presence.present && retainedRequestRef.current ? <Suspense fallback={null}><InAppDialogHost open={Boolean(request)} lang={lang} request={retainedRequestRef.current} onClose={close} /></Suspense> : null;
  return { prompt, confirm, alert, host };
}

