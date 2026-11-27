import { useEffect, useRef, type HTMLAttributes } from "react";

export function sideWorkspaceSwipe(open: boolean, distance: number, velocity: number, width: number): boolean {
  const direction = open ? -1 : 1;
  return distance * direction >= Math.min(80, width * 0.3)
    || (distance * direction >= 24 && velocity * direction >= 0.5);
}

/** The time rail owns horizontal touch gestures; rows and controls retain their drag/scroll behavior. */
export function useSideWorkspaceGesture({ enabled, open, getWidth, onOpen, onClose }: {
  enabled: boolean; open: boolean; getWidth: () => number; onOpen: () => void; onClose: () => void;
}): HTMLAttributes<HTMLElement> {
  const active = useRef<{ id: number; x: number; y: number; lastX: number; lastTime: number; velocity: number; width: number; dragging: boolean } | null>(null);
  const suppressClick = useRef(false);
  function reset() {
    if (!active.current) return;
    active.current = null;
    document.documentElement.removeAttribute("data-side-workspace-gesture");
    document.documentElement.style.removeProperty("--side-workspace-drag-x");
  }
  useEffect(() => {
    if (!enabled) return;
    window.addEventListener("blur", reset);
    window.addEventListener("resize", reset);
    return () => {
      window.removeEventListener("blur", reset);
      window.removeEventListener("resize", reset);
      reset();
    };
  }, [enabled, open]);
  return {
    onPointerDownCapture(event) {
      suppressClick.current = false;
      if (!enabled || active.current || event.pointerType !== "touch" || !event.isPrimary || event.button !== 0) return;
      const target = event.target;
      if (!(target instanceof Element) || target.closest("button, input, select, textarea, a, [contenteditable], .df-task-block, .df-time-block, .df-drawer")) return;
      if (document.body.classList.contains("df-timeline-pointer-drag") || document.querySelector(".df-app.is-dragging, .df-app[data-mobile-placing], .df-app.is-mobile-sheet-open")) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX - rect.left > 28) return;
      const width = getWidth();
      if (width <= 0) return;
      active.current = { id: event.pointerId, x: event.clientX, y: event.clientY, lastX: event.clientX, lastTime: event.timeStamp, velocity: 0, width, dragging: false };
      event.currentTarget.setPointerCapture(event.pointerId);
      event.stopPropagation();
    },
    onPointerMoveCapture(event) {
      const state = active.current;
      if (!state || state.id !== event.pointerId) return;
      const dx = event.clientX - state.x, dy = event.clientY - state.y;
      if (!state.dragging) {
        if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) { reset(); return; }
        if (Math.abs(dx) < 8) return;
        if (dx * (open ? -1 : 1) <= 0) { reset(); return; }
        state.dragging = true;
        suppressClick.current = true;
        document.documentElement.setAttribute("data-side-workspace-gesture", "");
      }
      event.stopPropagation();
      event.preventDefault();
      state.velocity = (event.clientX - state.lastX) / Math.max(1, event.timeStamp - state.lastTime);
      state.lastX = event.clientX;
      state.lastTime = event.timeStamp;
      const offset = Math.max(0, Math.min(state.width, (open ? state.width : 0) + dx));
      document.documentElement.style.setProperty("--side-workspace-drag-x", `${offset}px`);
    },
    onPointerUpCapture(event) {
      const state = active.current;
      if (!state || state.id !== event.pointerId) return;
      event.stopPropagation();
      const velocity = event.timeStamp - state.lastTime <= 120 ? state.velocity : 0;
      const commit = state.dragging && sideWorkspaceSwipe(open, event.clientX - state.x, velocity, state.width);
      reset();
      if (commit) (open ? onClose : onOpen)();
    },
    onPointerCancelCapture: reset,
    onLostPointerCapture: reset,
    onClickCapture(event) {
      if (suppressClick.current && event.detail !== 0) {
        suppressClick.current = false;
        event.preventDefault();
        event.stopPropagation();
      }
    },
  };
}
