import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import type { Language } from "../types";
import type { OnboardingTourStep } from "../onboarding";
import { Button, CloseButton } from "./UiPrimitives";

const examples = {
  zh: ["整理桌面", "回复一条消息", "读两页书"],
  en: ["Tidy my desk", "Reply to a message", "Read two pages"],
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
    let blinks = 0;

    function tick() {
      if (!field || field.value) return;
      const text = examples[lang][example];
      field.dataset.taskExampleValue = text;
      if (!deleting && length === text.length && blinks < 6) {
        field.placeholder = text + (blinks % 2 === 0 ? "▏" : "");
        timer = window.setTimeout(tick, blinks++ === 0 ? 1000 : 135);
        return;
      }
      if (length === text.length) deleting = true;
      field.placeholder = text.slice(0, length) + "▏";
      const progress = length / text.length;
      let delay = deleting ? 20 + 26 * progress ** 2 : 39 + 45 * (2 * progress - 1) ** 2;
      if (deleting && length === 0) {
        example = (example + 1) % examples[lang].length;
        length = 0;
        deleting = false;
        blinks = 0;
        delay = 38;
      }
      length += deleting ? -1 : 1;
      timer = window.setTimeout(tick, delay);
    }

    function restart() {
      if (!field) return;
      window.clearTimeout(timer);
      if (field.value) {
        delete field.dataset.taskExample;
        delete field.dataset.taskExampleValue;
        field.placeholder = placeholder;
        return;
      }
      const text = examples[lang][example];
      field.dataset.taskExample = motion.matches ? "static" : "typing";
      field.dataset.taskExampleValue = text;
      if (motion.matches) {
        field.placeholder = text;
        return;
      }
      length = text.length;
      deleting = false;
      blinks = 0;
      tick();
    }

    field.addEventListener("input", restart);
    motion.addEventListener("change", restart);
    restart();
    const focusFrame = window.requestAnimationFrame(() => {
      if (field.getClientRects().length && !document.activeElement?.matches("input, textarea, select, [contenteditable=true]")) {
        field.focus({ preventScroll: true });
      }
    });
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.clearTimeout(timer);
      delete field.dataset.taskExampleValue;
      motion.removeEventListener("change", restart);
      field.removeEventListener("input", restart);
      delete field.dataset.taskExample;
      field.placeholder = placeholder;
      if (fieldRef) fieldRef.current = null;
    };
  }, [active, fieldRef, lang]);
}

