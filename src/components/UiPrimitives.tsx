import React, { forwardRef, useEffect, useRef, useState, type ButtonHTMLAttributes, type HTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useMotionPresence } from "../useMotionPresence";
import { UiCloseIcon, UiMoreIcon } from "./UiIcons";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }>(function Button({ variant = "secondary", className, type = "button", ...props }, ref) {
  return <button ref={ref} type={type} className={["ui-button", `ui-button--${variant}`, className || ""].filter(Boolean).join(" ")} {...props} />;
});

export const IconButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { icon: ReactNode; label: string }>(function IconButton({ icon, label, className, title = label, type = "button", ...props }, ref) {
  return <button ref={ref} type={type} className={["ui-icon-button", className || ""].filter(Boolean).join(" ")} aria-label={label} title={title} {...props}>{icon}</button>;
});

export const CloseButton = forwardRef<HTMLButtonElement, Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> & { label: string }>(function CloseButton({ label, className, ...props }, ref) {
  return <IconButton ref={ref} icon={<UiCloseIcon size={16} />} label={label} className={["ui-icon-button--close", className || ""].filter(Boolean).join(" ")} {...props} />;
});

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={["ui-input", className || ""].filter(Boolean).join(" ")} {...props} />;
});

export function Surface({ as: Component = "div", tone = "default", className, children, ...props }: HTMLAttributes<HTMLElement> & { as?: "div" | "section" | "article"; tone?: "main" | "raised" | "card" | "default"; children?: ReactNode }) {
  return <Component className={["ui-surface", `ui-surface--${tone}`, className || ""].filter(Boolean).join(" ")} {...props}>{children}</Component>;
}

export function Divider({ className, ...props }: HTMLAttributes<HTMLHRElement>) {
  return <hr className={["ui-divider", className || ""].filter(Boolean).join(" ")} {...props} />;
}

export function Popover({ className, children, ...props }: HTMLAttributes<HTMLDivElement> & { children?: ReactNode }) {
  return <div role={props.role || "dialog"} className={["ui-popover", className || ""].filter(Boolean).join(" ")} {...props}>{children}</div>;
}

export function ActionDisclosure({ label, children }: { label: string; children: ReactNode }) {
  const disclosureRef = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);
  const presence = useMotionPresence(open);
  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      const disclosure = disclosureRef.current;
      if (disclosure && !disclosure.contains(event.target as Node | null)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, []);
  return (
    <details ref={disclosureRef} open={presence.present} className="ui-action-disclosure" onBlur={(event) => {
      // Touch browsers may blur to the body before dispatching the menu item's click.
      if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false);
    }} onKeyDown={(event) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setOpen(false);
      event.currentTarget.querySelector("summary")?.focus();
    }}>
      <summary aria-label={label} title={label} aria-expanded={open} onClick={(event) => { event.preventDefault(); setOpen((current) => !current); }}><UiMoreIcon /></summary>
      <Popover role="group" aria-label={label} className="ui-action-disclosure-panel" data-motion-closing={presence.closing || undefined} inert={!open} aria-hidden={!open || undefined} onClick={(event) => {
        const button = (event.target as HTMLElement).closest("button");
        if (button && !button.hasAttribute("aria-pressed")) setOpen(false);
      }}>{children}</Popover>
    </details>
  );
}

export function Modal({ open = true, role = "dialog", label, labelledBy, onClose, className, children, ...props }: Omit<HTMLAttributes<HTMLElement>, "role"> & { open?: boolean; role?: "dialog" | "alertdialog"; label?: string; labelledBy?: string; onClose?: () => void; children?: ReactNode }) {
  const presence = useMotionPresence(open);
  if (!presence.present) return null;
  const modal = (
    <div className="ui-modal-overlay" data-motion-closing={presence.closing || undefined} inert={presence.closing} role="presentation" onMouseDown={onClose}>
      <section
        {...props}
        className={["ui-modal", className || ""].filter(Boolean).join(" ")}
        role={role}
        aria-modal="true"
        aria-label={label}
        aria-labelledby={labelledBy}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {children}
      </section>
    </div>
  );
  return typeof document === "undefined" ? modal : createPortal(modal, document.body);
}
