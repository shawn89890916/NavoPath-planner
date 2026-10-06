import { addDays } from "./timelineGeometry";
import type { AiAction } from "./aiAssistantApi";
import type { PlannerApi, PlannerData, Settings } from "./types";
import { getDefaultSettings } from "./defaultSettings";
import { createDemoData, DEMO_DATE, DEMO_STAMP, firstDemoSlot, scheduleDemoTask } from "./productDemoData";
import { siteLanguage, type ProductFeature } from "./productSite";
import { createMemoryStorage, installWorkspaceDemoRuntime } from "./workspaceEnvironment";
import "./product-demo.css";
import { createElement } from "react";
import { ProductStorySlot } from "./ProductStory";
import ProductNavigation from "./ProductNavigation";

export function installProductDemo(feature: ProductFeature) {
  if (!location.pathname.startsWith("/product-demo/")) throw new Error("Example runtime requires an example route");
  const language = siteLanguage(location.search, navigator.language);
  const fullscreen = new URLSearchParams(location.search).get("presentation") === "full";
  let data = createDemoData(language, feature, feature === "execute" ? 2 : 1);
  let settings: Settings = { ...getDefaultSettings(), language, theme: "light", activeMode: feature === "planning" ? "planning" : "execute", continuousCrossDayScroll: false, dayStartTime: "08:00", dayEndTime: "18:00", featureHabitsEnabled: false, featureMetricsEnabled: false, featureKanbanViewEnabled: true, featureQuadrantViewEnabled: true, featureListViewEnabled: true, syncIntervalMinutes: 0 };
  const clone = <T,>(value: T): T => structuredClone(value);
  const auth = { mode: "local" as const, user: null, configured: false };
  const api: PlannerApi = {
    getAuthState: async () => auth,
    getBootstrap: async () => ({ auth, data: clone(data), settings: clone(settings) }),
    getData: async () => clone(data),
    saveData: async (next) => { data = clone(next); return clone(data); },
    getSettings: async () => clone(settings),
    saveSettings: async (patch) => { settings = { ...settings, ...patch }; return clone(settings); },
    applyActions: async () => ({ data: clone(data), applied: [] }),
    resetSeed: async () => { data = createDemoData(language, feature, feature === "execute" ? 2 : 1); return clone(data); },
    selectBackgroundImage: async () => ({ path: "" }),
  };
  const storage = createMemoryStorage();
  // Limit every native component and dependency to this iframe's memory store.
  Object.defineProperty(window, "localStorage", { configurable: true, value: storage });
  Object.defineProperty(window, "sessionStorage", { configurable: true, value: storage });
  window.plannerApi = api;
  let id = 0;
  installWorkspaceDemoRuntime({
    feature, date: DEMO_DATE, language, storage,
    story: fullscreen && feature !== "ai" ? createElement(ProductStorySlot, { feature }) : undefined,
    navigation: fullscreen ? icon => createElement(ProductNavigation, { feature, lang: language, icon }) : undefined,
    revealSchedule: fullscreen && feature === "ai" ? async () => {
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const animations = document.getAnimations().filter(animation => animation instanceof CSSAnimation && animation.animationName === "df-product-schedule-arrival");
      animations.forEach(animation => { animation.id = "product-schedule-arrival"; });
      const reduced = matchMedia("(prefers-reduced-motion: reduce)");
      const finish = () => { if (reduced.matches) animations.forEach(animation => animation.finish()); };
      reduced.addEventListener("change", finish);
      try { await Promise.all(animations.map(animation => animation.finished.catch(() => undefined))); }
      finally { reduced.removeEventListener("change", finish); }
    } : undefined,
    now: () => new Date(`${DEMO_DATE}T09:00:00`),
    ready: () => { if (parent !== window) parent.postMessage({ channel: "navopath-product-demo", type: "ready" }, location.origin); },
    suggest: (state: PlannerData, request?: { taskId: string; days: 1 | 2 }, taskIds?: string[]) => {
      let working = state;
      const reschedule = request;
      const date = reschedule ? addDays(DEMO_DATE, reschedule.days) : DEMO_DATE;
      const tasks = reschedule ? state.tasks.filter(task => task.id === reschedule.taskId && !task.completed) : state.tasks.filter(task => (!taskIds || taskIds.includes(task.id)) && !task.completed && !task.timelineRecords?.some(record => record.executionStatus === "scheduled") && !task.scheduledStart && task.plannedForDate === DEMO_DATE).slice(0, feature === "ai" ? 6 : 3);
      const actions: Extract<AiAction, { type: "schedule_task" }>[] = tasks.flatMap(task => {
        const preferred: Record<string, string> = { content: "09:00", lesson: "11:00", lunch: "12:00", layout: "14:00", notebook: "15:30", walk: "16:30" };
        const preferredStart = !reschedule && feature === "ai" ? preferred[task.id] : undefined;
        const placed = preferredStart ? scheduleDemoTask(working, task.id, date, preferredStart) : working;
        const start = placed !== working ? preferredStart! : firstDemoSlot(working, task.id, date);
        if (!start) return [];
        working = placed !== working ? placed : scheduleDemoTask(working, task.id, date, start);
        const scheduled = working.tasks.find(item => item.id === task.id)!;
        return [{ type: "schedule_task" as const, taskId: task.id, title: task.title, date, start, end: scheduled.scheduledEnd!, durationMinutes: Math.round((task.estimatedHours || .5) * 60), projectId: task.projectId }];
      });
      return { id: `demo-suggestion-${++id}`, role: "assistant", content: reschedule ? (language === "zh" ? `已将「${tasks[0]?.title || "任务"}」改到${reschedule.days === 1 ? "明天" : "后天"} ${actions[0]?.start || ""}。` : `Moved ${tasks[0]?.title || "the task"} to ${reschedule.days === 1 ? "tomorrow" : "the day after tomorrow"} at ${actions[0]?.start || ""}.`) : feature === "ai" ? (language === "zh" ? `已安排 ${actions.length} 项待办：上午写作与学习，中午午餐与休息，下午完善网站、整理课程笔记，傍晚运动。` : `Your ${actions.length} tasks are spread across the day, including lunch and an afternoon notes session.`) : (language === "zh" ? "给这些事留出时间。" : "Make room for these tasks."), createdAt: DEMO_STAMP, status: "done", actionState: "pending", actions };
    },
  });
  document.documentElement.classList.add("product-demo-document");
  if (fullscreen) document.documentElement.classList.add("product-demo-fullscreen");
  window.addEventListener("message", (event) => {
    if (event.source !== parent || event.origin !== location.origin || event.data?.channel !== "navopath-product-demo") return;
    if (event.data.type === "visibility") {
      document.documentElement.classList.toggle("product-demo-paused", event.data.visible === false);
      document.getAnimations().filter(animation => animation.id === "product-schedule-arrival")
        .forEach(animation => event.data.visible === false ? animation.pause() : animation.play());
    }
  });
}
