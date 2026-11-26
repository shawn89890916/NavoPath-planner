import { describe, expect, it } from "vitest";
import { aggregateSavePhase, saveFeedbackLabel } from "./feedback";

describe("save feedback", () => {
  it("never reports success while either queue is pending or retrying", () => {
    expect(aggregateSavePhase({ data: "confirmed", settings: "pending" })).toBe("pending");
    expect(aggregateSavePhase({ data: "retrying", settings: "confirmed" })).toBe("retrying");
    expect(aggregateSavePhase({ data: "confirmed", settings: "idle" })).toBe("confirmed");
  });
  it("distinguishes local and cloud adapter acknowledgement", () => {
    expect(saveFeedbackLabel("confirmed", "en", false)).toBe("Local save confirmed");
    expect(saveFeedbackLabel("confirmed", "en", true)).toBe("Cloud save confirmed");
    expect(saveFeedbackLabel("retrying", "zh", true)).toContain("未确认");
  });
});
