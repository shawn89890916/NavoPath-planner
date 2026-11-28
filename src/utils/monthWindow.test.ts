import { describe, expect, it } from "vitest";
import { addIsoDays, buildWeekWindow, layoutMonthWeeks, monthScrollTopForDate, monthWeekAtOffset, visibleMonthWeekRange } from "./monthWindow";

describe("month week layout", () => {
  it("stacks variable-height weeks using the desktop and compact task heights", () => {
    const weeks = buildWeekWindow("2026-11-18", 1, 1, 1);
    const taskCount = (date: string) => date === weeks[1][1] ? 4 : 0;
    const regular = layoutMonthWeeks(weeks, taskCount, false);
    expect(regular.rows.map(({ top, height }) => [top, height])).toEqual([[0, 118], [118, 256], [374, 118]]);
    expect(regular.totalHeight).toBe(492);
    const compact = layoutMonthWeeks(weeks, taskCount, true);
    expect(compact.rows.map(({ top, height }) => [top, height])).toEqual([[0, 122], [122, 272], [394, 122]]);
    expect(compact.totalHeight).toBe(516);
  });

  it("mounts only nearby weeks and locates the header probe without DOM measurements", () => {
    const weeks = buildWeekWindow("2026-11-18", 20, 30);
    const { rows, totalHeight } = layoutMonthWeeks(weeks, () => 0, false);
    const height = 520;
    const scrollTop = rows[20].top - height * 0.32;
    const { first, last } = visibleMonthWeekRange(rows, scrollTop, height);

    expect([first, last]).toEqual([16, 25]);
    expect(monthWeekAtOffset(rows, scrollTop + height * 0.35)).toBe(20);
    expect(monthWeekAtOffset(rows, rows[20].top)).toBe(20);
    expect(visibleMonthWeekRange(rows, 0, height).first).toBe(0);
    expect(visibleMonthWeekRange(rows, totalHeight - height, height).last).toBe(50);
    expect(visibleMonthWeekRange([], 0, height).last).toBe(-1);
  });

  it("preserves the probed week's viewport offset when recentering in either direction", () => {
    const date = "2026-11-18";
    const weeks = buildWeekWindow(date, 20, 30, 1);
    const taskCount = (day: string) => day.endsWith("01") ? 8 : 0;
    const { rows, totalHeight } = layoutMonthWeeks(weeks, taskCount, false);
    const height = 600;

    for (const [scrollTop, days] of [[100, -140], [totalHeight - height - 100, 140]]) {
      const row = rows[monthWeekAtOffset(rows, scrollTop + height * 0.35)];
      const viewportOffset = row.top - scrollTop;
      const shiftedWeeks = buildWeekWindow(addIsoDays(date, days), 20, 30, 1);
      const shifted = layoutMonthWeeks(shiftedWeeks, taskCount, false);
      const restored = monthScrollTopForDate(shifted.rows, row.dates[0], viewportOffset);
      const restoredRow = shifted.rows.find(({ dates }) => dates[0] === row.dates[0])!;

      expect(restoredRow.top - restored!).toBe(viewportOffset);
      expect(restored).toBeGreaterThan(160);
      expect(restored! + height).toBeLessThan(shifted.totalHeight - 160);
    }
  });

  it("finds a selected day anywhere in its row and clamps scroll before the first row", () => {
    const weeks = buildWeekWindow("2026-11-18", 1, 1, 1);
    const { rows } = layoutMonthWeeks(weeks, () => 0, false);
    expect(monthScrollTopForDate(rows, "2026-11-18", 100)).toBe(18);
    expect(monthScrollTopForDate(rows, weeks[0][6], 100)).toBe(0);
    expect(monthScrollTopForDate(rows, "2026-12-15", 100)).toBeUndefined();
  });
});

 it("matches the linear reference for variable heights, exact boundaries and out-of-range offsets", () => {
  const weeks = buildWeekWindow("2026-11-18", 80, 80);
  const { rows, totalHeight } = layoutMonthWeeks(weeks, date => Number(date.slice(-2)) % 7, false);
  for (const offset of [-100, 0, ...rows.flatMap(row => [row.top - 1, row.top, row.top + row.height - 1]), totalHeight, totalHeight + 100]) {
    const expected = rows.findIndex(row => row.top + row.height > offset);
    expect(monthWeekAtOffset(rows, offset)).toBe(expected === -1 ? rows.length - 1 : expected);
  }
  expect(monthWeekAtOffset([], 0)).toBe(-1);
});
