import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Unified drag overlay system for all task blocks.
 *
 * Provides a pointer-event-driven floating preview that renders a full intact
 * clone of the source task block following the pointer, plus shared CSS class
 * hooks (`is-dragging-source`, `is-drag-overlay`, `is-drop-container-active`,
 * `is-insertion-before`, `is-insertion-after`, `is-drop-placeholder`).
 *
 * The overlay clones the source DOM node and copies its computed box-model
 * styles so it looks identical regardless of where it is portalled. The source
 * element receives `is-dragging-source` so CSS can render a muted placeholder
 * that preserves layout space (no opacity-only ghost, no layout jump).
 */

export type UnifiedDragSnapshot = {
  taskId: string;
  sourceElement: HTMLElement;
  sourceRect: DOMRect;
  pointer: { x: number; y: number };
  offset: { x: number; y: number };
  data: Record<string, unknown>;
};

export type UnifiedDragHandlers = {
  onActivate?: (snapshot: UnifiedDragSnapshot) => void;
  onMove?: (pointer: { x: number; y: number }, snapshot: UnifiedDragSnapshot) => void;
  onDrop?: (pointer: { x: number; y: number }, snapshot: UnifiedDragSnapshot) => void;
  onCancel?: () => void;
};

export type UnifiedDragConfig = UnifiedDragHandlers & {
  taskId: string;
  data?: Record<string, unknown>;
  /** Movement distance before drag activates. Default 5. */
  threshold?: number;
  /** Touch hold time (ms) before drag activates. 0 = no hold. */
  requireHoldMs?: number;
};

export type UnifiedDragController = {
  /** Begin a pointer-event drag. Attach to the source element's onPointerDown. */
  beginDrag: (event: React.PointerEvent<HTMLElement>, config: UnifiedDragConfig) => void;
  /** The floating overlay React node. Render once at the root of the view. */
  overlay: React.ReactNode;
  /** True while a drag is in progress. */
  isDragging: boolean;
  /** Current snapshot, or null. */
  snapshot: UnifiedDragSnapshot | null;
};


/**
 * Copy the box-model and visual computed styles from `source` onto `clone` so
 * the clone looks identical after being moved to a different ancestor context.
 * Position/size are overridden separately by the overlay container.
 */
function copyVisualStyles(source: HTMLElement, clone: HTMLElement) {
  const computed = window.getComputedStyle(source);
  const props = [
    "background", "backgroundColor", "backgroundImage", "backgroundSize", "backgroundPosition", "backgroundRepeat",
    "border", "borderColor", "borderStyle", "borderWidth", "borderRadius",
    "boxShadow", "boxSizing",
    "color", "fontFamily", "fontSize", "fontWeight", "fontStyle", "letterSpacing", "lineHeight",
    "padding", "margin", "gap", "display", "gridTemplateColumns", "gridTemplateRows", "alignItems", "alignSelf", "justifyContent", "justifySelf", "flexDirection", "flexWrap", "flexGrow", "flexShrink", "flexBasis",
    "textDecoration", "textTransform", "whiteSpace", "overflow", "overflowX", "overflowY",
    "opacity", "filter", "backdropFilter",
  ];
  for (const prop of props) {
    const value = computed.getPropertyValue(prop);
    if (value) clone.style.setProperty(prop, value);
  }
  // CSS variables on the source (e.g. --task-project-color) — copy them all.
  for (let i = 0; i < computed.length; i++) {
    const name = computed.item(i);
    if (name.startsWith("--")) {
      clone.style.setProperty(name, computed.getPropertyValue(name));
    }
  }
}

/**
 * Recursively copy visual styles onto the clone's descendants so nested
 * elements (checkbox, title, duration, actions) keep their appearance.
 */
function deepCopyVisualStyles(source: HTMLElement, clone: HTMLElement) {
  copyVisualStyles(source, clone);
  const sourceChildren = Array.from(source.children) as HTMLElement[];
  const cloneChildren = Array.from(clone.children) as HTMLElement[];
  for (let i = 0; i < sourceChildren.length && i < cloneChildren.length; i++) {
    deepCopyVisualStyles(sourceChildren[i], cloneChildren[i]);
  }
}

