import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import type { Language } from "../types";
import { UiCalendarClockIcon } from "./UiIcons";
import { Button, CloseButton } from "./UiPrimitives";

const examples = {
  zh: ["例如：整理桌面", "例如：回复一条消息", "例如：读两页书"],
  en: ["E.g. tidy my desk", "E.g. reply to a message", "E.g. read two pages"],
};

export function useTaskExample(active: boolean, lang: Language) {
  const [example, setExample] = useState(0);
  useEffect(() => {
    if (!active) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const timer = window.setInterval(() => {
      if (!motion.matches) setExample((index) => (index + 1) % examples[lang].length);
    }, 2600);
    return () => window.clearInterval(timer);
  }, [active, lang]);
  return active ? examples[lang][example] : undefined;
}

export function OnboardingCue({ anchor, followRow, lang, onClose, children }: {
  anchor: RefObject<HTMLElement | null>;
  followRow?: boolean;
  lang: Language;
  onClose: () => void;
  children: ReactNode;
}) {
  const cueRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const cue = cueRef.current;
    if (!cue) return;
    const row = followRow ? anchor.current : null;
    const panel = anchor.current?.closest<HTMLElement>(".df-candidate-panel");
    const scroller = row?.closest<HTMLElement>(".df-candidate-list");
    if (row && scroller) {
      const bounds = row.getBoundingClientRect();
      const viewport = scroller.getBoundingClientRect();
      if (bounds.bottom > viewport.bottom) scroller.scrollTop += bounds.bottom - viewport.bottom + 8;
      else if (bounds.top < viewport.top) scroller.scrollTop += bounds.top - viewport.top - 8;
    }

    const update = () => {
      const target = anchor.current;
      const box = target?.getBoundingClientRect();
      const clip = followRow ? target?.closest(".df-candidate-list")?.getBoundingClientRect() : undefined;
      if (!box || !box.width || !box.height || box.bottom < 0 || box.top > window.innerHeight
        || (clip && (box.bottom <= clip.top || box.top >= clip.bottom))) {
        cue.style.visibility = "hidden";
        return;
      }
      const side = window.innerWidth - box.right >= 248;
      const drawerTop = panel?.classList.contains("is-mobile-candidates") ? panel.getBoundingClientRect().top : undefined;
      const topEdge = drawerTop !== undefined && drawerTop > cue.offsetHeight + 24 ? drawerTop : box.top;
      cue.dataset.side = side ? "right" : topEdge > cue.offsetHeight + 24 ? "above" : "below";
      const width = cue.offsetWidth;
      const height = cue.offsetHeight;
      const x = side ? box.right + 20 : Math.min(box.right - width, window.innerWidth - width - 10);
      const y = side ? box.top + (box.height - height) / 2
        : cue.dataset.side === "above" ? topEdge - height - 15 : box.bottom + 15;
      const left = Math.max(10, x);
      cue.style.left = `${left}px`;
      cue.style.top = `${Math.max(10, Math.min(y, window.innerHeight - height - 10))}px`;
      cue.style.setProperty("--guide-arrow-x", `${Math.max(12, Math.min(box.left + box.width / 2 - left, width - 12))}px`);
      cue.style.visibility = "visible";
    };
    const observer = new ResizeObserver(update);
    if (anchor.current) observer.observe(anchor.current);
    observer.observe(cue);
    if (panel) observer.observe(panel);
    panel?.addEventListener("transitionend", update);
    window.addEventListener("resize", update);
    document.addEventListener("scroll", update, true);
    update();
    return () => {
      observer.disconnect();
      panel?.removeEventListener("transitionend", update);
      window.removeEventListener("resize", update);
      document.removeEventListener("scroll", update, true);
    };
  }, [anchor, followRow]);
  return <div ref={cueRef} className="df-workspace-guide-cue">
    <div className="df-workspace-guide-copy" aria-live="polite">{children}</div>
    <CloseButton label={lang === "zh" ? "关闭教程提示" : "Dismiss guide"} onClick={onClose} />
  </div>;
}

export function OnboardingScheduleHint({ lang, touch, onSchedule }: {
  lang: Language;
  touch: boolean;
  onSchedule: () => void;
}) {
  const zh = lang === "zh";
  return <>
    {zh ? (touch ? "长按任务拖到时间轴，或" : "把任务拖到时间轴，或")
      : (touch ? "Long-press to drag it onto the timeline, or " : "Drag the task onto the timeline, or ")}
    <Button variant="text" className="df-workspace-guide-action" onClick={onSchedule}>
      <UiCalendarClockIcon size={14} />{zh ? "点日历安排" : "use the calendar"}
    </Button>
  </>;
}
