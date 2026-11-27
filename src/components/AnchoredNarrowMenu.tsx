import { type CSSProperties, type ReactNode, type RefObject, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Popover } from "./UiPrimitives";
import { approachesBounds, createIntentSampler } from "../motion/intent";

export function AnchoredNarrowMenu({
  open,
  anchorRef,
  onClose,
  children,
  className,
  placement = "side",
  focusOnOpen = false,
  label,
  intentPreload,
}: {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  placement?: "side" | "below";
  focusOnOpen?: boolean;
  label: string;
  /** Only host-owned, idempotent module loaders may be passed here. */
  intentPreload?: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const intent = useRef<ReturnType<typeof createIntentSampler> | null>(null);
  const warmed = useRef(false);
  useLayoutEffect(() => { intent.current = null; warmed.current = false; }, [open]);
  const [position, setPosition] = useState({ left: 12, top: 12, maxHeight: 240 });

  useLayoutEffect(() => {
    if (!open) return;
    const panel = anchorRef.current?.closest(".df-candidate-panel");
    const update = () => {
      intent.current?.reset();
      const anchor = anchorRef.current;
      if (!anchor) return;
      const anchorRect = anchor.getBoundingClientRect();
      const menu = menuRef.current;
      const width = menu?.offsetWidth || 224;
      const height = Math.min(320, (menu?.firstElementChild?.scrollHeight || 240) + 2);
      const gap = 8, pad = 10;
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const right = anchorRect.right + gap;
      const preferredLeft = placement === "below" ? anchorRect.left : right + width <= viewportWidth - pad ? right : anchorRect.left - width - gap;
      const left = Math.max(pad, Math.min(preferredLeft, viewportWidth - width - pad));
      const below = viewportHeight - anchorRect.bottom - gap - pad;
      const above = anchorRect.top - gap - pad;
      const openAbove = placement === "below" && below < height && above > below;
      const preferredTop = placement === "side" ? Math.min(anchorRect.top - 6, viewportHeight - height - pad)
        : openAbove ? anchorRect.top - gap - Math.min(height, above) : anchorRect.bottom + gap;
      const top = Math.max(pad, preferredTop);
      const maxHeight = Math.max(0, openAbove ? above : viewportHeight - top - pad);
      setPosition((current) => current.left === left && current.top === top && current.maxHeight === maxHeight ? current : { left, top, maxHeight });
    };
    const dismiss = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && (menuRef.current?.contains(target) || anchorRef.current?.contains(target))) return;
      onClose();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      onClose();
      anchorRef.current?.focus();
    };
    const observer = new ResizeObserver(update);
    if (anchorRef.current) observer.observe(anchorRef.current);
    if (menuRef.current) observer.observe(menuRef.current);
    panel?.addEventListener("transitionend", update);
    update();
    window.addEventListener("resize", update);
    document.addEventListener("scroll", update, true);
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      observer.disconnect();
      panel?.removeEventListener("transitionend", update);
      window.removeEventListener("resize", update);
      document.removeEventListener("scroll", update, true);
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [anchorRef, onClose, open, placement]);

  useLayoutEffect(() => {
    if (!open || !focusOnOpen) return;
    const menu = menuRef.current;
    const active = menu?.querySelector<HTMLElement>('button[aria-pressed="true"]') ?? menu?.querySelector<HTMLElement>("button");
    active?.focus({ preventScroll: true });
  }, [open, focusOnOpen]);

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div ref={menuRef}
      onPointerMove={intentPreload ? event => {
        if (warmed.current || event.pointerType !== "mouse" || event.buttons !== 0 || !document.hasFocus()) {
          intent.current?.reset();
          return;
        }
        const point = { x: event.clientX, y: event.clientY, t: event.timeStamp };
        const prediction = (intent.current ??= createIntentSampler()).sample(point);
        if (!prediction) return;
        const target = event.currentTarget.querySelector<HTMLButtonElement>("button[data-intent-preload]");
        if (!target || target.disabled || target.getAttribute("aria-pressed") === "true") return;
        if (approachesBounds(point, prediction, target.getBoundingClientRect())) {
          warmed.current = true;
          intent.current = null;
          intentPreload();
        }
      } : undefined}
      onPointerLeave={intentPreload ? () => intent.current?.reset() : undefined}
      onPointerCancel={intentPreload ? () => intent.current?.reset() : undefined}
      onPointerDown={intentPreload ? () => intent.current?.reset() : undefined}
      className={["ui-narrow-menu-layer", className || ""].filter(Boolean).join(" ")} style={{ left: position.left, top: position.top, "--ui-narrow-menu-max-height": `${position.maxHeight}px` } as CSSProperties}>
      <Popover role="group" aria-label={label} className="ui-narrow-menu ui-divided-list" onKeyDown={event => {
        if (event.key !== "Escape") return;
        event.stopPropagation();
        onClose();
        anchorRef.current?.focus();
      }}>{children}</Popover>
    </div>,
    document.getElementById("df-portal-target") || document.body,
  );
}
