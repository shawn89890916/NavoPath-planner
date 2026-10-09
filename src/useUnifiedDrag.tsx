import React, { useState } from "react";
import { UnifiedDragOverlay, type UnifiedDragConfig, type UnifiedDragController, type UnifiedDragSnapshot } from "./unifiedDrag";

const SOURCE_CLASS = "is-dragging-source";
const BODY_CLASS = "df-unified-dragging";

export function useUnifiedDrag(): UnifiedDragController {
  const [snapshot, setSnapshot] = useState<UnifiedDragSnapshot | null>(null);
  const [pointer, setPointer] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const beginDrag = (event: React.PointerEvent<HTMLElement>, config: UnifiedDragConfig) => {
    if (event.button !== 0) return;
    const sourceElement = event.currentTarget as HTMLElement;
    const rect = sourceElement.getBoundingClientRect();
    const offset = {
      x: Math.min(Math.max(event.clientX - rect.left, 0), rect.width),
      y: Math.min(Math.max(event.clientY - rect.top, 0), rect.height),
    };
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startY = event.clientY;
    const threshold = config.threshold ?? 5;
    let active = false;
    let holdReady = config.requireHoldMs && event.pointerType === "touch" ? false : true;
    let holdCancelled = false;
    let holdTimer: number | undefined;
    if (config.requireHoldMs && event.pointerType === "touch") {
      holdTimer = window.setTimeout(() => {
        holdReady = true;
        sourceElement.classList.add("is-drag-armed");
        window.navigator.vibrate?.(8);
      }, config.requireHoldMs);
    }
    const clearHold = () => {
      if (holdTimer !== undefined) window.clearTimeout(holdTimer);
      sourceElement.classList.remove("is-drag-armed");
    };
    // A held touch must stop native panning before it cancels the pointer drag.
    // Swipes made before the hold completes keep their normal scrolling behavior.
    const preventHeldTouchScroll = (touchEvent: TouchEvent) => {
      if (holdReady && !holdCancelled) touchEvent.preventDefault();
    };
    if (event.pointerType === "touch" && config.requireHoldMs) {
      sourceElement.addEventListener("touchmove", preventHeldTouchScroll, { passive: false });
    }

    const baseSnapshot: Omit<UnifiedDragSnapshot, "pointer"> = {
      taskId: config.taskId,
      sourceElement,
      sourceRect: rect,
      offset,
      data: config.data || {},
    };

    const move = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      const distance = Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY);
      if (!holdReady) {
        if (distance >= 8) { holdCancelled = true; clearHold(); }
        return;
      }
      if (holdCancelled) return;
      if (!active && distance < threshold) return;
      if (!active) {
        active = true;
        moveEvent.preventDefault();
        try { sourceElement.setPointerCapture(pointerId); } catch { /* ignore */ }
        sourceElement.classList.add(SOURCE_CLASS);
        document.body.classList.add(BODY_CLASS);
        const snap: UnifiedDragSnapshot = { ...baseSnapshot, pointer: { x: moveEvent.clientX, y: moveEvent.clientY } };
        setSnapshot(snap);
        setPointer({ x: moveEvent.clientX, y: moveEvent.clientY });
        config.onActivate?.(snap);
      }
      moveEvent.preventDefault();
      const next = { x: moveEvent.clientX, y: moveEvent.clientY };
      setPointer(next);
      setSnapshot((current) => current ? { ...current, pointer: next } : current);
      config.onMove?.(next, { ...baseSnapshot, pointer: next });
    };

    const cleanup = () => {
      clearHold();
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("keydown", keydown);
      sourceElement.removeEventListener("touchmove", preventHeldTouchScroll);
      sourceElement.classList.remove(SOURCE_CLASS, "is-drag-armed");
      document.body.classList.remove(BODY_CLASS);
      if (sourceElement.hasPointerCapture(pointerId)) {
        try { sourceElement.releasePointerCapture(pointerId); } catch { /* ignore */ }
      }
      setSnapshot(null);
    };

    const up = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== pointerId) return;
      const wasActive = active;
      cleanup();
      if (wasActive) {
        config.onDrop?.({ x: upEvent.clientX, y: upEvent.clientY }, { ...baseSnapshot, pointer: { x: upEvent.clientX, y: upEvent.clientY } });
      }
    };
    const cancel = (cancelEvent: PointerEvent) => {
      if (cancelEvent.pointerId !== pointerId) return;
      const wasActive = active;
      cleanup();
      if (wasActive) config.onCancel?.();
    };
    const keydown = (kb: KeyboardEvent) => { if (kb.key === "Escape") cancel(new PointerEvent("pointercancel", { pointerId })); };

    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("keydown", keydown);
  };

  const overlay = snapshot ? (
    <UnifiedDragOverlay snapshot={snapshot} pointer={pointer} />
  ) : null;

  return { beginDrag, overlay, isDragging: snapshot !== null, snapshot };
};

