import type { Language, WidgetTimerPreferences, WidgetTimerRuntime, WidgetTimerTick } from "./models";

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
