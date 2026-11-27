import { describe, expect, it } from "vitest";
import { approachesBounds, createIntentSampler, predictPointer } from "./intent";

const point = (x: number, y: number, t: number) => ({ x, y, t });
const target = { left: 80, right: 100, top: 0, bottom: 30 };

describe("intent prediction", () => {
  it("anticipates a straight approach before hover, including overshoot", () => {
    const p = predictPointer(point(0, 10, 0), point(20, 10, 20), point(40, 10, 40));
    expect(p).toBeDefined();
    expect(approachesBounds(point(40, 10, 40), p!, target)).toBe(true);
    expect(p!.x).toBeGreaterThan(target.right);
  });
  it("ignores motion away, orthogonal paths and already-hovered targets", () => {
    expect(approachesBounds(point(40, 10, 40), point(0, 10, 80), target)).toBe(false);
    expect(approachesBounds(point(40, 50, 40), point(140, 50, 80), target)).toBe(false);
    expect(approachesBounds(point(90, 10, 40), point(140, 10, 80), target)).toBe(false);
  });
  it("rejects reversals, braking, jitter, stale samples and duplicate timestamps", () => {
    for (const c of [point(0, 10, 40), point(21, 10, 40), point(40, 10, 200), point(40, 10, 20), point(20, 30, 40)]) {
      expect(predictPointer(point(0, 10, 0), point(20, 10, 20), c)).toBeUndefined();
    }
  });
  it("bounds the extrapolation and ignores empty targets", () => {
    const p = predictPointer(point(0, 0, 0), point(100, 0, 20), point(200, 0, 40))!;
    expect(p.x - 200).toBeCloseTo(120);
    expect(approachesBounds(point(200, 0, 40), p, { left: 220, right: 220, top: 0, bottom: 5 })).toBe(false);
  });
  it("limits sampling and discards history after reset or inactivity", () => {
    const s = createIntentSampler();
    expect(s.sample(point(0, 10, 0))).toBeUndefined();
    expect(s.sample(point(4, 10, 4))).toBeUndefined();
    expect(s.sample(point(20, 10, 20))).toBeUndefined();
    expect(s.sample(point(40, 10, 40))).toBeDefined();
    s.reset();
    expect(s.sample(point(60, 10, 60))).toBeUndefined();
    expect(s.sample(point(80, 10, 80))).toBeUndefined();
    expect(s.sample(point(100, 10, 300))).toBeUndefined();
    expect(s.sample(point(120, 10, 320))).toBeUndefined();
  });
});
