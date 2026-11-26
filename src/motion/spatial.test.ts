import { describe, expect, it } from "vitest";
import { projectedOffsets, readLogicalLayout } from "./dragProjection";
import { anchorPlacement } from "./anchor";

describe("projected drag order", () => {
  it("moves intervening siblings while leaving the source and unrelated rows stationary", () => {
    expect([...projectedOffsets(5, 1, 3, "after", 40)]).toEqual([[2, -40], [3, -40]]);
    expect([...projectedOffsets(5, 3, 1, "before", 40)]).toEqual([[1, 40], [2, 40]]);
  });
  it("does not move when drop has the same position or is invalid", () => {
    expect(projectedOffsets(5, 1, 2, "before", 40).size).toBe(0);
    expect(projectedOffsets(5, 1, 1, "after", 40).size).toBe(0);
    expect(projectedOffsets(5, -1, 2, "after", 40).size).toBe(0);
  });
});
describe("anchored surfaces", () => {
  const viewport = { left: 0, top: 0, right: 320, bottom: 400 };
  it("flips above when below lacks room and clamps width", () => {
    const a = anchorPlacement({ left: 270, right: 310, top: 350, bottom: 380 }, viewport, 300, 160);
    expect(a.upward).toBe(true);
    expect(a.left).toBe(12);
    expect(a.width).toBe(296);
    expect(a.top).toBe(182);
  });
  it("uses the larger available side and honors an inset viewport", () => {
    const a = anchorPlacement({ left: 32, right: 60, top: 90, bottom: 110 }, { left: 20, right: 220, top: 40, bottom: 240 }, 280, 200);
    expect(a.upward).toBe(false);
    expect(a.width).toBe(176);
    expect(a.maxHeight).toBe(110);
  });
});

describe("logical drag geometry", () => {
  it("temporarily detaches translation effects and restores the same effect and time even on error", () => {
    const effect = {} as AnimationEffect;
    const animation = { effect, currentTime: 42 } as Animation;
    expect(readLogicalLayout([animation], () => animation.effect)).toBeNull();
    expect(animation.effect).toBe(effect);
    expect(animation.currentTime).toBe(42);
    expect(() => readLogicalLayout([animation], () => { throw new Error("read"); })).toThrow("read");
    expect(animation.effect).toBe(effect);
  });
});
