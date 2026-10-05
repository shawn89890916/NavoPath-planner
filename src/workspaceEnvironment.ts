import type { Language, PlannerData } from "./types";
import type { AiSessionMessage } from "./WorkspacePresentation";
import type { ProductFeature } from "./productSite";
import type { ReactNode } from "react";

export type WorkspaceDemoRuntime = {
  feature: ProductFeature;
  story?: ReactNode;
  navigation?: (icon: ReactNode) => ReactNode;
  date: string;
  language: Language;
  storage: Storage;
  now: () => Date;
  suggest: (data: PlannerData, request?: { taskId: string; days: 1 | 2 }, taskIds?: string[]) => AiSessionMessage;
  ready: () => void;
  revealSchedule?: () => Promise<void>;
};
type DemoWindow = Window & { navopathDemoRuntime?: WorkspaceDemoRuntime };
export function getWorkspaceDemoRuntime() {
  return typeof window !== "undefined" && window.location.pathname.startsWith("/product-demo/")
    ? (window as DemoWindow).navopathDemoRuntime
    : undefined;
}
export function getWorkspaceStorage() {
  return getWorkspaceDemoRuntime()?.storage ?? window.localStorage;
}
export function workspaceNow() {
  return getWorkspaceDemoRuntime()?.now() ?? new Date();
}
export function createMemoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    key: (index) => Array.from(values.keys())[index] ?? null,
    getItem: (key) => values.get(String(key)) ?? null,
    setItem: (key, value) => { values.set(String(key), String(value)); },
    removeItem: (key) => { values.delete(String(key)); },
    clear: () => values.clear(),
  };
}

export function installWorkspaceDemoRuntime(runtime: WorkspaceDemoRuntime) {
  (window as DemoWindow).navopathDemoRuntime = runtime;
}
