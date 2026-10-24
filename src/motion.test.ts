import { describe, expect, it, vi } from "vitest";
import { MOTION, prefersReducedMotion, runMotionTransition, scheduleMotionCommit } from "./motion";

function motionWindow(reduced = false) {
  return {
    matchMedia: () => ({ matches: reduced }),
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
  } as unknown as Window;
}

function motionRoot() {
  return {
    dataset: {} as DOMStringMap,
    style: {
      setProperty: vi.fn(),
      removeProperty: vi.fn(),
    },
  } as unknown as HTMLElement;
}

function motionDocument(targetWindow: Window, startViewTransition?: (callback: () => void) => { finished: Promise<unknown> }) {
  return {
    defaultView: targetWindow,
    documentElement: motionRoot(),
    ...(startViewTransition ? { startViewTransition } : {}),
  } as unknown as Document & { startViewTransition?: typeof startViewTransition };
}

describe("motion helpers", () => {
  it("reads the reduced-motion preference", () => {
    expect(prefersReducedMotion(motionWindow(false))).toBe(false);
    expect(prefersReducedMotion(motionWindow(true))).toBe(true);
  });

  it("uses a view transition when available", async () => {
    const update = vi.fn();
    const startViewTransition = vi.fn((callback: () => void) => {
      callback();
      return { finished: Promise.resolve() };
    });
    const targetDocument = motionDocument(motionWindow(false), startViewTransition);
    const root = targetDocument.documentElement;

    await runMotionTransition(update, { direction: "forward", document: targetDocument });

    expect(startViewTransition).toHaveBeenCalledOnce();
    expect(update).toHaveBeenCalledOnce();
    expect(root.dataset.motionDirection).toBeUndefined();
  });

  it("updates immediately when reduced motion is enabled", async () => {
    const update = vi.fn();
    const startViewTransition = vi.fn();
    const targetDocument = motionDocument(motionWindow(true), startViewTransition);

    await runMotionTransition(update, { document: targetDocument });

    expect(update).toHaveBeenCalledOnce();
    expect(startViewTransition).not.toHaveBeenCalled();
  });

  it.each([true, false])("keeps navigation when the browser aborts its animation (committed: %s)", async (committed) => {
    const update = vi.fn();
    const targetDocument = motionDocument(motionWindow(false), (callback) => {
      if (committed) callback();
      return {
        ready: Promise.reject(new DOMException("Transition skipped", "AbortError")),
        finished: Promise.reject(new DOMException("DOM update timed out", "TimeoutError")),
      };
    });
    await runMotionTransition(update, { document: targetDocument });
    expect(update).toHaveBeenCalledOnce();
    expect(targetDocument.documentElement.dataset.motionScope).toBeUndefined();
  });

  it("falls back to a timed CSS state", async () => {
    vi.useFakeTimers();
    const update = vi.fn();
    const targetDocument = motionDocument(motionWindow(false));
    const root = targetDocument.documentElement;

    const transition = runMotionTransition(update, { document: targetDocument, duration: MOTION.layout });
    expect(update).toHaveBeenCalledOnce();
    expect(root.dataset.motionFallback).toBe("true");
    await vi.advanceTimersByTimeAsync(MOTION.layout);
    await transition;
    expect(root.dataset.motionFallback).toBeUndefined();
    vi.useRealTimers();
  });

  it("commits an exit only once", () => {
    vi.useFakeTimers();
    const commit = vi.fn();
    const scheduled = scheduleMotionCommit(commit, MOTION.fade, motionWindow(false));
    scheduled.finish();
    vi.advanceTimersByTime(MOTION.fade);
    scheduled.finish();
    expect(commit).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it("keeps the newest navigation and its direction when transitions overlap", async () => {
    const callbacks: (() => void)[] = [];
    const finishes: (() => void)[] = [];
    const skips = [vi.fn(), vi.fn()];
    const targetDocument = motionDocument(motionWindow(false), (callback) => {
      callbacks.push(callback);
      return {
        finished: new Promise<void>((resolve) => finishes.push(resolve)),
        skipTransition: skips[callbacks.length - 1],
      };
    });
    const olderUpdate = vi.fn();
    const latestUpdate = vi.fn();
    const older = runMotionTransition(olderUpdate, { document: targetDocument, direction: "forward", scope: "workspace" });
    const latest = runMotionTransition(latestUpdate, { document: targetDocument, direction: "backward", scope: "workspace" });
    expect(skips[0]).toHaveBeenCalledOnce();
    callbacks[0]();
    callbacks[1]();
    finishes[0]();
    await older;
    expect(olderUpdate).not.toHaveBeenCalled();
    expect(latestUpdate).toHaveBeenCalledOnce();
    expect(targetDocument.documentElement.dataset.motionDirection).toBe("backward");
    expect(targetDocument.documentElement.dataset.motionScope).toBe("workspace");
    finishes[1]();
    await latest;
    expect(targetDocument.documentElement.dataset.motionScope).toBeUndefined();
  });

  it("does not let an older fallback timer clear the current transition", async () => {
    vi.useFakeTimers();
    const targetDocument = motionDocument(motionWindow(false));
    const older = runMotionTransition(vi.fn(), { document: targetDocument, direction: "forward", duration: 100 });
    await vi.advanceTimersByTimeAsync(50);
    const latest = runMotionTransition(vi.fn(), { document: targetDocument, direction: "backward", duration: 200 });
    await vi.advanceTimersByTimeAsync(50);
    await older;
    expect(targetDocument.documentElement.dataset.motionDirection).toBe("backward");
    expect(targetDocument.documentElement.dataset.motionFallback).toBe("true");
    await vi.advanceTimersByTimeAsync(150);
    await latest;
    expect(targetDocument.documentElement.dataset.motionFallback).toBeUndefined();
    vi.useRealTimers();
  });

  it.each([false, true])("preserves independent selections when animations overlap (same scope: %s)", async (sameScope) => {
    const callbacks: (() => void)[] = [];
    const finishes: (() => void)[] = [];
    const targetDocument = motionDocument(motionWindow(false), (callback) => {
      callbacks.push(callback);
      return { finished: new Promise<void>((resolve) => finishes.push(resolve)), skipTransition: vi.fn() };
    });
    const updates: string[] = [];
    const first = runMotionTransition(() => { updates.push("view"); }, { document: targetDocument, scope: "planning", key: {} });
    const second = runMotionTransition(() => { updates.push("workspace"); }, { document: targetDocument, scope: sameScope ? "planning" : "workspace", key: {} });
    callbacks[1]();
    callbacks[0]();
    finishes.forEach((finish) => finish());
    await Promise.all([first, second]);
    expect(updates).toEqual(["view", "workspace"]);
  });

  it("applies every relative command once when its animation is superseded", async () => {
    const callbacks: (() => void)[] = [];
    const finishes: (() => void)[] = [];
    let date = 23;
    const targetDocument = motionDocument(motionWindow(false), (callback) => {
      callbacks.push(callback);
      return { finished: new Promise<void>((resolve) => finishes.push(resolve)), skipTransition: vi.fn() };
    });
    const first = runMotionTransition(() => { date += 1; }, { document: targetDocument, updates: "all", scope: "timeline" });
    const second = runMotionTransition(() => { date += 1; }, { document: targetDocument, updates: "all", scope: "timeline" });
    expect(date).toBe(24);
    callbacks[1]();
    callbacks[0]();
    expect(date).toBe(25);
    finishes.forEach((finish) => finish());
    await Promise.all([first, second]);
  });
});
