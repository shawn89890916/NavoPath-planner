import type {
  Language,
  Task,
  TimelineRecord,
  WidgetTimerMode,
  WidgetTimerPhase,
  WidgetTimerPreferences,
  WidgetTimerRuntime,
  WidgetTimerTick,
} from "../types";
import { getTimerMode, getTimerModes } from "../extensions/timers";

type WidgetTimerTransition = WidgetTimerTick["transitions"][number];

export interface WidgetTimerNotificationDescriptor {
  title: string;
  body: string;
}

export function advanceTaskElapsedSeconds(baseSeconds: number, startedAt: number, now: number): number {
  return Math.max(0, Math.floor(baseSeconds + Math.max(0, now - startedAt) / 1_000));
}

export type StoredTaskTimer = {
  taskId: string;
  elapsedSeconds: number;
};

export function normalizeStoredTaskTimer(value: unknown): StoredTaskTimer | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const stored = value as Record<string, unknown>;
  if (typeof stored.taskId !== "string" || !stored.taskId.trim()) return null;
  const roundedElapsed = typeof stored.elapsed === "number" ? Math.floor(stored.elapsed) : -1;
  const elapsedSeconds = Number.isSafeInteger(roundedElapsed) && roundedElapsed >= 0 ? roundedElapsed : 0;
  return { taskId: stored.taskId, elapsedSeconds };
}

export type StopwatchTaskTimerAction = {
  type: "start" | "resume" | "pause";
  elapsedSeconds: number;
};

export function getStopwatchTaskTimerAction(
  taskId: string | null,
  elapsedBaseSeconds: number,
  startedAt: number | null,
  now: number,
): StopwatchTaskTimerAction {
  if (!taskId) return { type: "start", elapsedSeconds: 0 };
  if (startedAt === null) return { type: "resume", elapsedSeconds: Math.max(0, Math.floor(elapsedBaseSeconds)) };
  return {
    type: "pause",
    elapsedSeconds: advanceTaskElapsedSeconds(elapsedBaseSeconds, startedAt, now),
  };
}

export function getWidgetTimerModeChangeTaskAction(
  currentMode: WidgetTimerMode,
  taskId: string | null,
  elapsedBaseSeconds: number,
  startedAt: number | null,
  now: number,
): StopwatchTaskTimerAction | null {
  if (currentMode !== "stopwatch" || startedAt === null) return null;
  return getStopwatchTaskTimerAction(taskId, elapsedBaseSeconds, startedAt, now);
}

export function normalizeWidgetTimerMode(value: unknown, fallback: WidgetTimerMode): WidgetTimerMode {
  return typeof value === "string" && getTimerModes().some((item) => item.mode === value) ? value : getTimerModes().some((item) => item.mode === fallback) ? fallback : "stopwatch";
}

export function getWidgetTimerSnapshotDisplaySeconds(
  mode: WidgetTimerMode,
  widgetDisplaySeconds: number,
  taskElapsedBase: number,
  taskRunning: boolean,
  taskStartedAt: number | null,
  now: number,
): number {
  if (mode !== "stopwatch") return widgetDisplaySeconds;
  return taskRunning && taskStartedAt !== null
    ? advanceTaskElapsedSeconds(taskElapsedBase, taskStartedAt, now)
    : Math.max(0, Math.floor(taskElapsedBase));
}

export function countsWidgetTimerPhaseAsWork(phase: WidgetTimerPhase, mode?: string): boolean {
  if (mode && getTimerMode(mode)) return false; // Provider tick carries authoritative countsAsWork.
  return phase === "stopwatch" || phase === "countdown" || phase === "overrun";
}

export function getWidgetTimerNotificationDescriptor(transition: string, lang: Language): WidgetTimerNotificationDescriptor {
  for (const item of getTimerModes()) {
    const descriptor = getTimerMode(item.mode)?.notification?.(transition, lang);
    if (descriptor) return descriptor;
  }
  return lang === "zh" ? { title: "倒计时结束", body: "已开始超时计时。" } : { title: "Countdown complete", body: "Overrun timing has started." };
}

export const DEFAULT_WIDGET_TIMER_PREFERENCES: WidgetTimerPreferences = { mode: "stopwatch", countdownSeconds: 25 * 60 };

export const DEFAULT_WIDGET_RUNTIME: WidgetTimerRuntime = {
  mode: "stopwatch",
  phase: "stopwatch",
  running: false,
  round: 1,
  phaseStartedAt: 0,
};

export function createDeadlineAlignedTimerRuntime(mode: string, startAt: number, endAt: number, preferences: WidgetTimerPreferences): WidgetTimerRuntime | undefined {
  return getTimerMode(mode)?.createDeadlineRuntime?.(startAt, endAt, preferences);
}

function isValidCountdownTarget(value: unknown): value is number {
  return Number.isFinite(value) && Number(value) > 0;
}

