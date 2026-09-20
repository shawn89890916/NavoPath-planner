import { type CSSProperties, type ReactNode, type RefObject, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Popover } from "./UiPrimitives";

export function AnchoredNarrowMenu({
  open,
  anchorRef,
  onClose,
  children,
  className,
  placement = "side",
  label,
}: {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  placement?: "side" | "below";
  label: string;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: 12, top: 12, maxHeight: 240 });

  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const anchorRect = anchor.getBoundingClientRect();
      const width = menuRef.current?.offsetWidth || 220;
      const height = menuRef.current?.offsetHeight || 240;
      const gap = 8, pad = 10;
      let left = placement === "below" ? anchorRect.right - width : anchorRect.right + gap;
      if (left + width > window.innerWidth - pad) left = placement === "side" ? anchorRect.left - width - gap : window.innerWidth - width - pad;
      left = Math.max(pad, left);
      let top = placement === "below" ? anchorRect.bottom + gap : anchorRect.top - 6;
      if (top + height > window.innerHeight - pad) top = placement === "below" ? anchorRect.top - height - gap : window.innerHeight - height - pad;
      top = Math.max(pad, top);
      setPosition({ left, top, maxHeight: Math.max(132, window.innerHeight - top - pad) });
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
    update();
    window.addEventListener("resize", update);
    document.addEventListener("scroll", update, true);
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("resize", update);
      document.removeEventListener("scroll", update, true);
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [anchorRef, onClose, open, placement]);

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div ref={menuRef} className={["ui-narrow-menu-layer", className || ""].filter(Boolean).join(" ")} style={{ left: position.left, top: position.top, "--ui-narrow-menu-max-height": `${position.maxHeight}px` } as CSSProperties}>
      <Popover role="group" aria-label={label} className="ui-narrow-menu">{children}</Popover>
    </div>,
    document.getElementById("df-portal-target") || document.body,
  );
}
