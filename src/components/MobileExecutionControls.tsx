import React, { useEffect, useRef } from "react";
import { Button } from "./UiPrimitives";
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
  return <div className="df-mobile-execution-controls" data-placing={title !== undefined || undefined}>
    {title !== undefined ? <section className="df-mobile-placement" aria-label={zh ? "安排任务" : "Schedule task"}>
      <div aria-live="polite"><strong>{title}</strong><span>{time || (zh ? "点选时间安排" : "Tap the timeline to choose a time")}</span>
        {conflict && <span role="status">{zh ? "与已有日程重叠，仍可确认" : "Overlaps an existing event; you can still confirm"}</span>}</div>
      <div className="df-mobile-placement-actions"><Button onClick={onCancel}>{zh ? "取消" : "Cancel"}</Button>
        <Button variant="primary" disabled={!time} onClick={onConfirm}>{zh ? "确认安排" : "Confirm schedule"}</Button></div>
    </section> : <button type="button" ref={triggerRef} className="df-mobile-candidates-trigger" aria-label={zh ? `展开待安排任务（${count}）` : `Expand tasks to schedule (${count})`} title={zh ? "展开待安排任务" : "Expand tasks to schedule"} aria-haspopup="dialog" aria-expanded={false} onClick={onOpen}><UiChevronUpIcon size={20} /></button>}
  </div>;
}
