import { afterEach, describe, expect, it } from "vitest";
import type { Task } from "../types";
import { provider, defaults } from "../../community-plugins/pomodoro/main";
import { registerTimerMode, getTimerModes, onTimerModeRemoving } from "../extensions/timers";
import { DEFAULT_WIDGET_TIMER_PREFERENCES as prefs, advanceTaskElapsedSeconds, advanceWidgetTimer, accumulateWidgetWorkTime, calculateWidgetWorkSeconds, createDeadlineAlignedTimerRuntime, createWidgetTimerModeTransition, createWidgetTimerRuntime, getStopwatchTaskTimerAction, getWidgetTimerModeChangeTaskAction, getWidgetTimerNotificationDescriptor, normalizeStoredTaskTimer, normalizeWidgetTimerPreferences, normalizeWidgetTimerRuntime, normalizeWidgetTimerMode, resetWidgetTimerRuntime, resolveWidgetCountdownTarget, scheduleWidgetCountdown } from "./widgetTimer";

const disposers: Array<() => void> = [];
const install = () => { const dispose = registerTimerMode(provider); disposers.push(dispose); return dispose; };
afterEach(() => { disposers.splice(0).reverse().forEach((dispose) => dispose()); });

describe("generic timer host", () => {
  it("offers extension modes only while installed and enabled", () => {
    expect(getTimerModes().map((mode) => mode.mode)).toEqual(["stopwatch", "countdown"]);
    expect(normalizeWidgetTimerMode("pomodoro", "stopwatch")).toBe("stopwatch");
    const remove = install(); expect(getTimerModes().map((mode) => mode.mode)).toEqual(["stopwatch", "pomodoro", "countdown"]);
    expect(normalizeWidgetTimerMode("pomodoro", "stopwatch")).toBe("pomodoro");
    remove(); expect(normalizeWidgetTimerPreferences({ mode: "pomodoro" }).mode).toBe("stopwatch");
  });
  it("settles work before the provider is removed", () => {
    const remove = install(); let settled = -1;
    const runtime = createWidgetTimerRuntime("pomodoro", 0, { ...prefs, focusMinutes: 1, autoStartNextPhase: true });
    disposers.push(onTimerModeRemoving(() => { settled = calculateWidgetWorkSeconds(runtime, { ...prefs, autoStartNextPhase: true }, 0, 1500); }));
    remove(); expect(settled).toBe(1);
  });
  it("restores malformed task storage and advances from wall-clock time", () => {
    expect(normalizeStoredTaskTimer({ taskId: "one", elapsed: 12.9 })).toEqual({ taskId: "one", elapsedSeconds: 12 });
    expect(normalizeStoredTaskTimer({ taskId: "one", elapsed: -1 })).toEqual({ taskId: "one", elapsedSeconds: 0 });
    expect(normalizeStoredTaskTimer({ taskId: " " })).toBeNull();
    expect(advanceTaskElapsedSeconds(12, 1000, 6750)).toBe(17);
    const runtime = createWidgetTimerRuntime("stopwatch", 0);
    const first = accumulateWidgetWorkTime(runtime, prefs, 0, 1500, 0);
    expect(first).toEqual({ wholeSeconds: 1, remainderMs: 500 });
    expect(accumulateWidgetWorkTime(runtime, prefs, 1500, 3000, first.remainderMs)).toEqual({ wholeSeconds: 2, remainderMs: 0 });
  });
  it("pauses the existing stopwatch before switching modes", () => {
    expect(getStopwatchTaskTimerAction("one", 42, 10000, 13900)).toEqual({ type: "pause", elapsedSeconds: 45 });
    expect(getWidgetTimerModeChangeTaskAction("stopwatch", "one", 42, 10000, 13900)).toEqual({ type: "pause", elapsedSeconds: 45 });
    expect(createWidgetTimerModeTransition("countdown", prefs, 100).runtime).toMatchObject({ mode: "countdown", running: false, pausedAt: 100 });
  });
  it("schedules entered countdown duration across midnight and retains its target", () => {
    const result = scheduleWidgetCountdown({ id: "one" } as Task, new Date("2026-12-31T23:50:00"), 20);
    expect(result.record).toMatchObject({ scheduledDate: "2026-12-31", scheduledStart: "23:50", scheduledEndDate: "2027-01-01", scheduledEnd: "00:10" });
    const runtime = { ...createWidgetTimerRuntime("countdown", 0, prefs, result.countdownTargetAt), countdownTaskId: "one" };
    expect(resolveWidgetCountdownTarget(undefined, "one", runtime)).toBe(result.countdownTargetAt);
  });
  it("pins countdown to its absolute target and enters overrun", () => {
    const runtime = createWidgetTimerRuntime("countdown", 1000, prefs, 2000);
    const paused = { ...runtime, running: false, pausedAt: 1500 };
    expect(advanceWidgetTimer({ ...paused, running: true }, prefs, 1800).runtime.phaseEndsAt).toBe(2000);
    expect(advanceWidgetTimer(runtime, prefs, 3000)).toMatchObject({ phase: "overrun", displaySeconds: 1, transitions: ["countdownComplete"] });
    expect(resetWidgetTimerRuntime(runtime, prefs, 1500)).toMatchObject({ running: false, countdownTargetAt: 2000 });
    expect(normalizeWidgetTimerRuntime({ mode: "countdown", running: true }, { ...prefs, mode: "countdown" }, 100)).toMatchObject({ running: false });
  });
});

