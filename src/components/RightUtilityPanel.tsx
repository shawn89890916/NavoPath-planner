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
  workspace = false,
}: {
  label: string;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  closing?: boolean;
  workspace?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  useModalFocus(!workspace && !closing, ref);
  const close = () => onClose();
  return <>
    <div className="df-utility-backdrop" data-workspace-backdrop={workspace || undefined} onMouseDown={close} />
    <aside ref={ref} tabIndex={-1} className={`df-utility-panel${className ? ` ${className}` : ""}`} data-workspace-panel={workspace || undefined} data-motion-closing={closing || undefined} inert={closing} role="dialog" aria-modal={workspace ? undefined : true} aria-label={label}
      onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); close(); } }}>
      <div className="df-utility-head"><h2>{label}</h2><CloseButton label={closeLabel} onClick={close} /></div>
      <div className="df-utility-body">{children}</div>
    </aside>
  </>;
}

export function utilityPanelCloseLabel(lang: Language) {
  return lang === "zh" ? "关闭" : "Close";
}
