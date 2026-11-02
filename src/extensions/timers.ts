import type { Language, WidgetTimerPreferences, WidgetTimerRuntime, WidgetTimerTick } from "../types";

/** Installed modes are synchronous; only the main window advances their clocks. */
export interface TimerModeProvider {
  id: string;
  label: Record<Language, string>;
  description?: Record<Language, string>;
  normalizePreferences(value: Partial<WidgetTimerPreferences>): WidgetTimerPreferences;
  createRuntime(now: number, preferences: WidgetTimerPreferences): WidgetTimerRuntime;
  normalizeRuntime(value: Partial<WidgetTimerRuntime> | null | undefined, preferences: WidgetTimerPreferences, now: number): WidgetTimerRuntime;
  advance(runtime: WidgetTimerRuntime, preferences: WidgetTimerPreferences, now: number): WidgetTimerTick & WidgetTimerRuntime;
  workMilliseconds(runtime: WidgetTimerRuntime, preferences: WidgetTimerPreferences, from: number, now: number): number;
  createDeadlineRuntime?(startAt: number, endAt: number, preferences: WidgetTimerPreferences): WidgetTimerRuntime;
  notification?(transition: string, lang: Language): { title: string; body: string } | undefined;
}

const modes = new Map<string, TimerModeProvider>();
const listeners = new Set<() => void>();
const removing = new Set<(id: string) => void>();
let revision = 0;
export const getTimerMode = (id: string) => modes.get(id);
export const getTimerModeRevision = () => revision;
export const subscribeTimerModes = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const onTimerModeRemoving = (listener: (id: string) => void) => { removing.add(listener); return () => { removing.delete(listener); }; };
export function registerTimerMode(provider: TimerModeProvider): () => void {
  if (!provider?.id || ["stopwatch", "countdown"].includes(provider.id) || modes.has(provider.id)) throw new Error("Invalid or duplicate timer mode");
  for (const method of ["normalizePreferences", "createRuntime", "normalizeRuntime", "advance", "workMilliseconds"] as const) {
    if (typeof provider[method] !== "function") throw new Error(`Timer mode requires ${method}`);
  }
  modes.set(provider.id, provider); revision++; listeners.forEach((listener) => listener());
  return () => {
    if (modes.get(provider.id) !== provider) return;
    removing.forEach((listener) => listener(provider.id));
    modes.delete(provider.id); revision++; listeners.forEach((listener) => listener());
  };
}
export function getTimerModes() {
  return [
    { mode: "stopwatch", zh: "正计时", en: "Stopwatch", description: { zh: "累计实际工作时间。", en: "Counts actual work time." } },
    ...[...modes.values()].map((provider) => ({ mode: provider.id, ...provider.label, description: provider.description })),
    { mode: "countdown", zh: "倒计时", en: "Countdown", description: { zh: "倒计时至任务结束，随后记录超时。", en: "Counts down to the deadline, then records overtime." } },
  ];
}
