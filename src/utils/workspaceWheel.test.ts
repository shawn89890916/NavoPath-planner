import { describe, expect, it, vi } from "vitest";
import { installWorkspaceWheelRouting, routeWorkspaceWheel, wheelPixels } from "./workspaceWheel";

function fixture(kind: "tasks" | "timeline" = "tasks") {
  const scroller = { scrollTop: 100, scrollHeight: 1000, clientHeight: 200 };
  const panel = {
    matches: (selector: string) => selector === ".df-candidate-panel" && kind === "tasks",
    closest: () => null, getClientRects: () => [1], contains: () => true,
    querySelector: () => scroller,
  };
  const background = { closest: (selector: string) => selector.startsWith(".df-execute") ? panel : null, parentElement: null };
  const backdrop = {
    closest: (selector: string) => selector === ".df-app.mode-execute" || selector.startsWith("[data-workspace-backdrop]") ? backdrop : null,
  };
  const doc = {
    elementsFromPoint: vi.fn(() => [backdrop, background]),
    defaultView: { getComputedStyle: () => ({ overflowY: "visible" }) },
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
  } as unknown as Document;
  const event = {
    target: backdrop, cancelable: true, defaultPrevented: false, deltaX: 0, deltaY: 40,
    deltaMode: 0, clientX: 20, clientY: 50, preventDefault: vi.fn(),
  };
  return { scroller, panel, background, backdrop, doc, event };
}

describe("workspace wheel routing", () => {
  it.each(["tasks", "timeline"] as const)("scrolls exposed %s through a workspace backdrop", (kind) => {
    const { scroller, doc, event } = fixture(kind);
    routeWorkspaceWheel(event as unknown as WheelEvent, doc);
    expect(scroller.scrollTop).toBe(140);
    expect(event.preventDefault).toHaveBeenCalledOnce();
  });

  it("does not scroll behind a foreground panel", () => {
    const { scroller, doc, event } = fixture();
    const target = { closest: () => target };
    routeWorkspaceWheel({ ...event, target } as unknown as WheelEvent, doc);
    expect(scroller.scrollTop).toBe(100);
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it("preserves zoom and horizontal gestures", () => {
    const { scroller, doc, event } = fixture();
    for (const patch of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { deltaX: 90 }]) {
      routeWorkspaceWheel({ ...event, ...patch } as unknown as WheelEvent, doc);
    }
    expect(scroller.scrollTop).toBe(100);
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it("routes the Tasks header without requiring the pointer to be over its list", () => {
    const { scroller, doc, event, panel } = fixture();
    const target = {
      closest: (selector: string) => selector.startsWith(".df-execute") ? panel : selector === ".df-app.mode-execute" ? target : null,
      parentElement: null,
    };
    routeWorkspaceWheel({ ...event, target } as unknown as WheelEvent, doc);
    expect(scroller.scrollTop).toBe(140);
  });

  it("clamps scrolling and normalizes line/page deltas", () => {
    const { scroller, doc, event } = fixture();
    routeWorkspaceWheel({ ...event, deltaY: 1000 } as unknown as WheelEvent, doc);
    expect(scroller.scrollTop).toBe(800);
    routeWorkspaceWheel({ ...event, deltaY: -1000 } as unknown as WheelEvent, doc);
    expect(scroller.scrollTop).toBe(0);
    expect(wheelPixels(3, 1, 200)).toBe(48);
    expect(wheelPixels(2, 2, 200)).toBe(400);
  });

  it("installs a non-passive capture listener and removes it on cleanup", () => {
    const { doc } = fixture();
    const cleanup = installWorkspaceWheelRouting(doc);
    expect(doc.addEventListener).toHaveBeenCalledWith("wheel", expect.any(Function), { capture: true, passive: false });
    cleanup();
    expect(doc.removeEventListener).toHaveBeenCalledWith("wheel", expect.any(Function), true);
  });
});