export function UnifiedDragOverlay({ snapshot, pointer }: {
  snapshot: UnifiedDragSnapshot;
  pointer: { x: number; y: number };
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setTarget(document.querySelector<HTMLElement>(".df-app") || document.body);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const source = snapshot.sourceElement;
    // Build the clone once per source element.
    const clone = source.cloneNode(true) as HTMLElement;
    clone.removeAttribute("id");
    // Strip drag-state classes so the clone renders as a clean full card,
    // not as the muted source placeholder.
    clone.classList.remove("is-dragging-source", "is-dragging", "is-drag-armed", "is-drop-container-active", "is-insertion-before", "is-insertion-after", "is-drop-placeholder");
    clone.classList.add("is-drag-overlay-clone");
    // Copy visual styles so the clone looks identical outside its ancestor context.
    // Read from the source's computed style BEFORE any drag classes took effect
    // by temporarily removing them, reading, and restoring. This guarantees the
    // clone's colors/borders match the resting card appearance.
    const removedClasses: string[] = [];
    ["is-dragging-source", "is-dragging", "is-drag-armed"].forEach((cls) => {
      if (source.classList.contains(cls)) { source.classList.remove(cls); removedClasses.push(cls); }
    });
    deepCopyVisualStyles(source, clone);
    removedClasses.forEach((cls) => source.classList.add(cls));
    // Override layout-critical properties so the clone fills the overlay container.
    clone.style.position = "relative";
    clone.style.top = "auto";
    clone.style.left = "auto";
    clone.style.right = "auto";
    clone.style.bottom = "auto";
    clone.style.margin = "0";
    clone.style.width = "100%";
    clone.style.height = "100%";
    clone.style.transform = "none";
    clone.style.opacity = "1";
    clone.style.color = "";
    clone.style.pointerEvents = "none";
    clone.style.zIndex = "auto";
    // Disable any interactive elements inside the clone.
    clone.querySelectorAll("button, input, textarea, select, a").forEach((el) => {
      (el as HTMLElement).setAttribute("tabindex", "-1");
      (el as HTMLElement).style.pointerEvents = "none";
    });
    container.innerHTML = "";
    container.appendChild(clone);
  }, [target, snapshot.sourceElement, snapshot.sourceRect.width, snapshot.sourceRect.height]);

  if (!target) return null;
  return createPortal(
    <div
      ref={containerRef}
      className="df-unified-drag-overlay"
      style={{
        position: "fixed",
        left: `${pointer.x - snapshot.offset.x}px`,
        top: `${pointer.y - snapshot.offset.y}px`,
        width: `${snapshot.sourceRect.width}px`,
        height: `${snapshot.sourceRect.height}px`,
        pointerEvents: "none",
        zIndex: 99999,
      }}
    />,
    target,
  );
}

/**
 * TaskDragLayer — renders a real React TaskBlock (or any React node) as the
 * drag overlay, following the pointer. Unlike UnifiedDragOverlay which clones
 * the source DOM, this renders an actual React component so it always has the
 * correct, intact TaskBlock styling.
 *
 * Portals to .df-app (falling back to document.body) so CSS variables and
 * theme tokens resolve correctly.
 */
export function TaskDragLayer({ children, pointer, sourceRect, offset }: {
  children: React.ReactNode;
  pointer: { x: number; y: number };
  sourceRect: { width: number; height: number };
  offset: { x: number; y: number };
}) {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setTarget(document.querySelector<HTMLElement>(".df-app") || document.body);
  }, []);
  if (!target) return null;
  return createPortal(
    <div
      className="df-task-drag-layer"
      style={{
        position: "fixed",
        left: `${pointer.x - offset.x}px`,
        top: `${pointer.y - offset.y}px`,
        width: `${sourceRect.width}px`,
        height: `${sourceRect.height}px`,
        pointerEvents: "none",
        zIndex: 99999,
      }}
    >
      {children}
    </div>,
    target,
  );
}

/**
 * Helpers for drop-target feedback. These add/remove shared CSS classes on
 * drop target elements so a single stylesheet can style insertion lines and
 * container outlines consistently across views.
 */
export const dropFeedback = {
  containerActive(el: HTMLElement | null, active: boolean) {
    if (!el) return;
    el.classList.toggle("is-drop-container-active", active);
  },
  insertion(el: HTMLElement | null, position: "before" | "after" | null) {
    if (!el) return;
    el.classList.remove("is-insertion-before", "is-insertion-after");
    if (position) el.classList.add(`is-insertion-${position}`);
  },
  placeholder(el: HTMLElement | null, active: boolean) {
    if (!el) return;
    el.classList.toggle("is-drop-placeholder", active);
  },
};

/**
 * Auto-scroll a scroll container when the pointer is near its top/bottom edge
 * during a drag. Returns a cleanup function.
 */
export function startEdgeAutoScroll(getScrollEl: () => HTMLElement | null, edgeSize = 48, step = 18) {
  let raf = 0;
  let lastPointer = { x: 0, y: 0 };
  const onPointer = (e: PointerEvent) => { lastPointer = { x: e.clientX, y: e.clientY }; };
  const tick = () => {
    const el = getScrollEl();
    if (el) {
      const rect = el.getBoundingClientRect();
      if (lastPointer.y < rect.top + edgeSize) el.scrollTop -= step;
      else if (lastPointer.y > rect.bottom - edgeSize) el.scrollTop += step;
    }
    raf = window.requestAnimationFrame(tick);
  };
  window.addEventListener("pointermove", onPointer, { passive: true });
  raf = window.requestAnimationFrame(tick);
  return () => {
    window.removeEventListener("pointermove", onPointer);
    window.cancelAnimationFrame(raf);
  };
}
