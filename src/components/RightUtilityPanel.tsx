import { useRef } from "react";
import type { ReactNode } from "react";
import type { Language } from "../types";
import { CloseButton } from "./UiPrimitives";
import { useModalFocus } from "../useModalFocus";

export function RightUtilityPanel({
  label,
  closeLabel,
  onClose,
  children,
  className = "",
  closing = false,
}: {
  label: string;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  closing?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  useModalFocus(!closing, ref);
  const close = () => onClose();
  return <>
    <div className="df-utility-backdrop" onMouseDown={close} />
    <aside ref={ref} tabIndex={-1} className={`df-utility-panel${className ? ` ${className}` : ""}`} data-motion-closing={closing || undefined} role="dialog" aria-modal="true" aria-label={label}
      onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); close(); } }}>
      <div className="df-utility-head"><h2>{label}</h2><CloseButton label={closeLabel} onClick={close} /></div>
      <div className="df-utility-body">{children}</div>
    </aside>
  </>;
}

export function utilityPanelCloseLabel(lang: Language) {
  return lang === "zh" ? "关闭" : "Close";
}
