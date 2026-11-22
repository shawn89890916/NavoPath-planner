import { useCallback, useLayoutEffect, useRef, type ReactNode, type RefObject } from "react";
import type { Language } from "../types";
import { CloseButton } from "./UiPrimitives";

const examples = {
  zh: ["例如：整理桌面", "例如：回复一条消息", "例如：读两页书"],
  en: ["E.g. tidy my desk", "E.g. reply to a message", "E.g. read two pages"],
};

export function useTaskExample(active: boolean, lang: Language, fieldRef?: RefObject<HTMLInputElement | null>) {
  return useCallback((field: HTMLInputElement | null) => {
    if (fieldRef) fieldRef.current = field;
    if (!field || !active) return;
    const placeholder = field.placeholder;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let timer: number | undefined;
    let example = 0;
    let length = 0;
    let deleting = false;

    function tick() {
      if (!field || field.value) return;
      const text = examples[lang][example];
      field.placeholder = text.slice(0, length) + "▏";
      let delay = deleting ? 38 : 72;
      if (!deleting && length === text.length) {
        deleting = true;
        delay = 1050;
      } else if (deleting && length === 0) {
        deleting = false;
        example = (example + 1) % examples[lang].length;
        delay = 270;
      }
      length += deleting ? -1 : 1;
      timer = window.setTimeout(tick, delay);
    }

    function restart() {
      if (!field) return;
      window.clearTimeout(timer);
      if (field.value) {
        delete field.dataset.taskExample;
        field.placeholder = placeholder;
        return;
      }
      field.dataset.taskExample = motion.matches ? "static" : "typing";
      if (motion.matches) {
        field.placeholder = examples[lang][0];
        return;
      }
      length = 0;
      deleting = false;
      tick();
    }

    field.addEventListener("input", restart);
    motion.addEventListener("change", restart);
    restart();
    return () => {
      window.clearTimeout(timer);
      motion.removeEventListener("change", restart);
      field.removeEventListener("input", restart);
      delete field.dataset.taskExample;
      field.placeholder = placeholder;
      if (fieldRef) fieldRef.current = null;
    };
  }, [active, fieldRef, lang]);
}

export function OnboardingCue({ anchor, followRow, outlined, lang, onClose, children }: {
  anchor: RefObject<HTMLElement | null>;
  followRow?: boolean;
  outlined?: boolean;
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
    const revealRow = () => {
      if (!row || !scroller) return;
      const bounds = row.getBoundingClientRect();
      const viewport = scroller.getBoundingClientRect();
      if (bounds.bottom > viewport.bottom) scroller.scrollTop += bounds.bottom - viewport.bottom + 8;
      else if (bounds.top < viewport.top) scroller.scrollTop += bounds.top - viewport.top - 8;
    };

    const update = () => {
      const target = anchor.current;
      const box = target?.getBoundingClientRect();
      const clip = followRow ? target?.closest(".df-candidate-list")?.getBoundingClientRect() : undefined;
      if (!box || !box.width || !box.height || box.bottom < 0 || box.top > window.innerHeight
        || (clip && (box.bottom <= clip.top || box.top >= clip.bottom))) {
        cue.style.visibility = "hidden";
        return;
      }
      const side = window.innerWidth >= 540 && window.innerWidth - box.right >= 248;
      const drawerTop = panel?.classList.contains("is-mobile-candidates") ? panel.getBoundingClientRect().top : undefined;
      const topEdge = drawerTop !== undefined && drawerTop > cue.offsetHeight + 24 ? drawerTop : box.top;
      cue.dataset.side = side ? "right" : topEdge > cue.offsetHeight + 24 ? "above" : "below";
      const width = cue.offsetWidth;
      const height = cue.offsetHeight;
      const x = side ? box.right + 20 : Math.min(box.left + (box.width - width) / 2, window.innerWidth - width - 10);
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
    let openingDrawer = Boolean(row && panel?.classList.contains("is-mobile-candidates"));
    const afterDrawerTransition = (event: TransitionEvent) => {
      if (event.target !== panel) return;
      if (openingDrawer && event.propertyName === "transform") {
        openingDrawer = false;
        revealRow();
      }
      update();
    };
    panel?.addEventListener("transitionend", afterDrawerTransition);
    revealRow();
    const afterInitialScroll = window.requestAnimationFrame(() => { revealRow(); update(); });
    window.addEventListener("resize", update);
    document.addEventListener("scroll", update, true);
    update();
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(afterInitialScroll);
      panel?.removeEventListener("transitionend", afterDrawerTransition);
      window.removeEventListener("resize", update);
      document.removeEventListener("scroll", update, true);
    };
  }, [anchor, followRow]);
  return <div ref={cueRef} className="df-workspace-guide-cue" data-outlined={outlined || undefined}>
    <div className="df-workspace-guide-copy" aria-live="polite">{children}</div>
    <CloseButton label={lang === "zh" ? "关闭教程提示" : "Dismiss guide"} onClick={onClose} />
  </div>;
}