describe("installed official Pomodoro", () => {
  it("owns preference defaults and validation", () => {
    install(); expect(normalizeWidgetTimerPreferences({ mode: "pomodoro", focusMinutes: 0 })).toMatchObject({ mode: "pomodoro", focusMinutes: 25, longBreakMinutes: 15 });
    expect(prefs).toEqual({ mode: "stopwatch", countdownSeconds: 1500 });
  });
  it("waits at boundaries when automatic start is disabled", () => {
    install(); const p = { ...prefs, ...defaults, focusMinutes: 1, breakMinutes: 1 };
    const runtime = createWidgetTimerRuntime("pomodoro", 0, p);
    expect(advanceWidgetTimer(runtime, p, 150000)).toMatchObject({ phase: "break", running: false, pausedAt: 60000, displaySeconds: 60, countsAsWork: false });
    expect(calculateWidgetWorkSeconds(runtime, p, 0, 150000)).toBe(60);
  });
  it("catches up across short and long breaks excluding break work", () => {
    expect(provider.normalizePreferences({ mode: "pomodoro", rounds: 3 }).longBreakEvery).toBe(3);
    install(); const p = { ...prefs, ...defaults, focusMinutes: 1, breakMinutes: 1, longBreakMinutes: 2, longBreakEvery: 2, autoStartNextPhase: true };
    const runtime = createWidgetTimerRuntime("pomodoro", 0, p);
    expect(advanceWidgetTimer(runtime, p, 180000)).toMatchObject({ phase: "break", round: 2, phaseEndsAt: 300000 });
    expect(calculateWidgetWorkSeconds(runtime, p, 0, 270000)).toBe(120);
    expect(advanceWidgetTimer(runtime, p, 300000)).toMatchObject({ phase: "focus", round: 3 });
  });
  it("aligns precisely including deadline seconds and counts overtime", () => {
    install(); const p = { ...prefs, ...defaults, autoStartNextPhase: true }, end = 70 * 60000 + 12345;
    const runtime = createDeadlineAlignedTimerRuntime("pomodoro", 0, end, p)!;
    expect(runtime.plan.at(-1)).toMatchObject({ type: "work", endAt: end });
    const running = { ...runtime, running: true }; delete running.pausedAt;
    expect(advanceWidgetTimer(running, p, end + 1000)).toMatchObject({ phase: "overrun", displaySeconds: 1 });
    const expected = runtime.plan.filter((phase: any) => phase.type === "work").reduce((sum: number, phase: any) => sum + phase.endAt - phase.startAt, 0) + 1000;
    expect(calculateWidgetWorkSeconds(running, p, 0, end + 1000)).toBe(Math.floor(expected / 1000));
  });
  it("migrates legacy runtime inside the plugin and localizes notifications", () => {
    install(); const p = { ...prefs, mode: "pomodoro" };
    const runtime = normalizeWidgetTimerRuntime({ mode: "pomodoro", phase: "focus", running: false, phaseStartedAt: 0, pomodoroPlan: [{ type: "work", startAt: 0, endAt: 1000 }], currentPomodoroPhaseIndex: 0 }, p, 0);
    expect(runtime.plan).toHaveLength(1); expect(runtime).not.toHaveProperty("pomodoroPlan");
    expect(getWidgetTimerNotificationDescriptor("pomodoro:focusComplete", "zh").title).toBe("专注结束");
  });
});
