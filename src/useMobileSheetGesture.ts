import { useEffect, useRef, type HTMLAttributes, type PointerEventHandler } from "react";

/** Header gestures leave the sheet's content available for native scrolling. */
export function useMobileSheetGesture({ enabled = true, minDragY = -24, onSwipeUp, onSwipeDown }: {
  enabled?: boolean;
  minDragY?: number;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
}): HTMLAttributes<HTMLElement> {
  const gestureRef = useRef<{
    start: PointerEvent; last: PointerEvent;
    header: HTMLElement; panel: HTMLElement; velocity: number;
  } | null>(null);
  const suppressClick = useRef(false);
  const reset = () => {
    const gesture = gestureRef.current;
    gestureRef.current = null;
    const panel = gesture?.panel;
    panel?.classList.remove("is-sheet-dragging");
    panel?.style.removeProperty("--mobile-sheet-drag-y");
  };
  useEffect(() => reset, [enabled]);

  const finish: PointerEventHandler<HTMLElement> = (event) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.start.pointerId !== event.pointerId) return;
    const distance = event.clientY - gesture.start.clientY;
    const velocity = event.timeStamp - gesture.last.timeStamp <= 120 ? gesture.velocity : 0;
    const swiped = suppressClick.current && event.type === "pointerup";
    reset();
    if (!swiped) return;
    const up = distance < 0;
    if (Math.abs(distance) >= (up ? 54 : 88) || (Math.abs(distance) >= 24 && velocity * (up ? -1 : 1) >= 0.6)) {
      (up ? onSwipeUp : onSwipeDown)?.();
    }
  };
  return {
    onPointerDownCapture: (event) => {
      if (!enabled || gestureRef.current || !event.isPrimary || event.button !== 0) return;
      suppressClick.current = false;
      // Menus inside the header own their own interaction.
      if ((event.target as Element).closest(".ui-popover, .df-ai-plan-menu")) return;
      const panel = event.currentTarget.parentElement;
      if (!panel) return;
      gestureRef.current = { start: event.nativeEvent, last: event.nativeEvent,
        header: event.currentTarget, panel, velocity: 0 };
    },
    onPointerMoveCapture: (event) => {
      const gesture = gestureRef.current;
      if (!gesture || gesture.start.pointerId !== event.pointerId) return;
      const distance = event.clientY - gesture.start.clientY;
      const horizontal = Math.abs(event.clientX - gesture.start.clientX);
      if (!suppressClick.current) {
        if (horizontal > 8 && horizontal > Math.abs(distance)) { reset(); return; }
        if (Math.abs(distance) < 8) return;
        suppressClick.current = true;
        gesture.header.setPointerCapture(event.pointerId);
        gesture.panel.classList.add("is-sheet-dragging");
      }
      event.preventDefault();
      gesture.velocity = (event.clientY - gesture.last.clientY) / Math.max(1, event.timeStamp - gesture.last.timeStamp);
      gesture.last = event.nativeEvent;
      gesture.panel.style.setProperty("--mobile-sheet-drag-y", `${Math.max(minDragY, distance)}px`);
    },
    onPointerUpCapture: finish,
    onPointerCancelCapture: finish,
    onLostPointerCapture: (event) => { if (event.target === event.currentTarget) reset(); },
    onClickCapture: (event) => {
      if (suppressClick.current && event.detail !== 0) { event.preventDefault(); event.stopPropagation(); }
    },
  };
}
