import { describe, expect, it } from "vitest";
import { projectedOffsets } from "./dragProjection";

describe("bounded drag projection", () => {
  it("matches the original full scan for every source, target and insertion side", () => {
    const count = 24;
    for (let source = 0; source < count; source++) for (let target = 0; target < count; target++) for (const position of ["before", "after"] as const) {
      const expected = new Map<number, number>();
      const end = target + Number(position === "after");
      if (source !== target) for (let i = 0; i < count; i++) {
        if (source < end && i > source && i < end) expected.set(i, -40);
        if (source > end && i >= end && i < source) expected.set(i, 40);
      }
      expect(projectedOffsets(count, source, target, position, 40)).toEqual(expected);
    }
  });
  it("enforces animation budgets before allocating offsets, even for very long lists", () => {
    expect(projectedOffsets(100000, 0, 99999, "after", 40, 12).size).toBe(0);
    expect(projectedOffsets(100000, 50000, 50012, "after", 40, 12).size).toBe(12);
    expect(projectedOffsets(100000, 50012, 50000, "before", 40, 12).size).toBe(12);
    expect(projectedOffsets(10, -1, 4, "after", 40)).toEqual(new Map());
  });
});