export function OnboardingCue({ anchor, targetSelector, followRow, followTimeline, lang, onClose, children }: {
  anchor?: RefObject<HTMLElement | null>;
  targetSelector?: string;
  followRow?: boolean;
  followTimeline?: boolean;
  lang: Language;
  onClose?: () => void;
  children: ReactNode;
}) {
  const cueRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const cue = cueRef.current;
    if (!cue || !anchor) return;
    const scope = targetSelector ? anchor.current : null;
    const findTarget = () => targetSelector ? scope?.querySelector<HTMLElement>(targetSelector) : anchor.current;
    const settingsHeader = scope?.closest(".df-utility-panel")?.querySelector(".df-utility-head");
    let panel: HTMLElement | null | undefined;
    const revealRow = () => {
      const target = followRow ? anchor.current : null;
      const row = target?.closest<HTMLElement>(".df-candidate-task-row") ?? target;
      const scroller = row?.closest<HTMLElement>(".df-candidate-list");
      if (!row || !scroller) return;
      const bounds = row.getBoundingClientRect();
      const viewport = scroller.getBoundingClientRect();
      if (bounds.bottom > viewport.bottom) scroller.scrollTop += bounds.bottom - viewport.bottom + 8;
      else if (bounds.top < viewport.top) scroller.scrollTop += bounds.top - viewport.top - 8;
    };

    const update = () => {
      const target = findTarget();
      const box = target?.getBoundingClientRect();
      const clip = scope?.getBoundingClientRect()
        ?? target?.closest(followTimeline ? ".df-timeline-scroll" : ".df-candidate-list")?.getBoundingClientRect();
      const visibleTop = box ? Math.max(0, box.top, clip?.top ?? 0) : 0;
      const visibleBottom = box ? Math.min(window.innerHeight, box.bottom, clip?.bottom ?? window.innerHeight) : 0;
      const centered = !box || !box.width || visibleBottom <= visibleTop || box.right <= 0 || box.left >= window.innerWidth;
      if (centered) {
        if (followTimeline) {
          cue.dataset.centered = "true";
          delete cue.dataset.side;
          cue.style.removeProperty("left");
          cue.style.removeProperty("top");
        }
        cue.style.visibility = followTimeline ? "visible" : "hidden";
        return;
      }
      delete cue.dataset.centered;
      const width = cue.offsetWidth;
      const height = cue.offsetHeight;
      const minTop = scope ? Math.max(10, (settingsHeader?.getBoundingClientRect().bottom ?? clip?.top ?? 6) + 4) : 10;
      const maxBottom = scope && clip ? Math.min(window.innerHeight - 10, clip.bottom - 4) : window.innerHeight - 10;
      const drawerTop = panel?.classList.contains("is-mobile-candidates") ? panel.getBoundingClientRect().top : undefined;
      const topEdge = drawerTop !== undefined && drawerTop > height + 24 ? drawerTop : visibleTop;
      const canPlaceAbove = topEdge - minTop >= height + 15;
      const canPlaceBelow = maxBottom - visibleBottom >= height + 15;
      const side = window.innerWidth >= 540 && !scope && window.innerWidth - box.right >= 248 ? "right"
        : scope && clip && window.innerWidth >= 540 && box.left - clip.left >= width + 20 ? "left"
        : canPlaceAbove || (scope && !canPlaceBelow && topEdge - minTop > maxBottom - visibleBottom) ? "above" : "below";
      cue.dataset.side = side;
      const x = side === "right" ? box.right + 20 : side === "left" ? box.left - width - 20
        : Math.min(box.left + (box.width - width) / 2, window.innerWidth - width - 10);
      const midY = (visibleTop + visibleBottom) / 2;
      const y = side === "right" || side === "left" ? midY - height / 2
        : side === "above" ? topEdge - height - 15 : visibleBottom + 15;
      const left = Math.max(10, x);
      const top = Math.max(minTop, Math.min(y, maxBottom - height));
      cue.style.left = `${left}px`;
      cue.style.top = `${top}px`;
      cue.style.setProperty("--guide-arrow-y", `${Math.max(10, Math.min(midY - top, height - 10))}px`);
      cue.style.setProperty("--guide-arrow-x", `${Math.max(12, Math.min(box.left + box.width / 2 - left, width - 12))}px`);
      cue.style.visibility = "visible";
    };
    const observer = new ResizeObserver(update);
    observer.observe(cue);
    let observedTarget: HTMLElement | null | undefined;
    const observeTarget = () => {
      const target = findTarget();
      if (observedTarget === target) return;
      if (observedTarget) observer.unobserve(observedTarget);
      if (target) observer.observe(target);
      observedTarget = target;
      update();
    };
    const lazyContent = scope ? new MutationObserver(observeTarget) : null;
    if (scope) {
      observer.observe(scope);
      lazyContent?.observe(scope, { childList: true, subtree: true });
    }
    let openingDrawer = false;
    const afterDrawerTransition = (event: TransitionEvent) => {
      if (event.target !== panel) return;
      if (openingDrawer && event.propertyName === "transform") {
        openingDrawer = false;
        revealRow();
      }
      update();
    };
    revealRow();
    const afterInitialScroll = window.requestAnimationFrame(() => {
      observeTarget();
      const target = findTarget();
      const timeline = followTimeline ? target?.closest(".df-timeline-scroll") : null;
      if (timeline) observer.observe(timeline);
      panel = target?.closest<HTMLElement>(".df-candidate-panel");
      if (panel) {
        openingDrawer = Boolean(followRow && panel.classList.contains("is-mobile-candidates"));
        observer.observe(panel);
        panel.addEventListener("transitionend", afterDrawerTransition);
      }
      revealRow();
      update();
    });
    window.addEventListener("resize", update);
    document.addEventListener("scroll", update, true);
    update();
    return () => {
      lazyContent?.disconnect();
      observer.disconnect();
      cue.style.removeProperty("left");
      cue.style.removeProperty("top");
      cue.style.removeProperty("visibility");
      cue.style.removeProperty("--guide-arrow-x");
      cue.style.removeProperty("--guide-arrow-y");
      delete cue.dataset.centered;
      delete cue.dataset.side;
      window.cancelAnimationFrame(afterInitialScroll);
      panel?.removeEventListener("transitionend", afterDrawerTransition);
      window.removeEventListener("resize", update);
      document.removeEventListener("scroll", update, true);
    };
  }, [anchor, targetSelector, followRow, followTimeline]);
  return <div ref={cueRef} className="df-workspace-guide-cue" data-centered={!anchor || undefined}>
    <div className="df-workspace-guide-copy" aria-live="polite">{children}</div>
    {onClose && <CloseButton label={lang === "zh" ? "关闭教程提示" : "Dismiss guide"} onClick={onClose} />}
  </div>;
}

