import React, { useEffect, useRef } from "react";
import { Button, CloseButton } from "./UiPrimitives";
import { UiChevronUpIcon } from "./UiIcons";
import type { Language } from "../types";

export default function MobileExecutionControls({ lang, count, title, time, conflict, onOpen, onCancel, onConfirm, triggerRef, hidden, drawerOpen, panelRef, scrollRef, onClose }: {
  hidden: boolean; drawerOpen: boolean; panelRef: React.RefObject<HTMLElement | null>; scrollRef: React.RefObject<number>; onClose: () => void;
  lang: Language; count: number; title?: string; time?: string; conflict?: boolean;
  onOpen: () => void; onCancel: () => void; onConfirm: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const zh = lang === "zh";
  const wasOpen = useRef(false);
  useEffect(() => {
    if (!drawerOpen) {
      if (wasOpen.current && title === undefined && !hidden) window.requestAnimationFrame(() => triggerRef.current?.focus());
      wasOpen.current = false;
      return;
    }
    wasOpen.current = true;
    const panel = panelRef.current;
    const list = panel?.querySelector<HTMLElement>(".df-candidate-list");
    if (list) list.scrollTop = scrollRef.current;
    panel?.querySelector<HTMLButtonElement>(".df-mobile-candidate-close")?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); onClose(); }
      if (event.key !== "Tab" || !panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>('button, input, select, textarea, [tabindex="0"]')).filter((item) => item.getClientRects().length && !item.hasAttribute("disabled"));
      const first = items[0], last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, [drawerOpen]);
  if (hidden) return null;
  return <div className="df-mobile-execution-controls">
    {title !== undefined ? <section className="df-mobile-placement" aria-label={zh ? "安排任务" : "Schedule task"}>
      <div aria-live="polite"><strong>{title}</strong><span>{time || (zh ? "点选时间安排" : "Tap the timeline to choose a time")}</span>
        {conflict && <span role="status">{zh ? "与已有日程重叠，仍可确认" : "Overlaps an existing event; you can still confirm"}</span>}</div>
      <div className="df-mobile-placement-actions"><Button onClick={onCancel}>{zh ? "取消" : "Cancel"}</Button>
        <Button variant="primary" disabled={!time} onClick={onConfirm}>{zh ? "确认安排" : "Confirm schedule"}</Button></div>
    </section> : <button type="button" ref={triggerRef} className="df-mobile-candidates-trigger" aria-label={zh ? `展开待安排任务（${count}）` : `Expand tasks to schedule (${count})`} title={zh ? "展开待安排任务" : "Expand tasks to schedule"} aria-haspopup="dialog" aria-expanded={false} onClick={onOpen}><UiChevronUpIcon size={20} /></button>}
  </div>;
}

export function MobileCandidateHeading({ lang, onClose }: { lang: Language; onClose: () => void }) {
  const gesture = useRef<{ pointerId: number; startY: number; startHeight: number; panel: HTMLElement; previousHeight: string; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  function resize(panel: HTMLElement, height: number) {
    const max = parseFloat(getComputedStyle(panel).maxHeight) || window.visualViewport?.height || window.innerHeight;
    panel.style.setProperty("--mobile-candidate-height", `${Math.max(Math.min(180, max), Math.min(max, height))}px`);
  }
  function finish(event: React.PointerEvent<HTMLButtonElement>) {
    const active = gesture.current;
    if (!active || active.pointerId !== event.pointerId) return;
    gesture.current = null;
    if (event.type !== "pointerup") {
      if (active.previousHeight) active.panel.style.setProperty("--mobile-candidate-height", active.previousHeight);
      else active.panel.style.removeProperty("--mobile-candidate-height");
    }
    suppressClick.current = event.type === "pointerup" && active.moved;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  return <div className="df-mobile-candidate-heading">
    <button type="button" className="df-mobile-candidate-grabber" aria-label={lang === "zh" ? "拖动调整候选面板高度，点按关闭" : "Drag to resize candidates, tap to close"}
      onPointerDown={(event) => {
        if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0) || gesture.current) return;
        const panel = event.currentTarget.closest<HTMLElement>(".df-candidate-panel");
        if (!panel) return;
        event.preventDefault();
        suppressClick.current = false;
        gesture.current = { pointerId: event.pointerId, startY: event.clientY, startHeight: panel.getBoundingClientRect().height, panel, previousHeight: panel.style.getPropertyValue("--mobile-candidate-height"), moved: false };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        const active = gesture.current;
        if (!active || active.pointerId !== event.pointerId) return;
        const distance = active.startY - event.clientY;
        if (Math.abs(distance) < 3 && !active.moved) return;
        active.moved = true;
        event.preventDefault();
        resize(active.panel, active.startHeight + distance);
      }}
      onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish}
      onKeyDown={(event) => {
        if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
        const panel = event.currentTarget.closest<HTMLElement>(".df-candidate-panel");
        if (!panel) return;
        event.preventDefault();
        resize(panel, panel.getBoundingClientRect().height + (event.key === "ArrowUp" ? 40 : -40));
      }}
      onClick={() => { if (!suppressClick.current) onClose(); suppressClick.current = false; }}><span /></button>
    <CloseButton className="df-mobile-candidate-close" label={lang === "zh" ? "关闭候选任务" : "Close candidates"} onClick={onClose} />
  </div>;
}
