import React, { useEffect, useRef } from "react";
import { Button } from "./UiPrimitives";
import { UiChevronUpIcon } from "./UiIcons";
import type { Language } from "../types";
import { t } from "../i18n";

export default function MobileExecutionControls({ lang, count, title, time, noSlot, conflict, onOpen, onCancel, onConfirm, triggerRef, desktop, hidden, drawerOpen, panelRef, scrollRef, onClose }: {
  desktop?: boolean; hidden: boolean; drawerOpen: boolean; panelRef: React.RefObject<HTMLElement | null>; scrollRef: React.RefObject<number>; onClose: () => void;
  lang: Language; count: number; title?: string; time?: string; noSlot?: "today" | "selected"; conflict?: boolean;
  onOpen: () => void; onCancel: () => void; onConfirm: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const zh = lang === "zh";
  const wasOpen = useRef(false);
  const placementRef = useRef<HTMLElement>(null);
  const placing = title !== undefined;
  const manualHint = zh ? (desktop ? "点击时间轴手动选择。" : "轻点时间轴手动选择。")
    : (desktop ? "Click the timeline to pick a time." : "Tap the timeline to pick a time.");
  const placementHint = noSlot
    ? [t(lang, noSlot === "today" ? "toast.noSlotToday" : "toast.noSlotOnDate"), manualHint].join(zh ? "" : " ")
    : manualHint;
  useEffect(() => {
    if (placing && !hidden) placementRef.current?.focus({ preventScroll: true });
  }, [placing, hidden]);
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
      if (event.target instanceof Element && event.target.closest("details[open]")) return;
      if (document.querySelector(".df-shelf-view-menu, .df-project-filter-anchor [aria-expanded=true]")) return;
      if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); onClose(); }
    };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, [drawerOpen]);
  if (hidden) return null;
  return <div className="df-mobile-execution-controls" data-placing={placing || undefined} data-desktop={desktop || undefined}>
    {placing ? <section ref={placementRef} tabIndex={-1} className="df-mobile-placement" aria-label={zh ? "安排任务" : "Schedule task"}>
      <div aria-live="polite"><strong>{title}</strong><span>{time || placementHint}</span>
        {conflict && <span role="status">{zh ? "与已有日程重叠，仍可确认" : "Overlaps an existing event; you can still confirm"}</span>}</div>
      <div className="df-mobile-placement-actions"><Button onClick={onCancel}>{zh ? "取消" : "Cancel"}</Button>
        <Button variant="primary" disabled={!time} onClick={onConfirm}>{zh ? "确认安排" : "Confirm schedule"}</Button></div>
    </section> : <button type="button" ref={triggerRef} className="df-mobile-candidates-trigger" aria-label={zh ? `展开待安排任务（${count}）` : `Expand tasks to schedule (${count})`} title={zh ? "展开待安排任务" : "Expand tasks to schedule"} aria-haspopup="dialog" aria-expanded={false} onClick={onOpen}><UiChevronUpIcon size={20} /></button>}
  </div>;
}