export function OnboardingTour({ step, anchor, waitingForTasks, phone, lang, onNext, onSettings, onClose }: {
  step: OnboardingTourStep;
  anchor?: RefObject<HTMLElement | null>;
  waitingForTasks: boolean;
  phone: boolean;
  lang: Language;
  onNext: () => void;
  onSettings: (topic: OnboardingSettingsTopic) => void;
  onClose: () => void;
}) {
  const zh = lang === "zh";
  const instructions: Record<OnboardingTourStep, string> = {
    return: zh ? (phone ? "长按刚安排的时间块，拖到左下角的任务按钮上，即可取消安排。" : "把刚安排的时间块拖回任务列表，即可取消安排。")
      : (phone ? "Press and hold the time block, then drag it onto the Tasks button to unschedule it." : "Drag the time block back to Tasks to unschedule it."),
    plan: zh ? (phone ? "你也可以点「安排」按钮来选时间。" : "你也可以点任务旁的日历按钮来选时间。")
      : (phone ? "You can also tap Plan to pick a time." : "You can also use the task’s calendar button to pick a time."),
    views: zh ? "在这里切换视图，用不同方式查看你的任务。" : "Switch views here to see your tasks in different ways.",
    plugins: zh ? "在「设置 → 插件」里可以添加更多任务视图。" : "Add more task views in Settings → Plugins.",
    integrations: zh ? "在设置里配置你的 AI，或连接 MCP。" : "Set up your AI or connect MCP in Settings.",
    start: zh ? "开始规划你的一天吧！" : "Start planning your day!",
  };
  const nextLabel = waitingForTasks ? (zh ? "打开任务" : "Open Tasks")
    : step === "return" ? (zh ? "跳过" : "Skip")
    : step === "views" ? (zh ? "查看视图" : "View options")
    : step === "plugins" || step === "integrations" ? (zh ? "稍后" : "Later")
    : step === "start" ? (zh ? "开始规划" : "Start planning")
    : (zh ? "下一步" : "Next");

  return <OnboardingCue anchor={anchor} followRow={step === "plan" && !waitingForTasks} followTimeline={step === "return"} lang={lang} onClose={onClose}>
    {(!waitingForTasks || step === "return") && <div>{instructions[step]}</div>}
    <div className="df-workspace-guide-actions">
      {step === "plugins" && !waitingForTasks && <Button variant="text" className="df-workspace-guide-action" onClick={() => onSettings("plugins")}>{zh ? "现在配置" : "Set up now"}</Button>}
      {step === "integrations" && <>
        <Button variant="text" className="df-workspace-guide-action" onClick={() => onSettings("ai")}>{zh ? "配置 AI" : "Set up AI"}</Button>
        <Button variant="text" className="df-workspace-guide-action" onClick={() => onSettings("mcp")}>{zh ? "连接 MCP" : "Connect MCP"}</Button>
      </>}
      <Button variant="text" className="df-workspace-guide-action" onClick={onNext}>{nextLabel}</Button>
    </div>
  </OnboardingCue>;
}

export type OnboardingSettingsTopic = "plugins" | "ai" | "mcp";

const settingsGuideTargets: Record<OnboardingSettingsTopic, string> = {
  plugins: '[data-settings-anchor="plugin-market"] button',
  ai: '[data-settings-anchor="ai-provider"] select',
  mcp: ".df-mcp-create-row input, .df-mcp-settings:not(:has(.df-mcp-create-row)) .df-mcp-guide-link",
};

export function OnboardingSettingsHint({ topic, contentRef, lang, onContinue }: {
  topic: OnboardingSettingsTopic;
  contentRef: RefObject<HTMLElement | null>;
  lang: Language;
  onContinue: () => void;
}) {
  const zh = lang === "zh";
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    const content = contentRef.current;
    if (dismissed || !content) return;
    const dismissOnInteraction = (event: Event) => {
      if (event.target instanceof Element && event.target.closest("button, a, input, select, textarea, summary")) {
        setDismissed(true);
      }
    };
    content.addEventListener("click", dismissOnInteraction);
    content.addEventListener("input", dismissOnInteraction);
    return () => {
      content.removeEventListener("click", dismissOnInteraction);
      content.removeEventListener("input", dismissOnInteraction);
    };
  }, [contentRef, dismissed]);
  const instructions: Record<OnboardingSettingsTopic, string> = {
    plugins: zh ? "在市场里选择要添加的任务视图。" : "Browse the market for task views.",
    ai: zh ? "选择提供商，再填写 API 密钥。" : "Choose a provider and enter your API key.",
    mcp: zh ? "创建令牌，再按此页的连接方式把 NavoPath 添加到 MCP 客户端。"
      : "Create a token and follow this page’s steps to add NavoPath to your MCP client.",
  };
  if (dismissed) return null;
  return <OnboardingCue anchor={contentRef} targetSelector={settingsGuideTargets[topic]} lang={lang} onClose={() => setDismissed(true)}>
    <div>{instructions[topic]}</div>
    <div className="df-workspace-guide-actions">
      <Button variant="text" className="df-workspace-guide-action" onClick={onContinue}>{zh ? "继续引导" : "Continue guide"}</Button>
    </div>
  </OnboardingCue>;
}
