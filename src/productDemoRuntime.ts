import type { AiAction } from "./aiAssistantApi";
import type { PlannerApi, PlannerData, Settings } from "./types";
import { getDefaultSettings } from "./defaultSettings";
import { createDemoData, DEMO_DATE, DEMO_STAMP, firstDemoSlot, scheduleDemoTask } from "./productDemoData";
import { siteLanguage, type ProductFeature } from "./productSite";
import { createMemoryStorage, installWorkspaceDemoRuntime } from "./workspaceEnvironment";
import "./product-demo.css";

export function installProductDemo(feature: ProductFeature) {
  if (!location.pathname.startsWith("/product-demo/")) throw new Error("Example runtime requires an example route");
  const language = siteLanguage(location.search, navigator.language);
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
    now: () => new Date(`${DEMO_DATE}T09:00:00`),
    ready: () => { if (parent !== window) parent.postMessage({ channel: "navopath-product-demo", type: "ready" }, location.origin); },
    suggest: (state: PlannerData, request?: "adjust", taskIds?: string[]) => {
      let working = state;
      const tasks = request === "adjust" ? state.tasks.filter(task => task.id === "content") : state.tasks.filter(task => (!taskIds || taskIds.includes(task.id)) && !task.completed && !task.timelineRecords?.some(record => record.executionStatus === "scheduled") && !task.scheduledStart && task.plannedForDate === DEMO_DATE).slice(0, 3);
      const actions: AiAction[] = tasks.flatMap(task => {
        const start = request === "adjust" ? "14:00" : firstDemoSlot(working, task.id);
        if (!start) return [];
        working = scheduleDemoTask(working, task.id, DEMO_DATE, start);
        const scheduled = working.tasks.find(item => item.id === task.id)!;
        return [{ type: "schedule_task" as const, taskId: task.id, title: task.title, date: DEMO_DATE, start, end: scheduled.scheduledEnd!, durationMinutes: Math.round((task.estimatedHours || .5) * 60), projectId: task.projectId }];
      });
      return { id: `demo-suggestion-${++id}`, role: "assistant", content: language === "zh" ? "给这些事留出时间。" : "Make room for these tasks.", createdAt: DEMO_STAMP, status: "done", actionState: "pending", actions };
    },
  });
  document.documentElement.classList.add("product-demo-document");
  window.addEventListener("message", (event) => {
    if (event.source !== parent || event.origin !== location.origin || event.data?.channel !== "navopath-product-demo") return;
    if (event.data.type === "visibility") document.documentElement.classList.toggle("product-demo-paused", event.data.visible === false);
  });
}
