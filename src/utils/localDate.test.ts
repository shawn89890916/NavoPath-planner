import { describe, expect, it } from "vitest";
import { localIsoDate } from "./localDate";

describe("local calendar date", () => {
  it("matches the system calendar across midnight and DST boundaries", () => {
    const reference = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" });
    for (const instant of ["2026-03-08T06:59:59Z", "2026-03-08T07:00:00Z", "2026-10-23T15:59:59Z", "2026-10-23T16:00:00Z", "2026-11-01T06:00:00Z"]) {
      expect(localIsoDate(new Date(instant))).toBe(reference.format(new Date(instant)));
    }
  });

  it("keeps explicit time zones independent, including midnight and repeated calls", () => {
    const instant = new Date("2026-10-23T16:00:00Z");
    for (let index = 0; index < 2; index++) {
      expect(localIsoDate(instant, "Asia/Shanghai")).toBe("2026-10-24");
      expect(localIsoDate(instant, "America/New_York")).toBe("2026-10-23");
      expect(localIsoDate(instant, "UTC")).toBe("2026-10-23");
    }
    expect(localIsoDate(new Date("2026-03-08T04:59:59Z"), "America/New_York")).toBe("2026-03-07");
    expect(localIsoDate(new Date("2026-03-08T05:00:00Z"), "America/New_York")).toBe("2026-03-08");
  });

  it("still rejects invalid dates and time zones", () => {
    expect(() => localIsoDate(new Date("invalid"))).toThrow(RangeError);
    expect(() => localIsoDate(new Date(), "Invalid/TimeZone")).toThrow(RangeError);
  });
});
