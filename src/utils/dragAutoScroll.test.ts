import { afterEach, describe, expect, it, vi } from "vitest";
import { autoScrollAtDragEdge } from "./dragAutoScroll";

function surface(scrollTop = 500) {
  return {
    scrollTop,
    scrollHeight: 2000,
    clientHeight: 600,
    getBoundingClientRect: () => ({ left: 20, right: 380, top: 120, bottom: 720 }),
  } as HTMLElement;
}

describe("drag edge scrolling", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("scrolls in both directions and reports whether the drop grid moved", () => {
    const timeline = surface();
    expect(autoScrollAtDragEdge(200, 710, [timeline])).toBe(true);
    expect(timeline.scrollTop).toBeGreaterThan(500);
    timeline.scrollTop = 500;
    expect(autoScrollAtDragEdge(200, 130, [timeline])).toBe(true);
    expect(timeline.scrollTop).toBeLessThan(500);
  });

  it("does not scroll when the pointer leaves the edge or the timeline", () => {
    vi.stubGlobal("document", { scrollingElement: null });
    const timeline = surface();
    expect(autoScrollAtDragEdge(200, 400, [timeline])).toBe(false);
    expect(autoScrollAtDragEdge(400, 710, [timeline])).toBe(false);
    expect(timeline.scrollTop).toBe(500);
  });

  it("stops at the beginning and end without reporting further movement", () => {
    const timeline = surface(0);
    expect(autoScrollAtDragEdge(200, 120, [timeline])).toBe(false);
    timeline.scrollTop = 1390;
    expect(autoScrollAtDragEdge(200, 720, [timeline])).toBe(true);
    expect(timeline.scrollTop).toBe(1400);
    expect(autoScrollAtDragEdge(200, 720, [timeline])).toBe(false);
  });

  it("moves the nearest active surface without also scrolling its parent", () => {
    const timeline = surface();
    const parent = surface();
    expect(autoScrollAtDragEdge(200, 710, [timeline, parent])).toBe(true);
    expect(parent.scrollTop).toBe(500);
  });
});
