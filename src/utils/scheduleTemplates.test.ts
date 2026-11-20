import { describe, expect, it } from "vitest";
import { readTemplatePeriods, saveTemplatePeriods, templateApplication } from "./scheduleTemplates";

describe("template application", () => {
  const date = "2026-11-20";
  const nextDay = "2026-11-21";
  const periods = readTemplatePeriods([
    { id: "late", label: "Wrap up", start: "23:50", end: "00:10" },
    { id: "morning", label: "Focus", start: "08:55", end: "09:40" },
    { id: "afternoon", label: "Review", start: "14:00", end: "15:30" },
  ]);

  it("round-trips exact times, including blocks that end at or after midnight", () => {
    const midnight = { id: "midnight", label: "Close", start: "23:45", end: "00:00" };
    const saved = saveTemplatePeriods([...periods, ...readTemplatePeriods([midnight])], () => "Block");
    expect(saved.map(({ id, start, end }) => [id, start, end])).toEqual([
      ["morning", "08:55", "09:40"], ["afternoon", "14:00", "15:30"],
      ["midnight", "23:45", "00:00"], ["late", "23:50", "00:10"],
    ]);
    expect(readTemplatePeriods(saved).at(-1)?.durationMinutes).toBe(20);
  });

  it("checks the target and the following day without treating touching blocks as conflicts", () => {
    const result = templateApplication(periods, date, (day) => day === date
      ? [{ start: 530, end: 535 }, { start: 850, end: 855 }]
      : day === nextDay ? [{ start: 5, end: 20 }] : [], "Block");
    expect(result.available.map(({ id, startMinutes }) => [id, startMinutes])).toEqual([["morning", 535]]);
    expect([...result.skipped]).toEqual(["afternoon", "late"]);
    const touching = templateApplication(periods, date, (day) => day === nextDay ? [{ start: 10, end: 20 }] : [], "Block");
    expect(touching.available.map(({ id }) => id)).toEqual(["morning", "afternoon", "late"]);
  });
});
