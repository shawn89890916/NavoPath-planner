import { useEffect, useRef, type RefObject } from "react";

export function sideWorkspaceSwipe(open: boolean, distance: number, velocity: number, width: number): boolean {
  const direction = open ? -1 : 1;
  return distance * direction >= Math.min(80, width * 0.3)
    || (distance * direction >= 24 && velocity * direction >= 0.5);
}

/** Mounted only by the lazy compact controls. The time rail owns horizontal gestures;
 * rows, editors and vertical scrolling retain their existing behavior. */
export function useSideWorkspaceGesture({ enabled, open, panelRef, onOpen, onClose }: {
  enabled: boolean; open: boolean; panelRef: RefObject<HTMLElement | null>; onOpen: () => void; onClose: () => void;
}) {
  const callbacks = useRef({ onOpen, onClose });
  callbacks.current = { onOpen, onClose };
  useEffect(() => {
    if (!enabled) return;
    const rail = document.getElementById("df-execute-timeline");
    if (!rail) return;
    const html = document.documentElement;
    let active: { id: number; x: number; y: number; lastX: number; lastTime: number; velocity: number; width: number; dragging: boolean } | null = null;
    let suppressClick = false;
    function reset() {
      if (!active) return;
      const id = active.id;
      active = null;
      html.removeAttribute("data-side-workspace-gesture");
      html.style.removeProperty("--side-workspace-drag-x");
      if (rail!.hasPointerCapture(id)) rail!.releasePointerCapture(id);
    }
    function down(event: PointerEvent) {
      suppressClick = false;
      if (active || event.pointerType !== "touch" || !event.isPrimary || event.button !== 0) return;
      const target = event.target;
      if (!(target instanceof Element) || target.closest("button, input, select, textarea, a, [contenteditable], .df-task-block, .df-time-block, .df-drawer")) return;
      if (document.body.classList.contains("df-timeline-pointer-drag") || document.querySelector(".df-app.is-dragging, .df-app[data-mobile-placing], .df-app.is-mobile-sheet-open")) return;
      if (event.clientX - rail!.getBoundingClientRect().left > 28) return;
      const width = panelRef.current?.offsetWidth || 0;
      if (width <= 0) return;
      active = { id: event.pointerId, x: event.clientX, y: event.clientY, lastX: event.clientX, lastTime: event.timeStamp, velocity: 0, width, dragging: false };
      rail!.setPointerCapture(event.pointerId);
      event.stopPropagation();
    }
    function move(event: PointerEvent) {
      const state = active;
      if (!state || state.id !== event.pointerId) return;
      const dx = event.clientX - state.x, dy = event.clientY - state.y;
      if (!state.dragging) {
        if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) { reset(); return; }
        if (Math.abs(dx) < 8) return;
        if (dx * (open ? -1 : 1) <= 0) { reset(); return; }
        state.dragging = suppressClick = true;
        html.setAttribute("data-side-workspace-gesture", "");
      }
      event.stopPropagation();
      event.preventDefault();
      state.velocity = (event.clientX - state.lastX) / Math.max(1, event.timeStamp - state.lastTime);
      state.lastX = event.clientX;
      state.lastTime = event.timeStamp;
      const offset = Math.max(0, Math.min(state.width, (open ? state.width : 0) + dx));
      html.style.setProperty("--side-workspace-drag-x", `${offset}px`);
    }
    function up(event: PointerEvent) {
      const state = active;
      if (!state || state.id !== event.pointerId) return;
      event.stopPropagation();
      const velocity = event.timeStamp - state.lastTime <= 120 ? state.velocity : 0;
      const commit = state.dragging && sideWorkspaceSwipe(open, event.clientX - state.x, velocity, state.width);
      reset();
      if (commit) (open ? callbacks.current.onClose : callbacks.current.onOpen)();
    }
    function cancel(event: PointerEvent) { if (active?.id === event.pointerId) reset(); }
    function click(event: MouseEvent) {
      if (suppressClick && event.detail !== 0) {
        suppressClick = false;
        event.preventDefault();
        event.stopPropagation();
      }
    }
    rail.addEventListener("pointerdown", down, true);
    rail.addEventListener("pointermove", move, { capture: true, passive: false });
    rail.addEventListener("pointerup", up, true);
    rail.addEventListener("pointercancel", cancel, true);
    rail.addEventListener("lostpointercapture", cancel, true);
    rail.addEventListener("click", click, true);
    window.addEventListener("blur", reset);
    window.addEventListener("resize", reset);
    return () => {
      rail.removeEventListener("pointerdown", down, true);
      rail.removeEventListener("pointermove", move, true);
      rail.removeEventListener("pointerup", up, true);
      rail.removeEventListener("pointercancel", cancel, true);
      rail.removeEventListener("lostpointercapture", cancel, true);
      rail.removeEventListener("click", click, true);
      window.removeEventListener("blur", reset);
      window.removeEventListener("resize", reset);
      reset();
    };
  }, [enabled, open, panelRef]);
}