export function taskDueDateTargetAt(dueDate?: string): number | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate || "")) return undefined;
  const target = new Date(`${dueDate}T23:59:59.999`);
  return Number.isFinite(target.getTime()) ? target.getTime() : undefined;
}

export function resolveWidgetCountdownTarget(dueDate: string | undefined, taskId: string | undefined, runtime: WidgetTimerRuntime, scheduledEndAt?: number): number | undefined {
  if (isValidCountdownTarget(scheduledEndAt)) return scheduledEndAt;
  const dueDateTarget = taskDueDateTargetAt(dueDate);
  if (dueDateTarget !== undefined) return dueDateTarget;
  return runtime.mode === "countdown" && runtime.countdownTaskId === taskId && isValidCountdownTarget(runtime.countdownTargetAt)
    ? runtime.countdownTargetAt
    : undefined;
}

export function scheduleWidgetCountdown(task: Task, now: Date, durationMinutes: number): { record: TimelineRecord; countdownTargetAt: number } {
  const duration = Math.min(1_440, Math.max(1, Math.round(durationMinutes)));
  const start = new Date(now);
  start.setSeconds(0, 0);
  const end = new Date(start.getTime() + duration * 60_000);
  const date = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
  const dateOf = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  const time = (value: Date) => `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
  return {
    record: {
      id: `${task.id}_widget_${start.getTime().toString(36)}`,
      taskId: task.id,
      scheduledDate: date,
      scheduledStart: time(start),
      scheduledEndDate: dateOf(end),
      scheduledEnd: time(end),
      executionStatus: "scheduled",
      createdAt: start.toISOString(),
    },
    countdownTargetAt: end.getTime(),
  };
}

function normalizeInteger(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min
    ? Math.min(max, Math.round(parsed))
    : fallback;
}

export function normalizeWidgetTimerPreferences(
  value?: Partial<WidgetTimerPreferences> | null,
): WidgetTimerPreferences {
  const mode = normalizeWidgetTimerMode(value?.mode, "stopwatch");
  const preferences = { ...value, mode, countdownSeconds: normalizeInteger(value?.countdownSeconds, DEFAULT_WIDGET_TIMER_PREFERENCES.countdownSeconds, 1, 86_400) };
  return getTimerMode(mode)?.normalizePreferences(preferences) || preferences;
}

export function createWidgetTimerModeTransition(
  modeValue: unknown,
  currentPreferences: WidgetTimerPreferences,
  now: number,
  countdownTargetAt?: number,
) {
  const mode = normalizeWidgetTimerMode(modeValue, currentPreferences.mode);
  const preferences = normalizeWidgetTimerPreferences({ ...currentPreferences, mode });
  return {
    preferences,
    runtime: {
      ...createWidgetTimerRuntime(mode, now, preferences, countdownTargetAt),
      running: false,
      pausedAt: now,
    } satisfies WidgetTimerRuntime,
  };
}

export function normalizeWidgetTimerRuntime(
  value: Partial<WidgetTimerRuntime> | null | undefined,
  preferenceValue: Partial<WidgetTimerPreferences>,
  now: number,
): WidgetTimerRuntime {
  const preferences = normalizeWidgetTimerPreferences(preferenceValue);
  const provider = getTimerMode(preferences.mode);
  if (provider) return provider.normalizeRuntime(value, preferences, now);
  const mode = preferences.mode;
  const phase = value?.mode === mode && [mode, "overrun"].includes(value?.phase || "") ? value!.phase! : mode;
  let running = value?.mode === mode && value?.running === true;
  const phaseStartedAt = Number.isFinite(value?.phaseStartedAt) && value!.phaseStartedAt! >= 0 && value!.phaseStartedAt! <= now ? value!.phaseStartedAt! : now;
  const runtime: WidgetTimerRuntime = { mode, phase, running, round: 1, phaseStartedAt };
  if (mode === "countdown") {
    if (isValidCountdownTarget(value?.countdownTargetAt)) {
      runtime.countdownTargetAt = value!.countdownTargetAt!;
      if (typeof value?.countdownTaskId === "string") runtime.countdownTaskId = value.countdownTaskId;
      if (typeof value?.countdownRecordId === "string") runtime.countdownRecordId = value.countdownRecordId;
      if (phase === "countdown") runtime.phaseEndsAt = runtime.countdownTargetAt;
    } else {
      running = false;
      runtime.running = false;
    }
  }
  if (!running) {
    runtime.pausedAt = Number.isFinite(value?.pausedAt) && value!.pausedAt! >= phaseStartedAt
      ? value!.pausedAt! : now;
  } else if (Number.isFinite(value?.pausedAt) && value!.pausedAt! >= phaseStartedAt) {
    runtime.pausedAt = value!.pausedAt!;
  }
  return runtime;
}

function calculateWidgetWorkMilliseconds(
  value: WidgetTimerRuntime,
  preferenceValue: Partial<WidgetTimerPreferences>,
  from: number,
  now: number,
): number {
  if (!value.running || value.pausedAt !== undefined || now <= from) return 0;
  const provider = getTimerMode(value.mode);
  return provider ? provider.workMilliseconds(value, normalizeWidgetTimerPreferences(preferenceValue), from, now) : Math.max(0, now - from);
}

export function calculateWidgetWorkSeconds(
  value: WidgetTimerRuntime,
  preferenceValue: Partial<WidgetTimerPreferences>,
  from: number,
  now: number,
): number {
  return Math.floor(calculateWidgetWorkMilliseconds(value, preferenceValue, from, now) / 1_000);
}

export function accumulateWidgetWorkTime(
  value: WidgetTimerRuntime,
  preferenceValue: Partial<WidgetTimerPreferences>,
  from: number,
  now: number,
  priorRemainderMs: number,
): { wholeSeconds: number; remainderMs: number } {
  const totalMs = Math.max(0, priorRemainderMs)
    + calculateWidgetWorkMilliseconds(value, preferenceValue, from, now);
  return {
    wholeSeconds: Math.floor(totalMs / 1_000),
    remainderMs: totalMs % 1_000,
  };
}

export function createWidgetTimerRuntime(
  mode: WidgetTimerMode,
  now: number,
  value: Partial<WidgetTimerPreferences> = DEFAULT_WIDGET_TIMER_PREFERENCES,
  countdownTargetAt?: number,
): WidgetTimerRuntime {
  const preferences = normalizeWidgetTimerPreferences({ ...value, mode });
  const provider = getTimerMode(preferences.mode);
  if (provider) return provider.createRuntime(now, preferences);
  mode = preferences.mode;
  const phase = mode;
  const runtime: WidgetTimerRuntime = {
    mode,
    phase,
    running: true,
    round: 1,
    phaseStartedAt: now,
  };
  if (mode === "countdown" && isValidCountdownTarget(countdownTargetAt)) {
    runtime.countdownTargetAt = countdownTargetAt;
    runtime.phaseEndsAt = countdownTargetAt;
  }
  return runtime;
}

export function resetWidgetTimerRuntime(
  runtime: WidgetTimerRuntime,
  preferenceValue: Partial<WidgetTimerPreferences>,
  now: number,
): WidgetTimerRuntime {
  const reset = createWidgetTimerRuntime(runtime.mode, now, preferenceValue, runtime.countdownTargetAt);
  if (runtime.mode === "countdown" && runtime.countdownTaskId) reset.countdownTaskId = runtime.countdownTaskId;
  if (runtime.mode === "countdown" && runtime.countdownRecordId) reset.countdownRecordId = runtime.countdownRecordId;
  return { ...reset, running: false, pausedAt: now };
}

export function advanceWidgetTimer(
  value: WidgetTimerRuntime,
  preferenceValue: Partial<WidgetTimerPreferences>,
  now: number,
): WidgetTimerTick & WidgetTimerRuntime {
  const preferences = normalizeWidgetTimerPreferences(preferenceValue);
  const provider = getTimerMode(value.mode);
  if (provider) return provider.advance(value, preferences, now);
  let runtime = { ...value };
  const transitions: WidgetTimerTick["transitions"] = [];

  if (runtime.pausedAt !== undefined) {
    if (!runtime.running) now = runtime.pausedAt;
    else {
      const pauseDuration = Math.max(0, now - runtime.pausedAt);
      runtime.phaseStartedAt += pauseDuration;
      if (runtime.phaseEndsAt !== undefined && !isValidCountdownTarget(runtime.countdownTargetAt)) {
        runtime.phaseEndsAt += pauseDuration;
      }
      delete runtime.pausedAt;
    }
  }

  if (runtime.running) {
    for (let index = 0; index < 64 && runtime.phaseEndsAt !== undefined && now >= runtime.phaseEndsAt; index += 1) {
      const transitionAt = runtime.phaseEndsAt;
      if (runtime.phase === "countdown") {
        transitions.push("countdownComplete");
        runtime = { ...runtime, phase: "overrun", phaseStartedAt: transitionAt };
        delete runtime.phaseEndsAt;
        break;
      }
      break;
    }
  }

  let displaySeconds: number;
  if (runtime.phase === "stopwatch" || runtime.phase === "overrun") {
    displaySeconds = Math.max(0, Math.floor((now - runtime.phaseStartedAt) / 1_000));
  } else {
    displaySeconds = Math.max(0, Math.ceil(((runtime.phaseEndsAt ?? now) - now) / 1_000));
  }
  const countsAsWork = countsWidgetTimerPhaseAsWork(runtime.phase);
  return { ...runtime, runtime, displaySeconds, transitions, countsAsWork };
}
