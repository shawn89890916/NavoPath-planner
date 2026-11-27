import { describe, expect, it, vi } from "vitest";
import { planTaskMotion, rectChanged, TaskMotionCoordinator } from "./layout";
import { normalizeMotionPreference } from "../motion";

const p = (key: string, entity: string, top: number) => ({ key, entity, rect: { left: 0, top, width: 100, height: 30 } });

describe("task motion", () => {
  it("keeps existing presentation identity during reordering", () => {
    const a = p("candidate:a", "a", 0);
    const b = p("candidate:b", "b", 30);
    expect(planTaskMotion([a, b], [p(a.key, "a", 30), p(b.key, "b", 0)], 12).map(x => x.before?.key)).toEqual([a.key, b.key]);
  });
  it("matches a unique candidate to its scheduled representation", () => {
    const old = p("candidate:a", "a", 0);
    const next = p("schedule:record1", "a", 60);
    expect(planTaskMotion([old], [next], 12)).toEqual([{ before: old, after: next }]);
  });
  it("does not merge multiple scheduled instances into one candidate", () => {
    const next = p("candidate:a", "a", 0);
    expect(planTaskMotion([p("schedule:1", "a", 30), p("schedule:2", "a", 60)], [next], 12)).toEqual([{ before: undefined, after: next }]);
  });
  it("ignores duplicate presentation keys", () => {
    expect(planTaskMotion([], [p("x", "a", 0), p("x", "a", 30)], 12)).toEqual([]);
  });
  it("does not move stationary items or animate a large batch", () => {
    expect(rectChanged(p("a", "a", 0).rect, p("a", "a", 1).rect)).toBe(false);
    expect(planTaskMotion([p("a", "a", 0)], [p("a", "a", 0)], 12)).toEqual([]);
    expect(planTaskMotion([], [p("a", "a", 0), p("b", "b", 30)], 1)).toEqual([]);
  });
  it("normalizes unknown and legacy motion preferences", () => {
    expect(normalizeMotionPreference(undefined)).toBe("standard");
    expect(normalizeMotionPreference("off")).toBe("off");
    expect(normalizeMotionPreference("rich")).toBe("rich");
  });
});

it("animates the original task only by translation and skips size changes", () => {
  const animate = vi.fn(() => ({ cancel: vi.fn(), finished: new Promise(() => {}) }));
  const node = { isConnected: true, animate, ownerDocument: { defaultView: { getComputedStyle: () => ({ translate: "none" }) } } } as unknown as HTMLElement;
  const before = { ...p("candidate:a", "a", 0), node };
  const after = { ...p("candidate:a", "a", 30), node };
  const coordinator = new TaskMotionCoordinator();
  coordinator.play([{ before, after }]);
  expect(animate).toHaveBeenCalledWith([{ translate: "0px -30px" }, { translate: "0px 0px" }], expect.any(Object));
  coordinator.play([{ before, after: { ...after, rect: { ...after.rect, width: 150 } } }]);
  expect(animate).toHaveBeenCalledTimes(1);
  coordinator.cancel();
});

it("does not double-translate a nested card when its parent moves", () => {
  const makeNode = (parentElement?: HTMLElement) => ({ parentElement, isConnected: true, animate: vi.fn(() => ({ cancel: vi.fn(), finished: new Promise(() => {}) })), ownerDocument: { defaultView: { getComputedStyle: () => ({ translate: "none" }) } } }) as unknown as HTMLElement;
  const parent = makeNode(), child = makeNode(parent);
  const pair = (node: HTMLElement, key: string, from: number, to: number) => ({ before: { ...p(key, key, from), node }, after: { ...p(key, key, to), node } });
  const coordinator = new TaskMotionCoordinator();
  coordinator.play([pair(parent, "task", 0, 40), pair(child, "sub", 30, 70)]);
  expect(parent.animate).toHaveBeenCalledTimes(1);
  expect(child.animate).not.toHaveBeenCalled();
  coordinator.play([pair(parent, "task", 0, 40), pair(child, "sub", 30, 80)]);
  expect(child.animate).toHaveBeenCalledWith([{ translate: "0px -10px" }, { translate: "0px 0px" }], expect.any(Object));
  coordinator.cancel();
});

it("uses the current visible position and ignores stale animation completion", () => {
  let translate = "none";
  const animate = vi.fn(() => ({ cancel: vi.fn(), finished: new Promise(() => {}) }));
  const node = { isConnected: true, animate, parentElement: null, ownerDocument: { defaultView: { getComputedStyle: () => ({ translate }) } } } as unknown as HTMLElement;
  const before = { ...p("task", "task", 0), node };
  const after = { ...p("task", "task", 40), node };
  const coordinator = new TaskMotionCoordinator();
  coordinator.play([{ before, after }]);
  translate = "0px -15px";
  expect(coordinator.visiblePoints([after])[0].rect.top).toBe(25);
  coordinator.cancel();
  expect(coordinator.visiblePoints([after])).toEqual([after]);
});
