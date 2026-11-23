import type { PlannerData } from "./types";
import type { AiSessionMessage } from "./WorkspacePresentation";
import { DEMO_DATE, scheduleDemoTask } from "./productDemoData";
import { createProductStoryPointer } from "./productStoryPointer";

const channel = "navopath-product-demo";
const candidateSelector = '[data-placement-card="layout"]';

type StoryInput = { progress: number; active: boolean; interactive: boolean; still: boolean; narrow: boolean };
type Scene = { data: PlannerData; step: number; proposal?: AiSessionMessage; drawer: boolean };
export type ProductDemoStory = ReturnType<typeof createProductDemoStory>;

export function createProductDemoStory(
  feature: "ai" | "execute",
  initial: PlannerData,
  suggest: (data: PlannerData) => AiSessionMessage,
  setData: (data: PlannerData) => void,
  resetApp: () => void,
) {
  const proposal = feature === "ai" ? suggest(initial) : undefined;
  const booked = proposal
    ? (proposal.actions ?? []).reduce((data, action) => action.type === "schedule_task" && action.taskId && action.start
      ? scheduleDemoTask(data, action.taskId, DEMO_DATE, action.start)
      : data, initial)
    : scheduleDemoTask(initial, "layout", DEMO_DATE, "11:30");
  const revised = proposal ? booked : scheduleDemoTask(booked, "layout", DEMO_DATE, "08:30");
  const record = booked.tasks.find(task => task.id === "layout")?.timelineRecords?.[0]?.id;
  const timelineSelector = record ? `.df-time-block[data-task-id="${CSS.escape(record)}"]` : null;
  const scenes = proposal
    ? [initial, initial, initial, booked]
    : [initial, booked, revised];
  let input: StoryInput = {
    progress: 0, active: false, interactive: false, still: false,
    narrow: new URLSearchParams(location.search).get("layout") === "narrow",
  };
  document.documentElement.dataset.storyLayout = input.narrow ? "narrow" : "wide";
  const ghost = createProductStoryPointer();
  let render: ((scene: Scene) => void) | undefined;
  let step = -1;
  let currentData = initial;
  let drawerOpen = false;
  let paintFrame = 0;
  let followDrawerUntil = 0;
  let manual = false;
  let intent = false;
  let pointer: number | undefined;
  let reconcileFrame = 0;
  let previous: DOMRect | undefined;
  const anchors = new Map<number, DOMRect>();
  let flight: Animation | undefined;

  const bounds = () => {
    const node = document.querySelector<HTMLElement>(timelineSelector ? `${timelineSelector}, ${candidateSelector}` : candidateSelector);
    if (!node || node.getClientRects().length === 0) return;
    const rect = node.getBoundingClientRect();
    if (rect.bottom > 0 && rect.top < innerHeight) return rect;
  };

  function cancelFlight() {
    flight?.cancel();
    flight = undefined;
  }

  function animate() {
    if (!flight) return;
    const [from, to] = step === 1 ? [.25, .48] : [.64, .83];
    flight.currentTime = 1000 * Math.max(0, Math.min(1, (input.progress - from) / (to - from)));
  }

  function paintPointer() {
    if (!input.interactive || input.still || manual || pointer !== undefined) {
      ghost.hide();
      return;
    }
    const progress = input.progress;
    if (proposal) {
      if (progress >= .046 && progress < .245) {
        ghost.paint(".df-ai-plan-title-icon", progress, .046, .148, .245, "button", progress >= .148 && progress < .183);
      } else if (progress >= .615 && progress < .827) {
        ghost.paint(".df-ai-plan-confirm", progress, .615, .74, .827, "button", progress >= .74 && progress < .775);
      } else ghost.hide();
      return;
    }

    const selector = step === 0 ? candidateSelector : timelineSelector;
    if (selector && progress >= .065 && progress < .54) {
      const press = input.narrow ? .163 : .212;
      ghost.paint(selector, progress, .065, press, .54, "task", progress >= press && progress < .48);
    } else if (timelineSelector && progress >= .55 && progress < .905) {
      ghost.paint(timelineSelector, progress, .55, .64, .905, "task", progress >= .64 && progress < .83);
    } else ghost.hide();
  }

  function paint(followDrawer = false) {
    if (followDrawer && input.narrow && input.interactive) followDrawerUntil = performance.now() + 580;
    cancelAnimationFrame(paintFrame);
    const tick = (now: number) => {
      animate();
      paintPointer();
      if (input.interactive && !manual && pointer === undefined && now < followDrawerUntil) {
        paintFrame = requestAnimationFrame(tick);
      }
    };
    paintFrame = requestAnimationFrame(tick);
  }

  function reconcile() {
    if (!render) return;
    if (!input.active) {
      if (manual || intent) resetApp();
      ghost.hide();
      ghost.reset();
      manual = false;
      intent = false;
      pointer = undefined;
    }
    if (manual || pointer !== undefined) {
      ghost.hide();
      return;
    }
    const progress = input.active ? input.progress : 0;
    const next = proposal
      ? progress >= .76 ? 3 : progress >= .36 ? 2 : progress >= .16 ? 1 : 0
      : progress >= .64 ? 2 : progress >= .25 ? 1 : 0;
    const drawer = input.narrow && !input.still && (proposal
      ? progress < .27 || (progress >= .595 && progress < .795)
      : progress < .25);
    const drawerChanged = drawer !== drawerOpen;
    if (next === step) {
      if (drawerChanged) {
        drawerOpen = drawer;
        render({ data: currentData, step, proposal, drawer });
      }
      paint(drawerChanged);
      return;
    }
    cancelFlight();
    previous = undefined;
    if (!proposal && !input.still && Math.abs(next - step) === 1) {
      const rect = bounds();
      if (rect) anchors.set(step, rect);
      previous = next === 0 ? undefined : next > step ? rect : anchors.get(next - 1);
    }
    step = next;
    currentData = structuredClone(scenes[step]);
    setData(currentData);
    drawerOpen = drawer;
    render({ data: currentData, step, proposal, drawer });
    paint(drawerChanged);
  }

  function receive(event: MessageEvent) {
    const value = event.data;
    if (event.source !== parent || event.origin !== location.origin || value?.channel !== channel || value.type !== "story-state"
      || !Number.isFinite(value.progress) || typeof value.active !== "boolean"
      || typeof value.interactive !== "boolean" || typeof value.still !== "boolean" || typeof value.narrow !== "boolean") return;
    const layoutChanged = input.narrow !== value.narrow;
    input = { progress: Math.max(0, Math.min(1, value.progress)), active: value.active, interactive: value.interactive, still: value.still, narrow: value.narrow };
    if (layoutChanged) {
      document.documentElement.dataset.storyLayout = input.narrow ? "narrow" : "wide";
      window.dispatchEvent(new Event("navopath-story-layout"));
      ghost.reset();
    }
    reconcile();
  }

  if (parent !== window) window.addEventListener("message", receive);
  window.addEventListener("pointerdown", event => {
    if (!input.interactive) return;
    intent = true;
    pointer = event.pointerId;
    ghost.hide();
  }, true);
  const release = (event: PointerEvent) => {
    if (pointer !== event.pointerId) return;
    pointer = undefined;
    cancelAnimationFrame(reconcileFrame);
    reconcileFrame = requestAnimationFrame(reconcile);
  };
  window.addEventListener("pointerup", release, true);
  window.addEventListener("pointercancel", release, true);
  window.addEventListener("keydown", event => {
    if (input.interactive && event.target instanceof Element
      && event.target.closest('button, [role="button"], input, textarea, select, [contenteditable]')) {
      intent = true;
      ghost.hide();
    }
  }, true);
  window.addEventListener("blur", () => {
    if (pointer === undefined || document.querySelector(".df-app.is-dragging")) return;
    pointer = undefined;
    reconcile();
  });
  window.addEventListener("resize", () => {
    anchors.clear();
    previous = undefined;
    cancelFlight();
    ghost.reset();
    paint();
  });

  return {
    get narrow() { return input.narrow; },
    connect(callback: (scene: Scene) => void) {
      render = callback;
      step = -1;
      reconcile();
      return () => { render = undefined; };
    },
    save(data: PlannerData) {
      if (!intent && !input.interactive) return false;
      if (intent) manual = true;
      cancelFlight();
      ghost.hide();
      setData(data);
      return true;
    },
    painted() {
      paint();
      const start = previous;
      previous = undefined;
      if (!start || !step || manual || input.still || !timelineSelector) return;
      const node = document.querySelector<HTMLElement>(timelineSelector);
      const end = node?.getBoundingClientRect();
      if (!node || !end?.width || !end.height) return;
      const dx = start.x - end.x;
      const dy = start.y - end.y;
      if (Math.abs(dx) + Math.abs(dy) < 4) return;
      const keyframe = (rect: DOMRect) => ({
        position: "fixed", zIndex: 80, margin: "0px", right: "auto", bottom: "auto",
        left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px`,
      });
      flight = node.animate([keyframe(start), keyframe(end)], {
        duration: 1000, easing: "cubic-bezier(.26,.73,.31,1)", fill: "both",
      });
      flight.pause();
      animate();
      paintPointer();
    },
  };
}
