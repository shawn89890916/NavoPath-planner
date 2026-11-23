import type { PlannerData } from "./types";
import type { AiSessionMessage } from "./WorkspacePresentation";
import { DEMO_DATE, scheduleDemoTask } from "./productDemoData";

const channel = "navopath-product-demo";
const candidateSelector = '[data-placement-card="layout"]';

type StoryInput = { progress: number; active: boolean; interactive: boolean; still: boolean };
type Scene = { data: PlannerData; step: number; proposal?: AiSessionMessage; jump: boolean };
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
  let input: StoryInput = { progress: 0, active: false, interactive: false, still: false };
  let render: ((scene: Scene) => void) | undefined;
  let step = -1;
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

  function reconcile() {
    if (!render) return;
    if (!input.active) {
      if (manual || intent) resetApp();
      manual = false;
      intent = false;
      pointer = undefined;
    }
    if (manual || pointer !== undefined) return;
    const progress = input.active ? input.progress : 0;
    const next = proposal
      ? progress >= .76 ? 3 : progress >= .36 ? 2 : progress >= .16 ? 1 : 0
      : progress >= .64 ? 2 : progress >= .25 ? 1 : 0;
    if (next === step) {
      animate();
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
    const data = structuredClone(scenes[step]);
    setData(data);
    render({ data, step, proposal, jump: input.still });
  }

  function receive(event: MessageEvent) {
    const value = event.data;
    if (event.source !== parent || event.origin !== location.origin || value?.channel !== channel || value.type !== "story-state"
      || !Number.isFinite(value.progress) || typeof value.active !== "boolean"
      || typeof value.interactive !== "boolean" || typeof value.still !== "boolean") return;
    input = { progress: Math.max(0, Math.min(1, value.progress)), active: value.active, interactive: value.interactive, still: value.still };
    reconcile();
  }

  if (parent !== window) window.addEventListener("message", receive);
  window.addEventListener("pointerdown", event => {
    if (!input.interactive) return;
    intent = true;
    pointer = event.pointerId;
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
      && event.target.closest('button, [role="button"], input, textarea, select, [contenteditable]')) intent = true;
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
  });

  return {
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
      setData(data);
      return true;
    },
    painted() {
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
    },
  };
}
